import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ChevronDown } from "lucide-react";
import { usePortalTheme } from "@/portal/portalTheme";

/** The asterisk on a required field's label. */
export const Req = () => <span className="sp-req" aria-hidden="true">*</span>;

/** A titled section of a long form. `id` goes on its heading. */
export type FormStep = { id: string; title: string };

/**
 * A section heading. In the Nether theme it gets a "Section 2 of 6" line above it,
 * as in the design; the End shows the heading alone, as before.
 */
export function FormSection({ steps, index }: { steps: readonly FormStep[]; index: number }) {
  const nether = usePortalTheme() === "nether";
  const step = steps[index];
  return (
    <>
      {nether && <p className="sp-eyebrow sp-form-eyebrow">Section {index + 1} of {steps.length}</p>}
      <h2 className="sp-form-section" id={step.id}>{step.title}</h2>
    </>
  );
}

/**
 * The Nether theme's section bar over a long form: a segment per section, lava
 * orange for the one being filled in (where focus is, else the first unfinished
 * one) and teal once a section's required answers are in. It only shows progress;
 * the End theme doesn't draw it at all.
 */
export function FormSteps({ steps, done, form }: { steps: readonly FormStep[]; done: boolean[]; form: RefObject<HTMLFormElement> }) {
  const nether = usePortalTheme() === "nether";
  const [focused, setFocused] = useState<number | null>(null);

  // The section someone is in: the last heading before whatever has focus.
  useEffect(() => {
    const el = form.current;
    if (!nether || !el) return;
    const onFocus = (e: FocusEvent) => {
      let index = -1;
      steps.forEach((step, i) => {
        const heading = document.getElementById(step.id);
        if (heading && heading.compareDocumentPosition(e.target as Node) & Node.DOCUMENT_POSITION_FOLLOWING) index = i;
      });
      if (index >= 0) setFocused(index);
    };
    el.addEventListener("focusin", onFocus);
    return () => el.removeEventListener("focusin", onFocus);
  }, [nether, form, steps]);

  if (!nether) return null;
  const current = focused ?? done.indexOf(false);
  return (
    <ol className="sp-form-steps" aria-label="Sections">
      {steps.map((step, i) => (
        <li key={step.id} className={i === current ? "current" : done[i] ? "done" : undefined} aria-current={i === current ? "step" : undefined}>
          <span className="sp-form-step-label">{step.title}</span>
          {done[i] && <span className="sr-only"> (complete)</span>}
        </li>
      ))}
    </ol>
  );
}

/**
 * Phone numbers: exactly 10 digits, shown and saved as (858) 370-2478. A
 * leading country code 1 is dropped once there are 11 digits, so pasting
 * "+1 858 370 2478" keeps the right number (no US area code starts with 1).
 */
export const phoneDigits = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return (digits.length > 10 && digits.startsWith("1") ? digits.slice(1) : digits).slice(0, 10);
};
export const isValidPhone = (value: string) => /^\(\d{3}\) \d{3}-\d{4}$/.test(value);

export function formatPhone(value: string) {
  const d = phoneDigits(value);
  if (d.length === 0) return "";
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function PhoneInput({ value, onChange, id }: { value: string; onChange: (value: string) => void; id?: string }) {
  return (
    <input
      id={id}
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      placeholder="(858) 555-0123"
      required
      value={value}
      onChange={e => onChange(formatPhone(e.target.value))}
      pattern="\(\d{3}\) \d{3}-\d{4}"
      title="10 digits, like 8585550123"
    />
  );
}

/**
 * A native date input that looks empty until someone picks a date. Safari draws
 * today's date in grey in an empty one, which reads as already filled in; while
 * it's empty and not focused, its text is hidden behind a "MM/DD/YYYY" hint
 * (styled in end-theme.css). The input itself is untouched: same picker, same
 * value ("YYYY-MM-DD"), same validation.
 */
export function DateInput({ value, onChange, min, max, required = true, id }: {
  value: string; onChange: (value: string) => void; min?: string; max?: string; required?: boolean; id?: string;
}) {
  // A half-typed date ("11/dd/yyyy") has no value yet but shouldn't be hidden behind the hint.
  const [partial, setPartial] = useState(false);
  return (
    <span className="sp-date" data-empty={value || partial ? undefined : ""}>
      <input
        id={id}
        type="date"
        required={required}
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={e => setPartial(e.currentTarget.validity.badInput)}
      />
      <span className="sp-date-hint" aria-hidden="true">MM/DD/YYYY</span>
    </span>
  );
}

/** A dropdown that allows picking several options. */
export function MultiSelect({ options, value, onChange, placeholder = "Select all that apply", id }: {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // Close when clicking anywhere else.
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = (option: string) =>
    onChange(value.includes(option) ? value.filter(v => v !== option) : options.filter(o => o === option || value.includes(o)));

  return (
    <div className="sp-multiselect" ref={root}>
      <button type="button" id={id} className="sp-multiselect-button" aria-expanded={open} onClick={() => setOpen(o => !o)}
        onKeyDown={e => { if (e.key === "Escape") setOpen(false); }}>
        <span className={value.length ? "" : "sp-placeholder"}>{value.length ? value.join(", ") : placeholder}</span>
        <ChevronDown size={16} aria-hidden />
      </button>
      {open && (
        <div className="sp-multiselect-menu" role="group" onKeyDown={e => { if (e.key === "Escape") setOpen(false); }}>
          {options.map(option => (
            <label key={option} className="sp-check">
              <input type="checkbox" checked={value.includes(option)} onChange={() => toggle(option)} />
              <span>{option}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/** A plain dropdown with a "Select…" prompt. */
export function Select({ options, value, onChange, id, required = true }: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  id?: string;
  required?: boolean;
}) {
  return (
    <select id={id} required={required} value={value} onChange={e => onChange(e.target.value)}>
      <option value="" disabled>Select…</option>
      {options.map(option => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

/** Yes / No as two radio buttons in a row. */
export function YesNo({ name, value, onChange }: { name: string; value: boolean | null; onChange: (value: boolean) => void }) {
  return (
    <div className="sp-yesno" role="radiogroup">
      {[true, false].map(option => (
        <label key={String(option)} className="sp-check">
          <input type="radio" name={name} required checked={value === option} onChange={() => onChange(option)} />
          <span>{option ? "Yes" : "No"}</span>
        </label>
      ))}
    </div>
  );
}

/**
 * A text field with a searchable list of suggestions, styled like the portal
 * (the browser's own datalist popup can't be). Matches that start with what
 * was typed come first; anything not on the list can still be entered.
 */
export function Combobox({ options, value, onChange, id, placeholder, required = true, minChars = 2, limit = 60, search, maxLength }: {
  options: string[];
  /** Custom matching (e.g. nicknames and typos); defaults to plain word-prefix matching. */
  search?: (query: string) => string[];
  value: string;
  onChange: (value: string) => void;
  id: string;
  placeholder?: string;
  required?: boolean;
  minChars?: number;
  limit?: number;
  maxLength?: number;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const query = value.trim().toLowerCase();

  const matches = useMemo(() => {
    if (query.length < minChars) return [];
    if (search) return search(value).slice(0, limit);
    const starts: string[] = [];
    const contains: string[] = [];
    for (const option of options) {
      const lower = option.toLowerCase();
      if (lower.startsWith(query) || lower.split(/[\s,(]+/).some(word => word.startsWith(query))) starts.push(option);
      else if (lower.includes(query)) contains.push(option);
      if (starts.length >= limit) break;
    }
    return [...starts, ...contains].slice(0, limit);
  }, [options, query, minChars, limit, search, value]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (option: string) => { onChange(option); setOpen(false); };
  const showList = open && query.length >= minChars;

  return (
    <div className="sp-combobox" ref={root}>
      <input
        id={id}
        required={required}
        maxLength={maxLength}
        autoComplete="off"
        placeholder={placeholder}
        role="combobox"
        aria-expanded={showList}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={showList && matches[active] ? `${id}-opt-${active}` : undefined}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (!showList) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive(i => Math.min(i + 1, matches.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
          else if (e.key === "Enter" && matches[active]) { e.preventDefault(); choose(matches[active]); }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {showList && (
        <ul className="sp-combobox-menu" role="listbox" id={`${id}-list`} ref={list}>
          {matches.map((option, i) => (
            <li
              key={option}
              id={`${id}-opt-${i}`}
              data-index={i}
              role="option"
              aria-selected={i === active}
              className={i === active ? "active" : ""}
              onMouseDown={e => { e.preventDefault(); choose(option); }}
              onMouseEnter={() => setActive(i)}
            >
              {option}
            </li>
          ))}
          {matches.length === 0 && <li className="sp-combobox-empty">Not listed? Keep typing your school's full name.</li>}
        </ul>
      )}
    </div>
  );
}
