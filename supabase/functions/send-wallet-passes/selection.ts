// Reading the optional applicationIds filter for send-wallet-passes. No Deno or
// npm imports, so the site's tests (vitest) can check it too.

/** Keeps one request well inside the function time limit (a pass and an email each, plus the delay). */
export const MAX_PER_REQUEST = 40;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ids is null when the caller didn't pick anyone, which means everyone
 * accepted without a pass. An empty list means nobody, never everyone.
 */
export type Selection = { ok: true; ids: string[] | null } | { ok: false; error: string };

export function parseApplicationIds(value: unknown): Selection {
  if (value === undefined || value === null) return { ok: true, ids: null };
  if (!Array.isArray(value) || !value.every(id => typeof id === "string" && UUID.test(id))) {
    return { ok: false, error: "applicationIds must be a list of application ids." };
  }
  const ids = [...new Set(value.map(id => id.toLowerCase()))];
  if (ids.length > MAX_PER_REQUEST) {
    return { ok: false, error: `At most ${MAX_PER_REQUEST} applicationIds per request.` };
  }
  return { ok: true, ids };
}

/** The chosen ids that aren't applications at the event (found: the ids the event's query returned). */
export function outsideEvent(ids: string[], found: Iterable<string>): string[] {
  const known = new Set([...found].map(id => id.toLowerCase()));
  return ids.filter(id => !known.has(id));
}
