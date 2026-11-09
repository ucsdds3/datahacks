import { beforeEach, describe, expect, it, vi } from "vitest";
import { emailKeys, isDailyLimitError, runSendLoop, type ClaimResult } from "../../supabase/functions/_shared/sendLoop";

// The edge functions' send loop, against a fake email_log and a fake SMTP server.
type Job = { id: string };
const jobs = (n: number): Job[] => Array.from({ length: n }, (_, i) => ({ id: `p${i}` }));

/** A fake email_log: claim/finish like the SQL functions, with a daily limit. */
function fakeLog(limit = 1800, used = 0) {
  const state = new Map<string, "sending" | "sent">();
  let count = used;
  return {
    state,
    get used() { return count; },
    claim: async (j: Job): Promise<ClaimResult> => {
      const s = state.get(j.id);
      if (s === "sent") return "sent";
      if (s === "sending") return "busy";
      if (count >= limit) return "quota";
      count++;
      state.set(j.id, "sending");
      return "claimed";
    },
    finish: async (j: Job, ok: boolean) => {
      if (ok) state.set(j.id, "sent");
      else { state.delete(j.id); count--; }
    },
  };
}

let clock = 0;
const now = () => clock;
const sleep = async (ms: number) => { clock += ms; };

beforeEach(() => { clock = 0; });

describe("runSendLoop", () => {
  it("marks each person sent straight after their email, before the next one", async () => {
    const log = fakeLog();
    const order: string[] = [];
    const result = await runSendLoop(jobs(3), {
      claim: log.claim,
      deliver: async j => { order.push(`smtp ${j.id}`); },
      finish: async (j, ok) => { order.push(`marked ${j.id}`); await log.finish(j, ok); },
    }, { startedAt: 0, budgetMs: 90_000, delayMs: 1000, now, sleep });
    expect(order).toEqual(["smtp p0", "marked p0", "smtp p1", "marked p1", "smtp p2", "marked p2"]);
    expect(result).toMatchObject({ sent: ["p0", "p1", "p2"], remaining: [], stopped: null });
  });

  it("stops starting new emails when its time is up and hands back the rest; the retry never re-emails anyone", async () => {
    const log = fakeLog();
    const smtp = vi.fn(async () => { clock += 2_000; });
    const hooks = { claim: log.claim, deliver: smtp, finish: log.finish };
    // 40 people at ~3 s each don't fit in a 90 s budget.
    const first = await runSendLoop(jobs(40), hooks, { startedAt: 0, budgetMs: 90_000, delayMs: 1000, now, sleep });
    expect(first.stopped).toBe("time");
    expect(first.sent.length).toBeGreaterThan(25);
    expect(first.sent.length + first.remaining.length).toBe(40);
    expect(first.remaining[0]).toBe(`p${first.sent.length}`);

    // The console sends everyone again (say, after a reload): only the rest go out.
    clock = 0;
    smtp.mockClear();
    const second = await runSendLoop(jobs(40), hooks, { startedAt: 0, budgetMs: 90_000, delayMs: 1000, now, sleep });
    expect(second.sent).toEqual(first.remaining);
    expect(second.skipped).toHaveLength(first.sent.length);
    expect(second.skipped.every(s => s.reason === "already_sent")).toBe(true);
    expect(smtp).toHaveBeenCalledTimes(first.remaining.length);
  });

  it("killed mid-batch: everyone emailed before the kill is already marked", async () => {
    const log = fakeLog();
    let delivered = 0;
    // The 6th send never finishes: from the database's side, the request just stops there.
    const run = runSendLoop(jobs(10), {
      claim: log.claim,
      deliver: async () => { if (++delivered === 6) await new Promise(() => {}); },
      finish: log.finish,
    }, { startedAt: 0, budgetMs: 90_000, delayMs: 0, now, sleep });
    void run;
    await new Promise(resolve => setTimeout(resolve, 10));
    expect([...log.state].filter(([, s]) => s === "sent").map(([id]) => id)).toEqual(["p0", "p1", "p2", "p3", "p4"]);
  });

  it("skips someone another organizer is sending to right now", async () => {
    const log = fakeLog();
    log.state.set("p1", "sending");
    const result = await runSendLoop(jobs(3), { claim: log.claim, deliver: async () => {}, finish: log.finish }, { startedAt: 0, budgetMs: 90_000, delayMs: 0, now, sleep });
    expect(result.sent).toEqual(["p0", "p2"]);
    expect(result.skipped).toEqual([{ id: "p1", reason: "in_progress" }]);
  });

  it("stops at the daily limit and returns who's left", async () => {
    const log = fakeLog(1800, 1798);
    const result = await runSendLoop(jobs(5), { claim: log.claim, deliver: async () => {}, finish: log.finish }, { startedAt: 0, budgetMs: 90_000, delayMs: 0, now, sleep });
    expect(result).toMatchObject({ sent: ["p0", "p1"], remaining: ["p2", "p3", "p4"], stopped: "daily_limit" });
    expect(log.used).toBe(1800);
  });

  it("stops when Gmail itself says the account hit its limit, and frees that person for a retry", async () => {
    const log = fakeLog();
    const result = await runSendLoop(jobs(4), {
      claim: log.claim,
      deliver: async j => { if (j.id === "p1") throw new Error("550 5.4.5 Daily user sending limit exceeded."); },
      finish: log.finish,
    }, { startedAt: 0, budgetMs: 90_000, delayMs: 0, now, sleep });
    expect(result).toMatchObject({ sent: ["p0"], remaining: ["p2", "p3"], stopped: "daily_limit" });
    expect(result.failed).toEqual([{ id: "p1", error: "550 5.4.5 Daily user sending limit exceeded." }]);
    expect(log.state.has("p1")).toBe(false);
  });

  it("reports a bounced address with Gmail's words and carries on", async () => {
    const log = fakeLog();
    const result = await runSendLoop(jobs(3), {
      claim: log.claim,
      deliver: async j => { if (j.id === "p1") throw new Error("553 5.1.3 The recipient address is not a valid RFC 5321 address\r\nBcc: x"); },
      finish: log.finish,
    }, { startedAt: 0, budgetMs: 90_000, delayMs: 0, now, sleep });
    expect(result.sent).toEqual(["p0", "p2"]);
    expect(result.failed[0].error).toBe("553 5.1.3 The recipient address is not a valid RFC 5321 address Bcc: x");
  });

  it("doesn't send when the claim can't be recorded", async () => {
    const deliver = vi.fn(async () => {});
    const result = await runSendLoop(jobs(1), {
      claim: async () => { throw new Error("connection refused"); },
      deliver,
      finish: async () => {},
    }, { startedAt: 0, budgetMs: 90_000, delayMs: 0, now, sleep });
    expect(deliver).not.toHaveBeenCalled();
    expect(result.failed[0].error).toMatch(/wasn't sent/);
  });

  it("counts a sent email as sent even if marking it fails, and says so", async () => {
    const result = await runSendLoop(jobs(1), {
      claim: async () => "claimed",
      deliver: async () => {},
      finish: async () => { throw new Error("db down"); },
    }, { startedAt: 0, budgetMs: 90_000, delayMs: 0, now, sleep });
    expect(result).toMatchObject({ sent: ["p0"], unrecorded: ["p0"] });
  });
});

describe("email keys", () => {
  it("make a new decision email due when the decision is released again", () => {
    expect(emailKeys.decision("a", "2026-12-10T00:00:00Z")).toBe("decision:a:1796860800");
    expect(emailKeys.decision("a", "2027-01-16T20:00:00Z")).not.toBe(emailKeys.decision("a", "2026-12-10T00:00:00Z"));
    expect(emailKeys.pass("t", null, "A@X.com")).toBe("pass:t:never:a@x.com");
  });

  it("recognise Gmail's limit errors", () => {
    expect(isDailyLimitError("550 5.4.5 Daily user sending quota exceeded")).toBe(true);
    expect(isDailyLimitError("550 5.1.1 The email account that you tried to reach does not exist")).toBe(false);
  });
});
