import { beforeEach, describe, expect, it, vi } from "vitest";

// What the console asks send-email for, and what the function answers.
const fake = vi.hoisted(() => ({
  calls: [] as Record<string, unknown>[],
  answer: (_body: Record<string, unknown>, _n: number): { data: unknown; error: unknown } => ({ data: null, error: null }),
}));
vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    functions: {
      invoke: async (_name: string, { body }: { body: Record<string, unknown> }) => {
        fake.calls.push(body);
        return fake.answer(body, fake.calls.length);
      },
    },
  },
}));
vi.mock("@/portal/event", () => ({ currentEventId: async () => "event-1" }));

import { EMAIL_CHUNK, SendError, sendEmails } from "./data";
import { errorText } from "./errors";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
const ok = (body: Record<string, unknown>) => ({ data: { sent: (body.applicationIds as string[]).length, skipped: [], failed: [], remaining: [], stopped: null }, error: null });
const httpError = (status: number, json: unknown = null) => ({
  data: null,
  error: Object.assign(new Error("Edge Function returned a non-2xx status code"), {
    name: "FunctionsHttpError",
    context: { status, json: async () => { if (json === null) throw new Error("no body"); return json; }, clone() { return this; } },
  }),
});

beforeEach(() => {
  fake.calls.length = 0;
  fake.answer = ok;
});

describe("sendEmails", () => {
  it("sends 40 per request (inside the function's 150 s limit)", async () => {
    const all = ids(100);
    const progress: number[] = [];
    const result = await sendEmails("event-1", all, "Hi", "Body", "decision", n => progress.push(n), { expectStatus: "accepted" });
    expect(EMAIL_CHUNK).toBe(40);
    expect(fake.calls.map(c => (c.applicationIds as string[]).length)).toEqual([40, 40, 20]);
    expect(fake.calls.every(c => c.kind === "decision" && c.expectStatus === "accepted")).toBe(true);
    expect(progress).toEqual([40, 80, 100]);
    expect(result.sent).toBe(100);
  });

  it("sends whoever a time-boxed request didn't reach in the next request", async () => {
    const all = ids(50);
    fake.answer = (body, n) => {
      const asked = body.applicationIds as string[];
      return n === 1
        ? { data: { sent: 30, skipped: [], failed: [], remaining: asked.slice(30), stopped: "time" }, error: null }
        : ok(body);
    };
    const result = await sendEmails("event-1", all, "Hi", "Body", "blast");
    expect(fake.calls.map(c => c.applicationIds)).toEqual([all.slice(0, 40), [...all.slice(30, 40), ...all.slice(40)]]);
    expect(result.sent).toBe(50);
  });

  it("reports people who already had it as skipped, not sent", async () => {
    fake.answer = body => ({ data: { sent: 1, skipped: [{ id: (body.applicationIds as string[])[0], reason: "already_sent" }], failed: [], remaining: [] }, error: null });
    const result = await sendEmails("event-1", ids(2), "Hi", "Body", "decision");
    expect(result).toMatchObject({ sent: 1, skipped: [{ reason: "already_sent" }] });
  });

  it("stops at Gmail's daily limit and lists who's left, without more requests", async () => {
    const all = ids(100);
    fake.answer = body => ({ data: { sent: 3, skipped: [], failed: [], remaining: (body.applicationIds as string[]).slice(3), stopped: "daily_limit", quota: { used: 1800, limit: 1800, remaining: 0 } }, error: null });
    const result = await sendEmails("event-1", all, "Hi", "Body", "blast");
    expect(fake.calls).toHaveLength(1);
    expect(result).toMatchObject({ sent: 3, stopped: "daily_limit", quota: { remaining: 0 } });
    expect(result.notSent).toEqual(all.slice(3));
  });

  it("on a failure partway, says what went out and who wasn't tried", async () => {
    fake.answer = (body, n) => (n === 1 ? ok(body) : { data: null, error: Object.assign(new Error("Failed to send a request to the Edge Function"), { name: "FunctionsFetchError", context: {} }) });
    const all = ids(60);
    const error = await sendEmails("event-1", all, "Hi", "Body", "decision").catch(e => e);
    expect(error).toBeInstanceOf(SendError);
    expect(error.partial.sent).toBe(40);
    expect(error.partial.notSent).toEqual(all.slice(40));
    expect(error.message).toMatch(/Couldn't reach the email service.*sending again only reaches the rest/);
    expect(error.message).not.toMatch(/isn't set up/);
  });

  it("only calls a 404 'not set up'", async () => {
    fake.answer = () => httpError(404);
    expect((await sendEmails("event-1", ids(1), "Hi", "Body", "blast").catch(e => e)).message).toMatch(/isn't set up yet: the send-email function isn't deployed/);
  });

  it("shows the function's own error text (never raw database errors, which it doesn't send)", async () => {
    fake.answer = () => httpError(503, { error: "Email isn't configured on the server yet (missing the GMAIL_ADDRESS secret). Nothing was sent.", code: "not_configured" });
    const error = await sendEmails("event-1", ids(1), "Hi", "Body", "blast").catch(e => e);
    expect(error.message).toBe("Email isn't configured on the server yet (missing the GMAIL_ADDRESS secret). Nothing was sent.");
    expect(error.code).toBe("not_configured");
  });

  it("calls a gateway timeout a timeout, and says retrying is safe", async () => {
    fake.answer = () => httpError(504);
    expect((await sendEmails("event-1", ids(1), "Hi", "Body", "blast").catch(e => e)).message).toMatch(/took too long.*recorded, so sending again only reaches people who haven't had one/);
  });

  it("gives up after three requests in a row that get nowhere", async () => {
    fake.answer = body => ({ data: { sent: 0, skipped: [], failed: [], remaining: body.applicationIds, stopped: "time" }, error: null });
    const error = await sendEmails("event-1", ids(5), "Hi", "Body", "blast").catch(e => e);
    expect(error).toBeInstanceOf(SendError);
    expect(fake.calls).toHaveLength(3);
  });
});

describe("errorText", () => {
  it("finds the message in Supabase's plain error objects instead of [object Object]", () => {
    expect(errorText({ message: "Not authorized", code: "P0001", details: null })).toBe("Not authorized (P0001)");
    expect(errorText(new Error("boom"))).toBe("boom");
    expect(errorText({ weird: true })).toBe('{"weird":true}');
    expect(errorText(null)).toMatch(/Something went wrong/);
  });
});
