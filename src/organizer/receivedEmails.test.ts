import { beforeEach, describe, expect, it, vi } from "vitest";

// The console's "send the ones still waiting" for the "We've received your
// application" emails: what it asks send-received-email for, and when it stops.

const fake = vi.hoisted(() => ({
  replies: [] as { data: unknown; error: unknown }[],
  posts: [] as unknown[],
  count: { count: 3 as number | null, error: null as unknown },
  filters: [] as string[],
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    functions: {
      invoke: async (name: string, options: { body: unknown }) => {
        fake.posts.push({ name, body: options.body });
        return fake.replies.shift() ?? { data: { sent: 0, stillDue: 0 }, error: null };
      },
    },
    from: (table: string) => {
      const chain = {
        select: (_: string, options: unknown) => { fake.filters.push(`${table} ${JSON.stringify(options)}`); return chain; },
        eq: (column: string, value: string) => { fake.filters.push(`${column}=${value}`); return chain; },
        is: (column: string, value: null) => { fake.filters.push(`${column} is ${value}`); return Promise.resolve(fake.count); },
      };
      return chain;
    },
  },
}));

import { ReceivedSendError, countReceivedDue, sendReceivedDue } from "./receivedEmails";

const reply = (data: object) => ({ data, error: null });

beforeEach(() => {
  fake.replies = [];
  fake.posts = [];
  fake.count = { count: 3, error: null };
  fake.filters = [];
});

describe("countReceivedDue", () => {
  it("counts the event's submitted applications without received_emailed_at", async () => {
    expect(await countReceivedDue("event-1")).toBe(3);
    expect(fake.filters).toEqual([
      'applications {"count":"exact","head":true}', "event_id=event-1", "status=submitted", "received_emailed_at is null",
    ]);
  });

  it("is null when it can't count (before the database change), so the console shows nothing", async () => {
    fake.count = { count: null, error: { code: "42703", message: "column does not exist" } };
    expect(await countReceivedDue("event-1")).toBeNull();
  });
});

describe("sendReceivedDue", () => {
  it("only sends the event id, and keeps asking until none are left", async () => {
    fake.replies = [reply({ sent: 40, failed: [], stillDue: 12 }), reply({ sent: 12, failed: [], stillDue: 0 })];
    const progress: number[] = [];
    const result = await sendReceivedDue("event-1", n => progress.push(n));
    expect(fake.posts).toEqual([
      { name: "send-received-email", body: { eventId: "event-1" } },
      { name: "send-received-email", body: { eventId: "event-1" } },
    ]);
    expect(result).toEqual({ sent: 52, failed: [], stopped: null, stillDue: 0 });
    expect(progress).toEqual([40, 52]);
  });

  it("stops at the daily limit", async () => {
    fake.replies = [reply({ sent: 5, stopped: "daily_limit", stillDue: 30 })];
    expect(await sendReceivedDue("event-1")).toMatchObject({ sent: 5, stopped: "daily_limit", stillDue: 30 });
    expect(fake.posts).toHaveLength(1);
  });

  it("stops when a round sends nothing (the rest failed), listing each failure once", async () => {
    const failed = [{ id: "a", error: "421 try later" }];
    fake.replies = [reply({ sent: 1, failed, stillDue: 1 }), reply({ sent: 0, failed, stillDue: 1 })];
    expect(await sendReceivedDue("event-1")).toEqual({ sent: 1, failed, stopped: null, stillDue: 1 });
    expect(fake.posts).toHaveLength(2);
  });

  it("says when the function isn't deployed yet", async () => {
    fake.replies = [{ data: null, error: { name: "FunctionsHttpError", message: "404", context: new Response("{}", { status: 404 }) } }];
    const error = await sendReceivedDue("event-1").catch(e => e);
    expect(error).toBeInstanceOf(ReceivedSendError);
    expect(error.message).toBe("The send-received-email function isn't deployed yet, so nothing was sent.");
  });

  it("passes on the function's own message, with what went out before", async () => {
    fake.replies = [
      reply({ sent: 2, stillDue: 5 }),
      { data: null, error: { name: "FunctionsHttpError", message: "403", context: new Response(JSON.stringify({ error: "Only organizers of this event can send these emails for others.", code: "forbidden" }), { status: 403 }) } },
    ];
    const error = await sendReceivedDue("event-1").catch(e => e);
    expect(error.message).toBe("Only organizers of this event can send these emails for others.");
    expect(error.partial.sent).toBe(2);
  });
});
