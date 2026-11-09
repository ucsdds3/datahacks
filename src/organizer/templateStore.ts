import { DEFAULT_TEMPLATES, SPOT_OFFER_TEMPLATE, type Template } from "./templates";

/**
 * Edited email templates, kept in this browser per event, so a retry ("Send
 * unsent decision emails", resending day-of offers) goes out with the same
 * words as the first send instead of the defaults. Storage can be missing or
 * blocked (private windows): then everything still works with the defaults.
 */

export type DecisionTemplates = typeof DEFAULT_TEMPLATES;
type Stored<T> = { savedAt: string; value: T };

const key = (eventId: string, what: string) => `datahacks-organizer:${what}:${eventId}`;

function read<T>(k: string): Stored<T> | null {
  try {
    const raw = window.localStorage.getItem(k);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored<T>;
    return parsed && typeof parsed === "object" && "value" in parsed ? parsed : null;
  } catch {
    return null;
  }
}

function write<T>(k: string, value: T | null) {
  try {
    if (value === null) window.localStorage.removeItem(k);
    else window.localStorage.setItem(k, JSON.stringify({ savedAt: new Date().toISOString(), value } satisfies Stored<T>));
  } catch { /* storage unavailable: nothing to keep */ }
}

const isTemplate = (t: unknown): t is Template =>
  !!t && typeof (t as Template).subject === "string" && typeof (t as Template).body === "string";

/** The decision templates as last edited for this event (defaults for any not edited), and when they were saved. */
export function loadDecisionTemplates(eventId: string): { templates: DecisionTemplates; savedAt: string | null } {
  const stored = read<Partial<DecisionTemplates>>(key(eventId, "decision-templates"));
  const templates = { ...DEFAULT_TEMPLATES };
  for (const k of Object.keys(DEFAULT_TEMPLATES) as (keyof DecisionTemplates)[]) {
    const t = stored?.value?.[k];
    if (isTemplate(t)) templates[k] = { subject: t.subject, body: t.body };
  }
  return { templates, savedAt: stored?.savedAt ?? null };
}

/** Saves the templates; ones identical to the defaults aren't stored. Null forgets them. */
export function saveDecisionTemplates(eventId: string, templates: DecisionTemplates | null) {
  if (!templates) return write(key(eventId, "decision-templates"), null);
  const changed = Object.fromEntries(
    (Object.keys(templates) as (keyof DecisionTemplates)[])
      .filter(k => templates[k].subject !== DEFAULT_TEMPLATES[k].subject || templates[k].body !== DEFAULT_TEMPLATES[k].body)
      .map(k => [k, templates[k]]),
  );
  write(key(eventId, "decision-templates"), Object.keys(changed).length ? changed : null);
}

export function loadOfferTemplate(eventId: string): Template {
  const stored = read<Template>(key(eventId, "offer-template"));
  return isTemplate(stored?.value) ? { subject: stored!.value.subject, body: stored!.value.body } : SPOT_OFFER_TEMPLATE;
}

export function saveOfferTemplate(eventId: string, template: Template | null) {
  const same = template && template.subject === SPOT_OFFER_TEMPLATE.subject && template.body === SPOT_OFFER_TEMPLATE.body;
  write(key(eventId, "offer-template"), same ? null : template);
}
