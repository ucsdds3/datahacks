import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// A fake Supabase: rpc answers from `fake.rpcs`, functions.invoke records what
// send-email and send-wallet-passes were asked to do, and table updates are recorded.
const fake = vi.hoisted(() => ({
  rpcCalls: [] as { name: string; args: Record<string, unknown> }[],
  rpcs: {} as Record<string, (args: Record<string, unknown>) => unknown>,
  invokes: [] as { name: string; body?: Record<string, unknown>; method?: string }[],
  updates: [] as { table: string; value: unknown; in?: unknown[]; eq: [string, unknown][] }[],
  emailFails: [] as string[],
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    rpc: async (name: string, args: Record<string, unknown>) => {
      fake.rpcCalls.push({ name, args });
      const answer = fake.rpcs[name];
      if (!answer) return { data: null, error: new Error(`no fake for ${name}`) };
      try {
        return { data: answer(args), error: null };
      } catch (e) {
        return { data: null, error: e };
      }
    },
    functions: {
      invoke: async (name: string, { body, method }: { body?: Record<string, unknown>; method?: string }) => {
        fake.invokes.push({ name, body, method });
        if (method === "GET") return { data: { applicationIds: true }, error: null };
        if (name === "send-email") {
          const ids = body!.applicationIds as string[];
          const failed = ids.filter(id => fake.emailFails.includes(id)).map(id => ({ id, error: "bounced" }));
          return { data: { sent: ids.length - failed.length, failed }, error: null };
        }
        const ids = body!.applicationIds as string[];
        return { data: { sent: ids.length, failed: [], remaining: 0 }, error: null };
      },
    },
    from: (table: string) => {
      const record = { table, value: undefined as unknown, in: undefined as unknown[] | undefined, eq: [] as [string, unknown][] };
      let read = false;
      const builder = {
        // Reads (the Meals & swag card's scan_types) answer as a database without that table.
        select: () => { read = true; return builder; },
        order: () => builder,
        update: (value: unknown) => { record.value = value; return builder; },
        upsert: (value: unknown) => { record.value = value; return builder; },
        in: (_c: string, values: unknown[]) => { record.in = values; return builder; },
        eq: (c: string, v: unknown) => { record.eq.push([c, v]); return builder; },
        then: (resolve: (v: unknown) => unknown) => {
          if (read) return Promise.resolve({ data: null, error: { code: "PGRST205", message: `Could not find the table 'public.${table}'` } }).then(resolve);
          fake.updates.push(record);
          return Promise.resolve({ data: null, error: null }).then(resolve);
        },
      };
      return builder;
    },
  },
}));
vi.mock("@/portal/event", () => ({ currentEventId: async () => "event-1", EVENT_CODE: "DH27" }));

import DayOfPage from "./DayOfPage";
import {
  emailOffers, fromEventInput, markable, nextOffers, openAfterMarking, phaseOf, toEventInput, unemailedOffers, withDeadline,
  type Overview,
} from "./dayOf";
import { SPOT_OFFER_TEMPLATE } from "./templates";

const NOW = "2027-01-16T20:30:00.000Z"; // 12:30 PM Pacific

const overview = (extra: Partial<Overview> = {}): Overview => ({
  now: NOW,
  settings: {
    hacker_capacity: 10,
    checkin_cutoff_at: "2027-01-16T20:00:00.000Z", // 12:00 PM
    ucsd_checkin_cutoff_at: "2027-01-16T18:30:00.000Z", // 10:30 AM
    offer_window_minutes: 60,
  },
  checked_in: 6,
  expected: 4,
  open_spots: 0,
  waitlisted: 5,
  absent: [
    { application_id: "a1", name: "Ava Late", email: "ava@x.edu", code: "DH27-H001", ucsd: true, deadline: "2027-01-16T18:30:00.000Z", past_deadline: true, offered_at: null },
    { application_id: "a2", name: "Ben Late", email: "ben@x.edu", code: "DH27-H002", ucsd: false, deadline: "2027-01-16T20:00:00.000Z", past_deadline: true, offered_at: null },
    { application_id: "a3", name: "Cy Offered", email: "cy@x.edu", code: "DH27-H003", ucsd: false, deadline: "2027-01-16T21:00:00.000Z", past_deadline: false, offered_at: "2027-01-16T20:00:00.000Z" },
    { application_id: "a4", name: "Di Coming", email: "di@x.edu", code: "DH27-H004", ucsd: false, deadline: "2027-01-16T21:30:00.000Z", past_deadline: false, offered_at: null },
  ],
  no_shows: [],
  queue: [
    { application_id: "w1", name: "First Inline", email: "w1@x.edu", submitted_at: "2026-12-01T00:00:00Z", opted_in_at: "2027-01-10T00:00:00Z" },
    { application_id: "w2", name: "Second Inline", email: "w2@x.edu", submitted_at: "2026-12-02T00:00:00Z", opted_in_at: "2027-01-01T00:00:00Z" },
    { application_id: "w3", name: "Third Inline", email: "w3@x.edu", submitted_at: "2026-12-03T00:00:00Z", opted_in_at: "2027-01-02T00:00:00Z" },
  ],
  offers: [],
  ...extra,
});

beforeEach(() => {
  fake.rpcCalls.length = 0;
  fake.invokes.length = 0;
  fake.updates.length = 0;
  fake.emailFails = [];
  fake.rpcs = {};
});

describe("capacity math", () => {
  it("counts who Mark no-shows would mark: past their deadline only", () => {
    expect(markable(overview()).map(a => a.application_id)).toEqual(["a1", "a2"]);
  });

  it("opens their spots once marked: capacity - checked in - those still expected", () => {
    // 10 - 6 - (4 expected - 2 marked) = 2
    expect(openAfterMarking(overview())).toBe(2);
    expect(openAfterMarking(overview({ settings: { ...overview().settings, hacker_capacity: 7 } }))).toBe(0);
    expect(openAfterMarking(overview({ settings: { ...overview().settings, hacker_capacity: null } }))).toBeNull();
  });

  it("offers exactly the front of the queue, one per open spot, never more", () => {
    expect(nextOffers(overview({ open_spots: 0 }))).toEqual([]);
    expect(nextOffers(overview({ open_spots: 2 })).map(q => q.name)).toEqual(["First Inline", "Second Inline"]);
    expect(nextOffers(overview({ open_spots: 50 }))).toHaveLength(3);
    expect(nextOffers(overview({ open_spots: null }))).toEqual([]);
  });

  it("knows when check-in has closed for anyone yet", () => {
    expect(phaseOf(overview())).toBe("after-cutoff");
    expect(phaseOf(overview(), new Date("2027-01-16T18:00:00Z"))).toBe("before-cutoff");
    // The UCSD cutoff alone is enough to start marking.
    expect(phaseOf(overview(), new Date("2027-01-16T19:00:00Z"))).toBe("after-cutoff");
    expect(phaseOf(overview({ settings: { ...overview().settings, checkin_cutoff_at: null } }))).toBe("no-settings");
  });

  it("lists offers whose email didn't go out", () => {
    const offer = { application_id: "o", name: "O", email: null, code: "C", offered_at: NOW, expires_at: NOW, emailed_at: null, checked_in_at: null, no_show_at: null };
    expect(unemailedOffers(overview({ offers: [offer, { ...offer, application_id: "p", emailed_at: NOW }, { ...offer, application_id: "q", checked_in_at: NOW }] })).map(x => x.application_id)).toEqual(["o"]);
  });
});

describe("event time", () => {
  it("reads and writes datetime-local values as Pacific time, either side of DST", () => {
    expect(fromEventInput("2027-01-16T10:30")).toBe("2027-01-16T18:30:00.000Z");
    expect(fromEventInput("2027-04-17T12:00")).toBe("2027-04-17T19:00:00.000Z");
    expect(toEventInput("2027-01-16T18:30:00.000Z")).toBe("2027-01-16T10:30");
    expect(toEventInput(fromEventInput("2027-03-14T09:15"))).toBe("2027-03-14T09:15");
    expect(fromEventInput("")).toBeNull();
    expect(toEventInput(null)).toBe("");
  });
});

describe("the spot-opened email", () => {
  it("fills the deadline in event time and keeps the rest for send-email", () => {
    const t = withDeadline(SPOT_OFFER_TEMPLATE, "2027-01-16T21:05:00.000Z");
    expect(t.subject).toBe("A spot opened up at DataHacks 2027: check in by 1:05 PM");
    expect(t.body).toContain("Please check in by 1:05 PM.");
    expect(t.body).toContain("{{first_name}}");
    expect(t.body).toContain("{{code}}");
    expect(t.body).not.toContain("{{deadline}}");
  });

  it("emails first, then sends passes only to people the email reached, and records who got it", async () => {
    fake.emailFails = ["w2"];
    const out = await emailOffers("event-1", [
      { application_id: "w1", expires_at: "2027-01-16T21:30:00.000Z" },
      { application_id: "w2", expires_at: "2027-01-16T21:30:00.000Z" },
    ], SPOT_OFFER_TEMPLATE);
    const posts = fake.invokes.filter(i => i.method !== "GET");
    expect(posts.map(i => i.name)).toEqual(["send-email", "send-wallet-passes"]);
    expect(posts[0].body).toMatchObject({ eventId: "event-1", applicationIds: ["w1", "w2"], kind: "decision" });
    expect(posts[0].body!.subject).toBe("A spot opened up at DataHacks 2027: check in by 1:30 PM");
    expect(posts[1].body).toMatchObject({ eventId: "event-1", applicationIds: ["w1"] });
    expect(fake.updates).toEqual([expect.objectContaining({ table: "applications", in: ["w1"], eq: [["event_id", "event-1"]] })]);
    expect(out).toMatchObject({ emailed: 1, passesSent: 1, emailError: null });
    expect(out.emailFailed).toEqual([{ id: "w2", error: "bounced" }]);
  });
});

function renderPage(o: Overview) {
  let current = o;
  fake.rpcs.waitlist_overview = () => current;
  const set = (next: Overview) => { current = next; };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><DayOfPage eventId="event-1" onChanged={() => {}} /></QueryClientProvider>);
  return set;
}

describe("Day-of page", () => {
  it("shows the counts and who is past their deadline", async () => {
    renderPage(overview());
    expect(await screen.findByText("Checked in")).toBeTruthy();
    const noShows = screen.getByRole("region", { name: "No-shows" });
    expect(within(noShows).getByText("Ava Late")).toBeTruthy();
    expect(within(noShows).getByText("Ben Late")).toBeTruthy();
    expect(within(noShows).queryByText("Di Coming")).toBeNull();
    expect(within(noShows).getByText(/2 open after/)).toBeTruthy();
    // No open spots yet, so nothing to offer.
    expect((screen.getByRole("button", { name: "Offer 0 spots" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("marks no-shows only after confirming, and can undo", async () => {
    renderPage(overview());
    fake.rpcs.mark_no_shows = () => [{ application_id: "a1", name: "Ava Late" }, { application_id: "a2", name: "Ben Late" }];
    fake.rpcs.unmark_no_shows = () => 2;
    fireEvent.click(await screen.findByRole("button", { name: "Mark 2 no-shows" }));
    expect(fake.rpcCalls.some(c => c.name === "mark_no_shows")).toBe(false);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark 2 no-shows" }));
    await screen.findByText("Marked 2 no-shows.");
    expect(fake.rpcCalls.find(c => c.name === "mark_no_shows")!.args).toEqual({ p_event_id: "event-1" });
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(fake.rpcCalls.find(c => c.name === "unmark_no_shows")?.args).toEqual({ p_event_id: "event-1", p_application_ids: ["a1", "a2"] }));
  });

  it("offers exactly the next people in line, then emails them and sends passes", async () => {
    renderPage(overview({ open_spots: 2, expected: 2, absent: [] }));
    fake.rpcs.offer_waitlist_spots = args => [
      { application_id: "w1", name: "First Inline", email: "w1@x.edu", code: "DH27-H010", offer_expires_at: "2027-01-16T21:30:00.000Z" },
      { application_id: "w2", name: "Second Inline", email: "w2@x.edu", code: "DH27-H011", offer_expires_at: "2027-01-16T21:30:00.000Z" },
    ].slice(0, args.p_count as number);

    const waitlist = await screen.findByRole("region", { name: "Waitlist" });
    expect(within(waitlist).getByText("First Inline")).toBeTruthy();
    expect(within(waitlist).getByText("Second Inline")).toBeTruthy();
    fireEvent.click(within(waitlist).getByRole("button", { name: "Offer 2 spots" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("listitem").map(li => li.textContent)).toEqual(["First Inline w1@x.edu", "Second Inline w2@x.edu"]);
    expect(within(dialog).getByText("1:30 PM")).toBeTruthy();
    expect(fake.rpcCalls.some(c => c.name === "offer_waitlist_spots")).toBe(false);
    fireEvent.click(within(dialog).getByRole("button", { name: "Offer 2 spots & email" }));

    await screen.findByText("Gave 2 spots: First Inline, Second Inline.");
    expect(fake.rpcCalls.find(c => c.name === "offer_waitlist_spots")!.args).toEqual({ p_event_id: "event-1", p_count: 2 });
    const posts = fake.invokes.filter(i => i.method !== "GET");
    expect(posts.map(p => p.name)).toEqual(["send-email", "send-wallet-passes"]);
    expect(posts[0].body!.applicationIds).toEqual(["w1", "w2"]);
  });

  it("asks for settings first when there are none", async () => {
    renderPage(overview({ settings: { hacker_capacity: null, checkin_cutoff_at: null, ucsd_checkin_cutoff_at: null, offer_window_minutes: 60 }, open_spots: null }));
    expect(await screen.findByText(/Set a capacity and check-in cutoff/)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "No-shows" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Hacker capacity"), { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("Check-in closes (Pacific)"), { target: { value: "2027-01-16T12:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await screen.findByText("Saved.");
    expect(fake.updates[0]).toMatchObject({
      table: "event_day_settings",
      value: { event_id: "event-1", hacker_capacity: 500, checkin_cutoff_at: "2027-01-16T20:00:00.000Z", ucsd_checkin_cutoff_at: null, offer_window_minutes: 60 },
    });
  });
});
