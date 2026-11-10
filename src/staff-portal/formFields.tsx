import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { GENERAL_CONTACT_EMAIL } from "./config";

/** The asterisk on a required field's label. */
export const Req = () => <span className="sp-req" aria-hidden="true">*</span>;

/**
 * Whether the database accepts international numbers yet. Its application_phone_check
 * only allows "(858) 370-2478", so this stays false until a migration widens that
 * check (and the MCP server's toPhone matches). Until then a "+44 …" or "+91 …"
 * number is kept as typed, never reshaped into a fake US one, and the form asks
 * for a +1 number instead.
 */
export const INTERNATIONAL_PHONES = false;

/**
 * US and Canadian numbers: exactly 10 digits, shown and saved as (858) 370-2478. A
 * leading country code 1 is dropped once there are 11 digits, so pasting
 * "+1 858 370 2478" keeps the right number (no US area code starts with 1).
 */
export const phoneDigits = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return (digits.length > 10 && digits.startsWith("1") ? digits.slice(1) : digits).slice(0, 10);
};
const US_PHONE = /^\(\d{3}\) \d{3}-\d{4}$/;

/** Typed with a "+" and a country code other than 1: an international number. */
export const isInternationalInput = (value: string) => /^\s*\+/.test(value) && !value.replace(/\D/g, "").startsWith("1");

/** "+" and 8 to 15 digits (E.164), with single spaces between groups. */
export const isInternationalPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return /^\+[1-9][\d ]*$/.test(value) && !digits.startsWith("1") && digits.length >= 8 && digits.length <= 15;
};

export const isValidPhone = (value: string) => US_PHONE.test(value) || (INTERNATIONAL_PHONES && isInternationalPhone(value));

/** What's wrong with a phone number, in words, or null if it's fine. */
export function phoneProblem(value: string): string | null {
  if (isValidPhone(value)) return null;
  if (isInternationalInput(value)) {
    return INTERNATIONAL_PHONES
      ? "Enter your full international number: + and the country code, then the number (8 to 15 digits), like +44 20 7946 0958."
      : `For now we can only take a US or Canadian (+1) phone number. If you don't have one, email ${GENERAL_CONTACT_EMAIL} and we'll help you apply.`;
  }
  return "Enter a 10-digit phone number.";
}

/** "+44 20 7946 0958": the digits as typed, with any run of spaces, dashes, dots or brackets as one space. */
function formatInternational(value: string) {
  let out = "+";
  let digits = 0;
  for (const ch of value.replace(/^\s*\+/, "")) {
    if (/\d/.test(ch)) {
      if (digits < 15) { out += ch; digits++; }
    } else if (/[\s().\-/]/.test(ch) && out !== "+" && !out.endsWith(" ")) {
      out += " ";
    }
  }
  return out;
}

export function formatPhone(value: string) {
  if (isInternationalInput(value)) return formatInternational(value);
  const d = phoneDigits(value);
  if (d.length === 0) return "";
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

type AriaProps = { "aria-invalid"?: boolean; "aria-describedby"?: string; "aria-labelledby"?: string };

export function PhoneInput({ value, onChange, id, ...aria }: { value: string; onChange: (value: string) => void; id?: string } & AriaProps) {
  const ref = useRef<HTMLInputElement>(null);
  // The browser's own check says what's wrong, in the same words as the form.
  useEffect(() => { ref.current?.setCustomValidity(value ? phoneProblem(value) ?? "" : ""); }, [value]);
  return (
    <input
      ref={ref}
      id={id}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder="(858) 555-0123"
      required
      value={value}
      onChange={e => onChange(formatPhone(e.target.value))}
      {...aria}
    />
  );
}

/**
 * A textarea with a visible "120 / 3,000" count. Typing stops at the limit (like
 * maxLength); a paste that would go over it isn't cut off silently: it's refused,
 * with a message saying how long it was.
 */
export function LimitedTextarea({ value, onChange, maxLength, ...props }: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  maxLength: number;
  rows?: number;
  required?: boolean;
  minLength?: number;
  id?: string;
}) {
  const [rejected, setRejected] = useState<number | null>(null);
  const counterId = useId();
  const near = value.length >= maxLength * 0.9;
  return (
    <>
      <textarea
        {...props}
        maxLength={maxLength}
        value={value}
        aria-describedby={counterId}
        onChange={e => { setRejected(null); onChange(e); }}
        onPaste={e => {
          const pasted = e.clipboardData.getData("text");
          const t = e.currentTarget;
          const length = t.value.length - (t.selectionEnd - t.selectionStart) + pasted.length;
          if (length > maxLength) {
            e.preventDefault();
            setRejected(length);
          }
        }}
      />
      <span className={`sp-counter${near ? " near" : ""}`} id={counterId} aria-hidden="true">
        {value.length.toLocaleString("en-US")} / {maxLength.toLocaleString("en-US")} characters
      </span>
      {rejected !== null && (
        <span className="sp-field-message" role="alert">
          That paste would make this answer {rejected.toLocaleString("en-US")} characters, over the {maxLength.toLocaleString("en-US")} limit, so
          it wasn't added. Shorten it and paste again.
        </span>
      )}
    </>
  );
}

/**
 * A native date input that looks empty until someone picks a date. Safari draws
 * today's date in grey in an empty one, which reads as already filled in; while
 * it's empty and not focused, its text is hidden behind a "MM/DD/YYYY" hint
 * (styled in end-theme.css). The input itself is untouched: same picker, same
 * value ("YYYY-MM-DD"), same validation.
 */
export function DateInput({ value, onChange, min, max, required = true, id, ...aria }: {
  value: string; onChange: (value: string) => void; min?: string; max?: string; required?: boolean; id?: string;
} & AriaProps) {
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
        {...aria}
      />
      <span className="sp-date-hint" aria-hidden="true">MM/DD/YYYY</span>
    </span>
  );
}

/** A dropdown that allows picking several options. */
export function MultiSelect({ options, value, onChange, placeholder = "Select all that apply", id, ...aria }: {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  id?: string;
} & AriaProps) {
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
      <button type="button" id={id} className="sp-multiselect-button" aria-expanded={open} onClick={() => setOpen(o => !o)} {...aria}
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
export function YesNo({ name, value, onChange, id }: { name: string; value: boolean | null; onChange: (value: boolean) => void; id?: string }) {
  return (
    <div className="sp-yesno" role="radiogroup">
      {[true, false].map(option => (
        <label key={String(option)} className="sp-check">
          {/* `id` goes on "Yes", so a problem with the answer can focus the group. */}
          <input id={option && id ? id : undefined} type="radio" name={name} required checked={value === option} onChange={() => onChange(option)} />
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
