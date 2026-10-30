// What each person's pass and email look like, by role. No Deno or npm imports,
// so the site's tests (vitest) can check it too.
//
// WalletWallet's free plan takes six colour presets (dark, blue, green, red,
// purple, orange); a custom hex colour, images and footer fields are Pro only and
// are refused with a 400 on the free plan, so they aren't used here.
//
//   role            preset  (Minecraft)            pass background  email badge
//   Hacker          green   (emerald)              #15803d          #15803d, white text (5.0:1)
//   Mentor          blue    (diamond)              #1e40af          #1e40af, white text (8.7:1)
//   Judge           orange  (gold)                 #ea580c          #c2410c, white text (5.2:1)
//   Mentor & Judge  purple  (blue + red, enchanted) #7e22ce         #7e22ce, white text (7.0:1)
//
// The pass backgrounds are what WalletWallet put in pass.json for each preset
// (white text, a light tint of the colour for labels). The email badge uses the
// same colour so it matches the pass, one shade darker for the judge so white
// text passes WCAG AA.

export type PassRole = "hacker" | "mentor" | "judge" | "hybrid";

export type ColorPreset = "dark" | "blue" | "green" | "red" | "purple" | "orange";

export const ROLE_DESIGN: Record<PassRole, {
  /** The big title on the pass and the email badge. */
  title: string;
  /** For sentences: "your mentor pass". */
  noun: string;
  colorPreset: ColorPreset;
  badge: { background: string; color: string };
  /** First line of the email, after "Hi Name,". */
  thanks: (eventName: string) => string;
}> = {
  hacker: {
    title: "HACKER",
    noun: "hacker",
    colorPreset: "green",
    badge: { background: "#15803d", color: "#ffffff" },
    thanks: e => `You're hacking at ${e}! Here's your check-in pass.`,
  },
  mentor: {
    title: "MENTOR",
    noun: "mentor",
    colorPreset: "blue",
    badge: { background: "#1e40af", color: "#ffffff" },
    thanks: e => `Thanks for mentoring at ${e}! Here's your check-in pass.`,
  },
  judge: {
    title: "JUDGE",
    noun: "judge",
    colorPreset: "orange",
    badge: { background: "#c2410c", color: "#ffffff" },
    thanks: e => `Thanks for judging at ${e}! Here's your check-in pass.`,
  },
  hybrid: {
    title: "MENTOR & JUDGE",
    noun: "mentor & judge",
    colorPreset: "purple",
    badge: { background: "#7e22ce", color: "#ffffff" },
    thanks: e => `Thanks for mentoring and judging at ${e}! Here's your check-in pass.`,
  },
};

/**
 * When each role is needed, for the event that starts on firstDay (Pacific).
 * `when` is TIMELINE.eventDates in src/staff-portal/config.ts word for word (a
 * test keeps them the same); `short` is the same dates cut down for the top of
 * the pass. Any other event gets its dates from events.starts_at / ends_at.
 */
export const SCHEDULE = {
  firstDay: "2027-01-16",
  when: {
    hacker: "Saturday–Sunday, January 16–17, 2027",
    mentor: "Saturday, January 16, 2027 · mentoring 12:30–4:30 PM",
    judge: "Sunday, January 17, 2027",
    hybrid: "Saturday–Sunday, January 16–17, 2027 (mentoring Saturday, judging Sunday)",
  } satisfies Record<PassRole, string>,
  short: {
    hacker: "Jan 16–17",
    mentor: "Sat, Jan 16",
    judge: "Sun, Jan 17",
    hybrid: "Jan 16–17",
  } satisfies Record<PassRole, string>,
};

/** attendees.roles to one role. The roster only ever holds these four combinations. */
export function roleOf(roles: readonly string[]): PassRole {
  const mentor = roles.includes("mentor");
  const judge = roles.includes("judge");
  if (mentor && judge) return "hybrid";
  if (judge) return "judge";
  if (mentor) return "mentor";
  return "hacker";
}

export type PassEvent = { name: string; starts_at?: string | null; ends_at?: string | null };
export type PassAttendee = { code: string; name: string; roles: string[]; team: string | null };
export type CreatedPass = { applePass: string; googleSaveUrl?: string; shareUrl?: string };

const ZONE = "America/Los_Angeles";
const day = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(new Date(iso));
const longDay = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: ZONE, weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(iso));
const shortDay = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: ZONE, month: "short", day: "numeric" }).format(new Date(iso));

const validDate = (iso: string | null | undefined): iso is string => !!iso && !Number.isNaN(Date.parse(iso));

/** When this person is needed: the role's own times for the scheduled event, else the event's dates, else nothing. */
export function whenFor(role: PassRole, event: PassEvent): { long: string; short: string } | null {
  if (!validDate(event.starts_at)) return null;
  if (day(event.starts_at) === SCHEDULE.firstDay) return { long: SCHEDULE.when[role], short: SCHEDULE.short[role] };
  const start = event.starts_at;
  const end = validDate(event.ends_at) && day(event.ends_at) !== day(start) ? event.ends_at : null;
  return end
    ? { long: `${longDay(start)} – ${longDay(end)}`, short: `${shortDay(start)} – ${shortDay(end)}` }
    : { long: longDay(start), short: shortDay(start) };
}

/** The POST body for WalletWallet's /api/passes. Barcode = attendees.code, which the check-in desk scans. */
export function passPayload(event: PassEvent, a: PassAttendee) {
  const role = roleOf(a.roles);
  const design = ROLE_DESIGN[role];
  const when = whenFor(role, event);
  return {
    barcodeValue: a.code,
    barcodeFormat: "QR",
    barcodeAltText: a.code,
    logoText: event.name,
    organizationName: "DataHacks",
    description: `${event.name} ${design.noun} check-in pass`,
    colorPreset: design.colorPreset,
    ...(when ? { headerFields: [{ label: "DATE", value: when.short }] } : {}),
    primaryFields: [{ label: "ROLE", value: design.title }],
    secondaryFields: [
      { label: "NAME", value: a.name },
      ...(role === "hacker" ? [{ label: "TEAM", value: a.team || "—" }] : []),
      { label: "CODE", value: a.code },
    ],
    backFields: [
      ...(when ? [{ label: "WHEN", value: when.long }] : []),
      { label: "CHECK-IN", value: "Show this QR code at the registration desk." },
      { label: "QUESTIONS", value: "info@ds3.club" },
    ],
  };
}

export const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Names come from applications, so they're untrusted: control characters (line breaks) become spaces. */
export const oneLine = (text: string) => text.replace(/\p{Cc}+/gu, " ").trim();

/** Only https links from WalletWallet become buttons. */
export const isHttps = (href: string | undefined): href is string => {
  try {
    return !!href && new URL(href).protocol === "https:";
  } catch {
    return false;
  }
};

const button = (href: string, label: string) =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:11px 18px;background:#111;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">${label}</a>`;

/** The coloured role label at the top of the email, matching the pass colour. */
export function roleBadge(role: PassRole) {
  const { title, badge } = ROLE_DESIGN[role];
  return `<span style="display:inline-block;padding:6px 14px;border-radius:6px;background:${badge.background};color:${badge.color};font-weight:700;font-size:15px;letter-spacing:0.08em">${escapeHtml(title)}</span>`;
}

export function buildEmail(event: PassEvent, a: PassAttendee, pass: CreatedPass) {
  const role = roleOf(a.roles);
  const design = ROLE_DESIGN[role];
  const when = whenFor(role, event);
  const first = a.name.split(" ")[0] || a.name;
  const appleUrl = isHttps(pass.shareUrl) ? pass.shareUrl : undefined;
  const googleUrl = isHttps(pass.googleSaveUrl) ? pass.googleSaveUrl : undefined;
  const subject = oneLine(`Your ${event.name} ${design.noun} pass`);
  const text = [
    `Hi ${first},`,
    "",
    `[${design.title}] ${design.thanks(event.name)}`,
    ...(when ? [`When: ${when.long}`] : []),
    "",
    `Your check-in code: ${a.code}`,
    "",
    "Show the QR code in this email (or in your wallet) at the registration desk.",
    "On an iPhone, open the attached pass to add it to Apple Wallet.",
    ...(googleUrl ? [`Android: add it to Google Wallet: ${googleUrl}`] : []),
    ...(appleUrl ? [`Or open ${appleUrl} on your phone.`] : []),
    "",
    "See you there!",
    "The DataHacks Team",
    "info@ds3.club",
  ].join("\n");
  const html = `<div style="font-family:sans-serif;line-height:1.5;color:#111">
<p>${roleBadge(role)}</p>
<p>Hi ${escapeHtml(first)},</p>
<p>${escapeHtml(design.thanks(event.name))}</p>
${when ? `<p><strong>When:</strong> ${escapeHtml(when.long)}</p>\n` : ""}<img src="cid:checkin-qr" alt="Check-in QR code ${escapeHtml(a.code)}" width="240" height="240" style="display:block;margin:8px 0">
<p>Your check-in code: <strong>${escapeHtml(a.code)}</strong></p>
<p>${appleUrl ? button(appleUrl, "Add to Apple Wallet") : ""}${googleUrl ? button(googleUrl, "Add to Google Wallet") : ""}</p>
<p>Show the QR code at the registration desk. On an iPhone you can also open the attached pass.</p>
<p>See you there!<br>The DataHacks Team<br>info@ds3.club</p>
</div>`;
  return { subject, text, html };
}
