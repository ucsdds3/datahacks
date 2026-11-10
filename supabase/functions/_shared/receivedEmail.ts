// The "We've received your application" email: its wording, who may ask for
// it, and the send itself, minus the Gmail and database plumbing (that's
// receivedSend.ts). No Deno or npm imports, so the site's tests (vitest) check
// the wording, the dates against src/staff-portal/config.ts, and the rules
// with a fake database and SMTP server (src/portal/receivedEmailContent.test.ts).
//
// Used by the send-received-email edge function (the portal's forms call it
// after submitting, the portal calls it again on load while it's still due, and
// organizers can send whatever is still due from the console) and by the MCP
// server's submit tools.

import { MLH_ENABLED, MLH_LINKS } from "../mcp/application.ts";
import { isUuid, runSendLoop, type ClaimResult, type SendLoopOptions, type SendLoopResult } from "./sendLoop.ts";

// ---------------------------------------------------------------------------
// What it says. Copies of src/staff-portal/config.ts (an edge function can't
// import the site's files); the test fails when they drift.

export const EVENT_NAME = "DataHacks 2027";
export const PORTAL_URL = "https://datahacks.ds3ucsd.com/portal/";
export const CONTACT_EMAIL = "info@ds3.club";

/** TIMELINE in src/staff-portal/config.ts. */
export const TIMELINE = {
  priorityDeadline: new Date("2026-11-29T23:59:59-08:00"),
  regularDeadline: new Date("2026-12-15T23:59:59-08:00"),
  priorityDecisions: "mid-December",
  regularDecisions: "the end of December",
  eventDates: {
    hacker: "Saturday–Sunday, January 16–17, 2027",
    mentor: "Saturday, January 16, 2027 · mentoring 12:30–4:30 PM",
    judge: "Sunday, January 17, 2027",
    hybrid: "Saturday–Sunday, January 16–17, 2027 (mentoring Saturday, judging Sunday)",
  },
};

export type ApplicantType = keyof typeof TIMELINE.eventDates;
const TYPE_LABEL: Record<ApplicantType, string> = { hacker: "hacker", mentor: "mentor", judge: "judge", hybrid: "mentor and judge" };
const isApplicantType = (value: string): value is ApplicantType => value in TYPE_LABEL;

const PACIFIC = "America/Los_Angeles";
// Plain spaces: some ICU versions put a narrow no-break space before "PM".
/** "November 29" in Pacific time. */
const pacificDay = (date: Date) => date.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: PACIFIC }).replace(/\s+/g, " ");
/** "11:59 PM" in Pacific time. */
const pacificTime = (date: Date) => date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: PACIFIC }).replace(/\s+/g, " ");
const deadline = (date: Date) => `${pacificDay(date)}, ${pacificTime(date)} Pacific`;

/** The application the email is about, as the database has it. */
export type ReceivedApplication = {
  id: string;
  event_id: string;
  user_id: string | null;
  applicant_type: string;
  status: string;
  first_name: string | null;
  /** The applicant's sign-in email: the database sets it on every applicant insert (applications_applicant_owned). */
  email: string | null;
  submitted_at: string | null;
  received_emailed_at: string | null;
};

/** The columns ReceivedApplication needs, for a select. */
export const RECEIVED_COLUMNS = "id, event_id, user_id, applicant_type, status, first_name, email, submitted_at, received_emailed_at";

export type ReceivedMessage = { subject: string; text: string; html: string };

/**
 * A name typed by the applicant is untrusted (docs/untrusted-input.md):
 * control characters become spaces, so it can't start a new line or header.
 */
// deno-lint-ignore no-control-regex
// eslint-disable-next-line no-control-regex
const oneLine = (text: string | null | undefined) => (text ?? "").replace(/[\x00-\x1f\x7f]+/g, " ").replace(/\s+/g, " ").trim();

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** A paragraph: text, links (shown as their address in the plain text) and line breaks. */
type Part = string | { href: string; text: string } | { br: true };
const link = (href: string, text = href): Part => ({ href, text });
const BR: Part = { br: true };

/** Which batch a hacker's application is in, by when it was submitted (applicationBatch in config.ts, plus "late"). */
export function hackerBatch(submittedAt: string | null): "priority" | "regular" | "late" {
  const at = submittedAt ? new Date(submittedAt) : null;
  if (!at || Number.isNaN(at.getTime()) || at <= TIMELINE.priorityDeadline) return "priority";
  return at <= TIMELINE.regularDeadline ? "regular" : "late";
}

/**
 * The email for one application. Everything comes from the database row and
 * the constants above; `mlh` (the event's MLH switch) adds MLH's Code of
 * Conduct for hackers; without it there's nothing about MLH.
 */
export function receivedEmail(
  app: Pick<ReceivedApplication, "applicant_type" | "first_name" | "submitted_at">,
  options: { mlh?: boolean } = {},
): ReceivedMessage {
  const type: ApplicantType = isApplicantType(app.applicant_type) ? app.applicant_type : "hacker";
  const hacker = type === "hacker";
  const name = oneLine(app.first_name) || "there";

  const next: Part[] = hacker
    ? {
        priority: [
          `What happens next: you applied by the priority deadline (${deadline(TIMELINE.priorityDeadline)}), ` +
            `so you'll hear back from us by ${TIMELINE.priorityDecisions}.`,
        ],
        regular: [
          `What happens next: you applied after the priority deadline (${deadline(TIMELINE.priorityDeadline)}), ` +
            `so we'll review your application after applications close on ${deadline(TIMELINE.regularDeadline)}, ` +
            `and you'll hear back from us by ${TIMELINE.regularDecisions}.`,
        ],
        late: ["What happens next: we'll review your application and email you when your decision is out."],
      }[hackerBatch(app.submitted_at)]
    : ["What happens next: our mentor and judge coordinators review every application, and we'll email you when your decision is out."];

  const paragraphs: Part[][] = [
    [`Hi ${name},`],
    [`Thanks for applying to ${EVENT_NAME}! We've received your ${TYPE_LABEL[type]} application.`],
    hacker
      ? [`${EVENT_NAME} is ${TIMELINE.eventDates.hacker}, at UC San Diego.`]
      : [`${EVENT_NAME} is at UC San Diego. When we'd need you: ${TIMELINE.eventDates[type]}.`],
    ...(hacker && options.mlh === true
      ? [[`${EVENT_NAME} is a Major League Hacking (MLH) Member Event, so the MLH Code of Conduct applies: `, link(MLH_LINKS.codeOfConduct)]]
      : []),
    next,
    ["You can check your application's status anytime on the portal:", BR, link(PORTAL_URL)],
    [
      "Your answers can't be changed now that you've submitted. If something needs fixing, or you have a question, email us at ",
      link(`mailto:${CONTACT_EMAIL}`, CONTACT_EMAIL),
      ".",
    ],
    ["The DataHacks team", BR, "Data Science Student Society at UC San Diego", BR, CONTACT_EMAIL],
  ];

  const asText = (part: Part) => (typeof part === "string" ? part : "br" in part ? "\n" : part.text);
  const asHtml = (part: Part) =>
    typeof part === "string"
      ? escapeHtml(part)
      : "br" in part
      ? "<br>"
      : `<a href="${escapeHtml(part.href)}">${escapeHtml(part.text)}</a>`;

  const subject = hacker
    ? `We've received your ${EVENT_NAME} application`
    : `We've received your ${EVENT_NAME} ${TYPE_LABEL[type]} application`;
  return {
    subject,
    text: paragraphs.map(p => p.map(asText).join("")).join("\n\n"),
    html: `<div style="font-family: sans-serif; line-height: 1.5">${paragraphs.map(p => `<p>${p.map(asHtml).join("")}</p>`).join("")}</div>`,
  };
}

// ---------------------------------------------------------------------------
// Who may ask, and for whom.

/** Whose applications a request covers: the caller's own, or (organizers) everyone due in one event. */
export type ReceivedScope = { userId: string; eventId?: string } | { eventId: string; userId?: undefined };

export type ScopeAnswer =
  | { ok: true; scope: ReceivedScope }
  | { ok: false; status: number; code: string; error: string };

/**
 * What a request to send-received-email may do. `userId` is the caller as the
 * Auth server verified their token (null if it couldn't). The body is never
 * trusted for an address, a name or any wording:
 *   {}            the caller's own applications that are due (the portal)
 *   { eventId }   every application in that event that's due, for an
 *                 organizer of that event (the console)
 * Anything else in the body is ignored.
 */
export async function requestScope(
  body: unknown,
  caller: { userId: string | null; isStaff: (eventId: string) => Promise<boolean> },
): Promise<ScopeAnswer> {
  if (!caller.userId) return { ok: false, status: 401, code: "auth", error: "Sign in first." };
  const eventId = body && typeof body === "object" ? (body as { eventId?: unknown }).eventId : undefined;
  if (eventId === undefined || eventId === null) return { ok: true, scope: { userId: caller.userId } };
  if (!isUuid(eventId)) return { ok: false, status: 400, code: "bad_request", error: "eventId must be an event id." };
  if (!(await caller.isStaff(eventId))) {
    return { ok: false, status: 403, code: "forbidden", error: "Only organizers of this event can send these emails for others." };
  }
  return { ok: true, scope: { eventId: eventId.toLowerCase() } };
}

// ---------------------------------------------------------------------------
// The send.

/** email_log key: one "received" email per application, ever. */
export const receivedKey = (applicationId: string) => `received:${applicationId}`;

/** Due: under review (not a draft, no decision released yet) and never sent one. */
export const isDue = (app: Pick<ReceivedApplication, "status" | "received_emailed_at">) =>
  app.status === "submitted" && !app.received_emailed_at;

/** One plain address (the database enforces the same), so a value can't add recipients. */
export const isPlainEmail = (email: string) => email.length <= 254 && /^[A-Za-z0-9._+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(email);

export type ReceivedDeps = {
  /** Applications in the scope with status 'submitted' and no received_emailed_at, oldest first, at most `limit`. */
  due(scope: ReceivedScope, limit: number): Promise<ReceivedApplication[]>;
  /** Sign-in emails (profiles.email) for applications without one. */
  profileEmails(userIds: string[]): Promise<Map<string, string>>;
  /** Of these events, the ones with MLH's switch on (events.mlh_required). */
  mlhEvents(eventIds: string[]): Promise<Set<string>>;
  /** Called once there's something to send, before any claim: throws if email isn't configured. */
  ready?(): void | Promise<void>;
  /** claim_email(event, 'received', receivedKey(id), id). */
  claim(app: ReceivedApplication): Promise<ClaimResult>;
  deliver(to: string, message: ReceivedMessage): Promise<void>;
  /** finish_email(receivedKey(id), ok, error): on success it also sets received_emailed_at. */
  finish(app: ReceivedApplication, ok: boolean, error?: string): Promise<void>;
};

export type ReceivedResult = SendLoopResult & {
  /** Applications due when the request started (at most the limit). */
  due: number;
};

/**
 * Sends the "received" email for every due application in the scope, each at
 * most once ever: claimed in email_log first (another tab or a retry gets
 * "busy" or "sent"), marked the moment Gmail accepts it. Stops at the daily
 * limit; whatever wasn't sent stays due for the next request.
 */
export async function sendReceivedEmails(
  deps: ReceivedDeps,
  scope: ReceivedScope,
  options: SendLoopOptions & { limit?: number },
): Promise<ReceivedResult> {
  const found = (await deps.due(scope, options.limit ?? 5)).filter(app =>
    isDue(app) && (scope.userId === undefined || app.user_id === scope.userId) && (scope.eventId === undefined || app.event_id === scope.eventId)
  );
  const empty: ReceivedResult = { sent: [], skipped: [], failed: [], remaining: [], stopped: null, unrecorded: [], due: found.length };
  if (found.length === 0) return empty;

  const missing = found.filter(a => !a.email?.trim() && a.user_id).map(a => a.user_id!);
  const profiles = missing.length ? await deps.profileEmails([...new Set(missing)]) : new Map<string, string>();
  const mlh = await deps.mlhEvents([...new Set(found.map(a => a.event_id))]);

  const failed: { id: string; error: string }[] = [];
  const jobs: { id: string; app: ReceivedApplication; to: string }[] = [];
  for (const app of found) {
    const to = (app.email?.trim() || (app.user_id ? profiles.get(app.user_id) : "") || "").toLowerCase();
    if (!to) failed.push({ id: app.id, error: "No email address on file." });
    else if (!isPlainEmail(to)) failed.push({ id: app.id, error: "The email address on file isn't a single plain address." });
    else jobs.push({ id: app.id, app, to });
  }
  if (jobs.length === 0) return { ...empty, failed };

  await deps.ready?.();
  const loop = await runSendLoop(jobs, {
    claim: job => deps.claim(job.app),
    deliver: job => deps.deliver(job.to, receivedEmail(job.app, { mlh: MLH_ENABLED || mlh.has(job.app.event_id) })),
    finish: (job, ok, error) => deps.finish(job.app, ok, error),
  }, options);
  return { ...loop, failed: [...failed, ...loop.failed], due: found.length };
}
