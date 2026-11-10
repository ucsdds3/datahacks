import { describe, expect, it, vi } from "vitest";
import {
  CONTACT_EMAIL, EVENT_NAME, PORTAL_URL, TIMELINE as COPY, hackerBatch, isDue, receivedEmail, receivedKey, requestScope,
  sendReceivedEmails, type ReceivedApplication, type ReceivedDeps, type ReceivedMessage,
} from "../../supabase/functions/_shared/receivedEmail";
import type { ClaimResult } from "../../supabase/functions/_shared/sendLoop";
import { GENERAL_CONTACT_EMAIL, TIMELINE, applicationBatch } from "@/staff-portal/config";
import { MLH_LINKS } from "@/staff-portal/mlh";
import { DEFAULT_TEMPLATES } from "@/organizer/templates";

vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }));

// The "We've received your application" email (supabase/functions/_shared/receivedEmail.ts):
// its wording, who can ask for it, and that each application gets it once.

const hacker = (extra: Partial<ReceivedApplication> = {}): ReceivedApplication => ({
  id: "11111111-1111-4111-8111-111111111111",
  event_id: "22222222-2222-4222-8222-222222222222",
  user_id: "u1",
  applicant_type: "hacker",
  status: "submitted",
  first_name: "Ada",
  email: "ada@example.com",
  submitted_at: "2026-11-10T18:00:00Z",
  received_emailed_at: null,
  ...extra,
});

describe("what it says", () => {
  it("uses the portal's timeline, contact and portal address (the function keeps copies)", () => {
    expect(COPY.priorityDeadline.getTime()).toBe(TIMELINE.priorityDeadline.getTime());
    expect(COPY.regularDeadline.getTime()).toBe(TIMELINE.regularDeadline.getTime());
    expect(COPY.priorityDecisions).toBe(TIMELINE.priorityDecisions);
    expect(COPY.regularDecisions).toBe(TIMELINE.regularDecisions);
    expect(COPY.eventDates).toEqual(TIMELINE.eventDates);
    expect(CONTACT_EMAIL).toBe(GENERAL_CONTACT_EMAIL);
    // The decision emails name the event and link the portal the same way.
    expect(DEFAULT_TEMPLATES["accepted:hacker"].subject).toContain(EVENT_NAME);
    expect(DEFAULT_TEMPLATES["accepted:hacker"].body).toContain(PORTAL_URL.replace(/\/$/, ""));
  });

  it("a hacker who applied by the priority deadline: the whole email", () => {
    const email = receivedEmail(hacker());
    expect(email.subject).toBe("We've received your DataHacks 2027 application");
    expect(email.text).toBe(
      "Hi Ada,\n\n" +
      "Thanks for applying to DataHacks 2027! We've received your hacker application.\n\n" +
      "DataHacks 2027 is Saturday–Sunday, January 16–17, 2027, at UC San Diego.\n\n" +
      "What happens next: you applied by the priority deadline (November 29, 11:59 PM Pacific), so you'll hear back from us by mid-December.\n\n" +
      "You can check your application's status anytime on the portal:\nhttps://datahacks.ds3ucsd.com/portal/\n\n" +
      "Your answers can't be changed now that you've submitted. If something needs fixing, or you have a question, email us at info@ds3.club.\n\n" +
      "The DataHacks team\nData Science Student Society at UC San Diego\ninfo@ds3.club",
    );
    expect(email.html).toContain('<a href="https://datahacks.ds3ucsd.com/portal/">https://datahacks.ds3ucsd.com/portal/</a>');
    expect(email.html).toContain('<a href="mailto:info@ds3.club">info@ds3.club</a>');
    expect(email.html).toMatch(/^<div style="font-family: sans-serif; line-height: 1.5"><p>Hi Ada,<\/p>/);
  });

  it("a hacker who applied after it: reviewed after the final deadline", () => {
    const email = receivedEmail(hacker({ submitted_at: "2026-12-05T20:00:00Z" }));
    expect(email.text).toContain(
      "What happens next: you applied after the priority deadline (November 29, 11:59 PM Pacific), so we'll review your application " +
      "after applications close on December 15, 11:59 PM Pacific, and you'll hear back from us by the end of December.",
    );
    expect(email.text).not.toContain("mid-December");
  });

  it("puts each hacker in the batch the portal shows, by Pacific time", () => {
    const cases = [
      "2026-11-30T07:59:59Z", // 11:59:59 PM Pacific on Nov 29: priority
      "2026-11-30T08:00:00Z", // midnight Pacific: regular, though it's still Nov 29 in Hawaii
      "2026-11-03T17:00:00Z",
      "2026-12-15T12:00:00Z",
    ];
    for (const at of cases) expect(hackerBatch(at)).toBe(applicationBatch(at));
    expect(hackerBatch("2026-12-16T09:00:00Z")).toBe("late");
    expect(receivedEmail(hacker({ submitted_at: "2026-12-16T09:00:00Z" })).text)
      .toContain("What happens next: we'll review your application and email you when your decision is out.");
  });

  it.each([
    ["mentor", "We've received your DataHacks 2027 mentor application", "When we'd need you: Saturday, January 16, 2027 · mentoring 12:30–4:30 PM."],
    ["judge", "We've received your DataHacks 2027 judge application", "When we'd need you: Sunday, January 17, 2027."],
    ["hybrid", "We've received your DataHacks 2027 mentor and judge application", "When we'd need you: Saturday–Sunday, January 16–17, 2027 (mentoring Saturday, judging Sunday)."],
  ])("a %s: their role, their dates, and what their review promises", (type, subject, dates) => {
    const email = receivedEmail(hacker({ applicant_type: type, first_name: "Grace" }));
    expect(email.subject).toBe(subject);
    expect(email.text).toContain(dates);
    expect(email.text).toContain(`We've received your ${subject.split("2027 ")[1]}.`);
    expect(email.text).toContain("our mentor and judge coordinators review every application, and we'll email you when your decision is out.");
    expect(email.text).not.toMatch(/priority|December/);
    expect(email.text).toContain(PORTAL_URL);
  });

  it("mentions MLH only for hackers, and only while MLH's switch is on", () => {
    expect(receivedEmail(hacker()).text).not.toMatch(/MLH|Major League/);
    const on = receivedEmail(hacker(), { mlh: true });
    expect(on.text).toContain("Major League Hacking (MLH) Member Event");
    expect(on.text).toContain(MLH_LINKS.codeOfConduct);
    expect(on.html).toContain(`<a href="${MLH_LINKS.codeOfConduct}">`);
    expect(receivedEmail(hacker({ applicant_type: "mentor" }), { mlh: true }).text).not.toMatch(/MLH/);
  });

  it("treats the name as untrusted: one line in the text, escaped in the HTML", () => {
    const email = receivedEmail(hacker({ first_name: "Ada\r\nBcc: everyone@example.com <script>x</script>" }));
    expect(email.text.split("\n")[0]).toBe("Hi Ada Bcc: everyone@example.com <script>x</script>,");
    expect(email.html).toContain("Hi Ada Bcc: everyone@example.com &lt;script&gt;x&lt;/script&gt;,");
    expect(email.html).not.toContain("<script>");
    expect(email.subject).not.toContain("Ada");
    expect(receivedEmail(hacker({ first_name: "  " })).text.startsWith("Hi there,")).toBe(true);
    expect(receivedEmail(hacker({ first_name: null })).text.startsWith("Hi there,")).toBe(true);
  });
});

describe("who can ask for it", () => {
  const staffOf = (...events: string[]) => vi.fn(async (eventId: string) => events.includes(eventId));
  const EVENT = "22222222-2222-4222-8222-222222222222";

  it("needs a verified sign-in", async () => {
    expect(await requestScope({}, { userId: null, isStaff: staffOf() })).toMatchObject({ ok: false, status: 401 });
  });

  it("an applicant only ever covers their own applications, whatever the body says", async () => {
    const isStaff = staffOf();
    const answer = await requestScope(
      { to: "victim@example.com", email: "victim@example.com", userId: "u2", applicationId: "x", subject: "Hi", body: "spam" },
      { userId: "u1", isStaff },
    );
    expect(answer).toEqual({ ok: true, scope: { userId: "u1" } });
    expect(await requestScope(null, { userId: "u1", isStaff })).toEqual({ ok: true, scope: { userId: "u1" } });
    expect(isStaff).not.toHaveBeenCalled();
  });

  it("a whole event's only for its organizers", async () => {
    expect(await requestScope({ eventId: EVENT }, { userId: "u1", isStaff: staffOf() })).toMatchObject({ ok: false, status: 403 });
    expect(await requestScope({ eventId: "DH27" }, { userId: "u1", isStaff: staffOf() })).toMatchObject({ ok: false, status: 400 });
    expect(await requestScope({ eventId: EVENT.toUpperCase() }, { userId: "org", isStaff: staffOf(EVENT.toUpperCase()) }))
      .toEqual({ ok: true, scope: { eventId: EVENT } });
  });
});

/** A fake database (email_log as claim_email/finish_email run it) and Gmail. */
function fakeServer(apps: ReceivedApplication[], options: { limit?: number; used?: number; failNext?: string; mlh?: string[] } = {}) {
  const log = new Map<string, "sending" | "sent">();
  const sent: { to: string; message: ReceivedMessage }[] = [];
  let used = options.used ?? 0;
  let failNext = options.failNext ?? null;
  const ready = vi.fn();
  const deps: ReceivedDeps = {
    due: async (scope, limit) => apps
      .filter(a => a.status === "submitted" && !a.received_emailed_at)
      .filter(a => (scope.userId === undefined || a.user_id === scope.userId) && (scope.eventId === undefined || a.event_id === scope.eventId))
      .slice(0, limit),
    profileEmails: async ids => new Map(ids.map(id => [id, `${id}@login.example.com`])),
    mlhEvents: async ids => new Set(ids.filter(id => options.mlh?.includes(id))),
    ready,
    claim: async (app): Promise<ClaimResult> => {
      const key = receivedKey(app.id);
      if (log.get(key) === "sent" || app.received_emailed_at) return "sent";
      if (log.get(key) === "sending") return "busy";
      if (used >= (options.limit ?? 1800)) return "quota";
      used++;
      log.set(key, "sending");
      return "claimed";
    },
    deliver: async (to, message) => {
      await new Promise(resolve => setTimeout(resolve, 5));
      if (failNext) {
        const error = failNext;
        failNext = null;
        throw new Error(error);
      }
      sent.push({ to, message });
    },
    finish: async (app, ok) => {
      const key = receivedKey(app.id);
      if (ok) {
        log.set(key, "sent");
        app.received_emailed_at = new Date().toISOString();
      } else {
        log.delete(key);
        used--;
      }
    },
  };
  return { deps, sent, ready, log };
}

const run = (deps: ReceivedDeps, scope: Parameters<typeof sendReceivedEmails>[1]) =>
  sendReceivedEmails(deps, scope, { startedAt: Date.now(), budgetMs: 60_000, delayMs: 0 });

describe("one email per application", () => {
  it("sends it to the address on the application and marks it, so asking again sends nothing", async () => {
    const app = hacker();
    const server = fakeServer([app]);
    expect((await run(server.deps, { userId: "u1" })).sent).toEqual([app.id]);
    expect(server.sent).toHaveLength(1);
    expect(server.sent[0].to).toBe("ada@example.com");
    expect(server.sent[0].message.subject).toBe("We've received your DataHacks 2027 application");
    expect(app.received_emailed_at).not.toBeNull();
    // The form's request, then the portal's fallback, a retry, another tab: nothing more.
    for (let i = 0; i < 3; i++) expect((await run(server.deps, { userId: "u1" })).due).toBe(0);
    expect(server.sent).toHaveLength(1);
  });

  it("two requests at the same moment (a double click, two tabs) send it once", async () => {
    const server = fakeServer([hacker()]);
    const [a, b] = await Promise.all([run(server.deps, { userId: "u1" }), run(server.deps, { userId: "u1" })]);
    expect(server.sent).toHaveLength(1);
    expect([...a.sent, ...b.sent]).toHaveLength(1);
    expect([...a.skipped, ...b.skipped]).toEqual([{ id: hacker().id, reason: "in_progress" }]);
  });

  it("only ever the caller's own, even if the database answered with someone else's", async () => {
    const mine = hacker();
    const theirs = hacker({ id: "33333333-3333-4333-8333-333333333333", user_id: "u2", email: "u2@example.com" });
    const server = fakeServer([mine, theirs]);
    server.deps.due = async () => [mine, theirs];
    await run(server.deps, { userId: "u1" });
    expect(server.sent.map(s => s.to)).toEqual(["ada@example.com"]);
    expect(theirs.received_emailed_at).toBeNull();
  });

  it("skips drafts, decided applications and anyone already emailed (or marked as not needing it)", async () => {
    expect(isDue(hacker())).toBe(true);
    for (const app of [hacker({ status: "draft" }), hacker({ status: "accepted" }), hacker({ received_emailed_at: "2026-11-09T00:00:00Z" })]) {
      const server = fakeServer([app]);
      server.deps.due = async () => [app];
      expect(isDue(app)).toBe(false);
      expect((await run(server.deps, { userId: "u1" })).due).toBe(0);
      expect(server.sent).toHaveLength(0);
      expect(server.ready).not.toHaveBeenCalled();
    }
  });

  it("a Gmail failure marks nothing, so the next request (the portal's fallback) sends it", async () => {
    const app = hacker();
    const server = fakeServer([app], { failNext: "421 4.7.0 Try again later" });
    const first = await run(server.deps, { userId: "u1" });
    expect(first.sent).toEqual([]);
    expect(first.failed).toEqual([{ id: app.id, error: "421 4.7.0 Try again later" }]);
    expect(app.received_emailed_at).toBeNull();
    expect((await run(server.deps, { userId: "u1" })).sent).toEqual([app.id]);
    expect(server.sent).toHaveLength(1);
  });

  it("at the daily limit it waits: nothing sent, nothing marked, still due", async () => {
    const app = hacker();
    const server = fakeServer([app], { limit: 1800, used: 1800 });
    const result = await run(server.deps, { userId: "u1" });
    expect(result.stopped).toBe("daily_limit");
    expect(result.remaining).toEqual([app.id]);
    expect(server.sent).toHaveLength(0);
    expect(isDue(app)).toBe(true);
  });

  it("checks email is configured before claiming anything", async () => {
    const app = hacker();
    const server = fakeServer([app]);
    server.ready.mockImplementation(() => { throw new Error("missing GMAIL_APP_PASSWORD"); });
    await expect(run(server.deps, { userId: "u1" })).rejects.toThrow("GMAIL_APP_PASSWORD");
    expect(server.log.size).toBe(0);
  });

  it("falls back to the sign-in email on the profile, and refuses anything that isn't one plain address", async () => {
    const noEmail = hacker({ email: null });
    const bad = hacker({ id: "44444444-4444-4444-8444-444444444444", user_id: "u1", email: "a@example.com, b@example.com" });
    const server = fakeServer([noEmail, bad]);
    const result = await run(server.deps, { userId: "u1" });
    expect(server.sent.map(s => s.to)).toEqual(["u1@login.example.com"]);
    expect(result.failed).toEqual([{ id: bad.id, error: "The email address on file isn't a single plain address." }]);
    expect(server.log.has(receivedKey(bad.id))).toBe(false);
  });

  it("an organizer's request covers everyone due in that event, and MLH follows each event's switch", async () => {
    const event = "22222222-2222-4222-8222-222222222222";
    const apps = [
      hacker({ id: "55555555-5555-4555-8555-555555555551", user_id: "a", email: "a@example.com" }),
      hacker({ id: "55555555-5555-4555-8555-555555555552", user_id: "b", email: "b@example.com", applicant_type: "judge" }),
      hacker({ id: "55555555-5555-4555-8555-555555555553", user_id: "c", email: "c@example.com", event_id: "another-event" }),
    ];
    const server = fakeServer(apps, { mlh: [event] });
    const result = await run(server.deps, { eventId: event });
    expect(result.sent).toHaveLength(2);
    expect(server.sent.map(s => s.to)).toEqual(["a@example.com", "b@example.com"]);
    expect(server.sent[0].message.text).toContain("MLH");
    expect(server.sent[1].message.text).not.toContain("MLH");
    expect(apps[2].received_emailed_at).toBeNull();
  });
});
