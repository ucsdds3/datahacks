// The send loop shared by send-email and send-wallet-passes. No Deno or npm
// imports, so the site's tests (vitest) can run it with fake claims and SMTP.
//
// For each recipient, in order:
//   1. claim it in public.email_log (claim_email). Already sent: skipped.
//      Someone else sending it right now: skipped. Daily limit reached: stop.
//   2. deliver it (SMTP), and straight after
//   3. finish it (finish_email), which marks the person as emailed in the
//      same database call. So a retry, or a request the platform kills at its
//      150 s limit, never emails anyone twice.
// It stops starting new emails once the time budget is spent and hands back
// the ids it didn't get to, for the caller to send in another request.

export type ClaimResult = "claimed" | "sent" | "busy" | "quota";

export type SendHooks<J> = {
  claim(job: J): Promise<ClaimResult>;
  deliver(job: J): Promise<void>;
  finish(job: J, ok: boolean, error?: string): Promise<void>;
};

export type SendLoopOptions = {
  /** When the request started (ms), from the same clock as now(). */
  startedAt: number;
  /** Stop starting new emails after this many ms since startedAt. */
  budgetMs: number;
  /** Pause between two deliveries (Gmail rate limits). */
  delayMs: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export type SkipReason = "already_sent" | "in_progress";

export type SendLoopResult = {
  sent: string[];
  skipped: { id: string; reason: SkipReason }[];
  failed: { id: string; error: string }[];
  /** Ids not tried in this request: send them again in the next one. */
  remaining: string[];
  /** Why it stopped early: out of time (send the rest again), or the daily limit (try tomorrow). */
  stopped: "time" | "daily_limit" | null;
  /** Sent, but marking them failed: they may show as unsent. */
  unrecorded: string[];
};

/** Gmail's answers when the account has hit its sending limit (550 5.4.5, 421 4.7.0 rate limit). */
export const isDailyLimitError = (message: string) =>
  /\b5\.4\.5\b|daily (user )?sending (quota|limit)|sending limit exceeded/i.test(message);

/** SMTP and API errors, one line and not too long, for the organizer to read. */
export const shortError = (error: unknown) => {
  const text = error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
  // deno-lint-ignore no-control-regex
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x1f\x7f]+/g, " ").trim().slice(0, 300) || "Unknown error";
};

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function runSendLoop<J extends { id: string }>(
  jobs: J[],
  hooks: SendHooks<J>,
  options: SendLoopOptions,
): Promise<SendLoopResult> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const result: SendLoopResult = { sent: [], skipped: [], failed: [], remaining: [], stopped: null, unrecorded: [] };
  let delivered = 0;

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    // Room for one more: the pause plus a slow send still fits under the platform's limit.
    if (now() - options.startedAt >= options.budgetMs) {
      result.remaining = jobs.slice(i).map(j => j.id);
      result.stopped = "time";
      break;
    }

    let claim: ClaimResult;
    try {
      claim = await hooks.claim(job);
    } catch (error) {
      console.error("claim failed", shortError(error));
      result.failed.push({ id: job.id, error: "Couldn't record the send in the database, so it wasn't sent. Try again." });
      continue;
    }
    if (claim === "sent") { result.skipped.push({ id: job.id, reason: "already_sent" }); continue; }
    if (claim === "busy") { result.skipped.push({ id: job.id, reason: "in_progress" }); continue; }
    if (claim === "quota") {
      result.remaining = jobs.slice(i).map(j => j.id);
      result.stopped = "daily_limit";
      break;
    }

    if (delivered > 0 && options.delayMs > 0) await sleep(options.delayMs);
    delivered++;
    try {
      await hooks.deliver(job);
    } catch (error) {
      const message = shortError(error);
      try {
        await hooks.finish(job, false, message);
      } catch (finishError) {
        console.error("finish(failed) failed", shortError(finishError));
      }
      result.failed.push({ id: job.id, error: message });
      if (isDailyLimitError(message)) {
        result.remaining = jobs.slice(i + 1).map(j => j.id);
        result.stopped = "daily_limit";
        break;
      }
      continue;
    }

    result.sent.push(job.id);
    try {
      await hooks.finish(job, true);
    } catch (error) {
      console.error("Sent but couldn't record it", job.id, shortError(error));
      result.unrecorded.push(job.id);
    }
  }
  return result;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

/** sha-256 of the text, in hex (Web Crypto, in both Deno and the browser). */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/** email_log keys, as the migration describes them. */
export const emailKeys = {
  decision: (applicationId: string, releasedAt: string | null) =>
    `decision:${applicationId}:${releasedAt ? Math.floor(Date.parse(releasedAt) / 1000) : "unreleased"}`,
  blast: (textHash: string, applicationId: string) => `blast:${textHash}:${applicationId}`,
  pass: (attendeeId: string, emailedAt: string | null, email: string) =>
    `pass:${attendeeId}:${emailedAt ? Math.floor(Date.parse(emailedAt) / 1000) : "never"}:${email.toLowerCase()}`,
};

/** JSON error body for the console: a message for people and a code for code. Never raw database text. */
export type ErrorBody = { error: string; code: string };
