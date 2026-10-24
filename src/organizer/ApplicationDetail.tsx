import { useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { applicationBatch } from "@/staff-portal/config";
import { stageDecision } from "./data";
import { DECISION_LABEL, TAB_LABEL, TYPE_LABEL, fullName, isStaged, placeOf, tabOf, type Decision, type Row } from "./types";

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="og-field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

const Link = ({ href }: { href: string | null }) =>
  href ? <a href={href} target="_blank" rel="noreferrer">{href} <ExternalLink size={12} aria-hidden /></a> : null;

/** Everything one person submitted, with buttons that stage a decision. */
export default function ApplicationDetail({ row, onClose, onChanged }: { row: Row; onClose: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stage = async (decision: Decision | null) => {
    setBusy(true);
    setError(null);
    try {
      await stageDecision([row.id], decision);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const hacker = row.applicant_type === "hacker";
  return (
    <aside className="og-drawer" aria-label={`Application from ${fullName(row)}`}>
      <header className="og-drawer-header">
        <div>
          <h2>{fullName(row)}</h2>
          <p>
            {TYPE_LABEL[row.applicant_type]} · {TAB_LABEL[placeOf(row)]}
            {isStaged(row) && <span className={`og-badge ${row.decision}`}>Not released{tabOf(row.status) !== "applied" ? ` · they still see ${TAB_LABEL[tabOf(row.status)].toLowerCase()}` : ""}</span>}
          </p>
        </div>
        <button className="og-icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </header>

      <div className="og-decide">
        {(["accepted", "waitlisted", "rejected"] as const).map(d => (
          <button key={d} className={`sp-button og-decide-${d}${row.decision === d ? " selected" : ""}`} disabled={busy} onClick={() => stage(d)}>
            {DECISION_LABEL[d]}
          </button>
        ))}
        <button className="sp-button" disabled={busy || row.decision === null} onClick={() => stage(null)}>Clear</button>
      </div>
      <p className="og-hint">The row moves to that tab now. The applicant isn't told, and nothing changes for them, until you release decisions.</p>
      {error && <p className="sp-error">{error}</p>}

      <dl className="og-fields">
        <Field label="Email" value={row.email && <a href={`mailto:${row.email}`}>{row.email}</a>} />
        <Field label="Phone" value={row.phone} />
        <Field label="Submitted" value={formatDate(row.submitted_at)} />
        <Field label="Batch" value={applicationBatch(row.submitted_at) === "priority" ? "Priority" : "Regular"} />
        <Field label="Check-in code" value={row.code} />
        <Field label="Checked in" value={row.code ? (row.checkedIn ? "Yes" : "No") : null} />
        {hacker ? (
          <>
            <Field label="School" value={row.school} />
            <Field label="Level of study" value={row.level_of_study} />
            <Field label="Major" value={row.major} />
            <Field label="Graduation year" value={row.graduation_year} />
            <Field label="Gender" value={row.gender} />
            <Field label="Race/ethnicity" value={row.race_ethnicity} />
            <Field label="Lives in" value={[row.city_of_residence, row.country_of_residence].filter(Boolean).join(", ") || null} />
            <Field label="Hackathons before" value={row.hackathon_experience} />
            <Field label="Resume" value={<Link href={row.resume_url} />} />
            <Field label="LinkedIn" value={<Link href={row.linkedin_url} />} />
            <Field label="GitHub" value={<Link href={row.github_url} />} />
            <Field label="Devpost" value={<Link href={row.devpost_url} />} />
            <Field label="Travel reimbursement" value={row.wants_travel_stipend
              ? [row.travel_region, row.travel_method, row.travel_distance].filter(Boolean).join(" · ") + (row.travel_stipend_reason ? ` (${row.travel_stipend_reason})` : "")
              : "No"} />
            <Field label="Project they're proudest of" value={row.essay_proudest_project} />
            <Field label="Something unique they'd bring" value={row.essay_unique_thing} />
            <Field label="What they want from the event" value={row.essay_goal} />
            <Field label="Heard about us" value={row.heard_about?.join(", ")} />
          </>
        ) : (
          <>
            <Field label="Organization" value={row.organization} />
            <Field label="Role" value={row.role_title} />
            <Field label="Judging track" value={row.judging_track?.replace(/_/g, " ")} />
            <Field label="Resume" value={<Link href={row.resume_url} />} />
            <Field label="LinkedIn" value={<Link href={row.linkedin_url} />} />
            <Field label="Mentor blurb" value={row.bio} />
          </>
        )}
      </dl>
    </aside>
  );
}
