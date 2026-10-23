import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/** The asterisk on a required field's label. */
export const Req = () => <span className="sp-req" aria-hidden="true">*</span>;

/** Phone numbers: exactly 10 digits, shown and saved as (858) 370-2478. */
export const phoneDigits = (value: string) => value.replace(/\D/g, "").slice(0, 10);
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

export const isHttpsUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};
