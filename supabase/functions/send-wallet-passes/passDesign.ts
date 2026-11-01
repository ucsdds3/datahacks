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

/** Only https links (the signed pass link, WalletWallet's) become buttons. */
export const isHttps = (href: string | undefined): href is string => {
  try {
    return !!href && new URL(href).protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * A wallet button. Plain black, like Apple's and Google's own badges, but text
 * only (no images, so nothing to load or block).
 */
const button = (href: string, label: string) =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 20px;background:#000;color:#fff;border:1px solid #a6a6a6;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px">${escapeHtml(label)}</a>`;

/** How long the "Add to Apple Wallet" link works: 30 days after the event ends. */
export const PASS_LINK_DAYS_AFTER_EVENT = 30;
/** When the event has no end date (or it's long past): 120 days from sending. */
export const PASS_LINK_FALLBACK_DAYS = 120;
const DAY_SECONDS = 24 * 60 * 60;

/**
 * Seconds until the signed "Add to Apple Wallet" link expires: until 30 days
 * after events.ends_at, or 120 days from now if there's no end date or that
 * would already be (nearly) over, so a resend for an old event still works.
 */
export function passLinkSeconds(endsAt: string | null | undefined, now = Date.now()): number {
  if (validDate(endsAt)) {
    const seconds = Math.floor((Date.parse(endsAt) - now) / 1000) + PASS_LINK_DAYS_AFTER_EVENT * DAY_SECONDS;
    if (seconds >= DAY_SECONDS) return seconds;
  }
  return PASS_LINK_FALLBACK_DAYS * DAY_SECONDS;
}

/** The coloured role label at the top of the email, matching the pass colour. */
export function roleBadge(role: PassRole) {
  const { title, badge } = ROLE_DESIGN[role];
  return `<span style="display:inline-block;padding:6px 14px;border-radius:6px;background:${badge.background};color:${badge.color};font-weight:700;font-size:15px;letter-spacing:0.08em">${escapeHtml(title)}</span>`;
}

/**
 * The pass email. appleLink is a signed link to this person's .pkpass in the
 * private wallet-passes bucket: Safari on an iPhone opens it straight into the
 * Add to Apple Wallet sheet. Without one (the upload failed), the button falls
 * back to WalletWallet's shareUrl page. No QR image: people show the wallet
 * pass, and the desk can type the code.
 */
export function buildEmail(event: PassEvent, a: PassAttendee, pass: CreatedPass, appleLink?: string) {
  const role = roleOf(a.roles);
  const design = ROLE_DESIGN[role];
  const when = whenFor(role, event);
  const first = a.name.split(" ")[0] || a.name;
  const appleUrl = isHttps(appleLink) ? appleLink : isHttps(pass.shareUrl) ? pass.shareUrl : undefined;
  const googleUrl = isHttps(pass.googleSaveUrl) ? pass.googleSaveUrl : undefined;
  const subject = oneLine(`Your ${event.name} ${design.noun} pass`);
  const howTo = "Add your pass to Apple Wallet or Google Wallet and show it at the registration desk.";
  const codeLine = (code: string) => `Your check-in code is ${code} if you need it.`;
  const text = [
    `Hi ${first},`,
    "",
    `[${design.title}] ${design.thanks(event.name)}`,
    ...(when ? [`When: ${when.long}`] : []),
    "",
    `${howTo} ${codeLine(a.code)}`,
    "",
    ...(appleUrl ? [`Add to Apple Wallet: ${appleUrl}`] : []),
    ...(googleUrl ? [`Add to Google Wallet: ${googleUrl}`] : []),
    "On an iPhone you can also tap the attached pass.",
    "",
    "See you there!",
    "The DataHacks Team",
    "info@ds3.club",
  ].join("\n");
  const buttons = `${appleUrl ? button(appleUrl, "Add to Apple Wallet") : ""}${googleUrl ? button(googleUrl, "Add to Google Wallet") : ""}`;
  const html = `<div style="font-family:sans-serif;line-height:1.5;color:#111">
<p>${roleBadge(role)}</p>
<p>Hi ${escapeHtml(first)},</p>
<p>${escapeHtml(design.thanks(event.name))}</p>
${when ? `<p><strong>When:</strong> ${escapeHtml(when.long)}</p>\n` : ""}<p>${escapeHtml(howTo)} Your check-in code is <strong>${escapeHtml(a.code)}</strong> if you need it.</p>
${buttons ? `<p>${buttons}</p>\n` : ""}<p>On an iPhone you can also tap the attached pass.</p>
<p>See you there!<br>The DataHacks Team<br>info@ds3.club</p>
</div>`;
  return { subject, text, html };
}
