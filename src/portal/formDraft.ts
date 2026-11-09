import { useCallback, useEffect, useRef, useState } from "react";

// Application drafts. The forms keep what's been typed in this browser's
// localStorage, per account and event, so a refresh, a closed tab, Back, or a
// sign-in that expires mid-form doesn't lose three essays. The key starts with
// "datahacks.", so signing out (signOutEverywhere) clears it with the rest of
// the portal's saved settings.

export const DRAFT_PREFIX = "datahacks.draft.";

export const draftKey = (form: string, eventCode: string, userId: string) => `${DRAFT_PREFIX}${form}.${eventCode}.${userId}`;

type Saved = { v: 1; savedAt: string; form: Record<string, unknown> };

// Set before leaving the page on purpose (signing out, signing in again): no
// "leave this page?" prompt, and nothing written back after sign-out cleared it.
let leavingOnPurpose = false;
export function allowLeaving() {
  leavingOnPurpose = true;
}
/** Tests only: a fresh page. */
export function resetLeaving() {
  leavingOnPurpose = false;
}

/** A saved answer is only used if it has the same shape as the blank form's. */
function sameShape(blank: unknown, saved: unknown): boolean {
  if (Array.isArray(blank)) return Array.isArray(saved) && saved.every(item => typeof item === "string");
  if (blank === null) return saved === null || typeof saved === "boolean";
  return typeof saved === typeof blank;
}

/** The saved draft merged over `blank`, or null if there's none (or storage is blocked). */
export function readDraft<T extends object>(key: string, blank: T): { form: T; savedAt: string } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Saved;
    if (saved?.v !== 1 || typeof saved.form !== "object" || saved.form === null) return null;
    const form = { ...blank };
    for (const field of Object.keys(blank) as (keyof T)[]) {
      const value = saved.form[field as string];
      if (field in saved.form && sameShape(blank[field], value)) form[field] = value as T[keyof T];
    }
    return { form, savedAt: saved.savedAt };
  } catch {
    return null;
  }
}

function writeDraft(key: string, form: object, blank: object): boolean {
  try {
    if (JSON.stringify(form) === JSON.stringify(blank)) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify({ v: 1, savedAt: new Date().toISOString(), form: form as Record<string, unknown> } satisfies Saved));
    return true;
  } catch {
    return false; // Private mode or full storage: the "leave page?" prompt still guards the answers.
  }
}

export function removeDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage blocked */
  }
}

/**
 * A form's state, saved as a draft while it's typed (debounced) and restored
 * when the form opens again for the same account and event. The account is
 * the one the form was opened with, so if the session ends or another tab
 * switches accounts, the answers stay under the person who typed them.
 *
 * While there are answers that haven't been submitted, leaving or reloading the
 * page asks first.
 */
export function useFormDraft<T extends object>({ form: name, eventCode, userId, blank, delay = 400 }: {
  form: string;
  eventCode: string;
  userId: string | null | undefined;
  blank: T;
  delay?: number;
}) {
  const [owner] = useState(() => userId ?? null);
  const key = owner ? draftKey(name, eventCode, owner) : null;
  const [initial] = useState(() => (key ? readDraft(key, blank) : null));
  const [form, setForm] = useState<T>(initial?.form ?? blank);
  const [restoredAt, setRestoredAt] = useState<string | null>(initial?.savedAt ?? null);
  const [submitted, setSubmitted] = useState(false);

  const latest = useRef(form);
  latest.current = form;
  const blankRef = useRef(blank);
  const done = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Writes the draft now (also called when the session ends, in case another tab's sign-out cleared it). */
  const save = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!key || done.current || leavingOnPurpose) return;
    writeDraft(key, latest.current, blankRef.current);
  }, [key]);

  useEffect(() => {
    if (!key || done.current) return;
    timer.current = setTimeout(save, delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [form, key, delay, save]);

  // Save on the way out too (refresh, closed tab, Back, unmount), not just after the pause.
  useEffect(() => {
    const onHide = () => save();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
      save();
    };
  }, [save]);

  const dirty = !submitted && JSON.stringify(form) !== JSON.stringify(blank);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      save();
      if (leavingOnPurpose || done.current) return;
      e.preventDefault();
      e.returnValue = ""; // Older Safari and Chrome need this to show the prompt.
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, save]);

  /** After a successful submit: the draft is deleted and leaving no longer asks. */
  const clear = useCallback(() => {
    done.current = true;
    if (timer.current) clearTimeout(timer.current);
    if (key) removeDraft(key);
    setSubmitted(true);
  }, [key]);

  /** "Start over": a blank form, and no saved draft. */
  const reset = useCallback(() => {
    if (key) removeDraft(key);
    setRestoredAt(null);
    setForm(blankRef.current);
  }, [key]);

  return { form, setForm, owner, restoredAt, dirty, save, clear, reset };
}
