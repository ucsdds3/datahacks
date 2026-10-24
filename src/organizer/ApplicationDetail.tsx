import { useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { safeHref, safeMailto } from "@/lib/applicantInput";
import { applicationBatch } from "@/staff-portal/config";
import { stageDecision, useApplication, useEventId } from "./data";
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

/** An applicant's link. Only http(s) becomes clickable; anything else (javascript:, data:) is shown as text. */
function Link({ href }: { href: string | null }) {
  if (!href) return null;
  const safe = safeHref(href);
  return safe ? <a href={safe} target="_blank" rel="noopener noreferrer">{href} <ExternalLink size={12} aria-hidden /></a> : <>{href}</>;
}

function Email({ email }: { email: string | null }) {
  if (!email) return null;
  const mailto = safeMailto(email);
  return mailto ? <a href={mailto}>{email}</a> : <>{email}</>;
}

/**
 * Everything one person submitted, with buttons that stage a decision. The
 * table only has the list columns, so the whole application (essays and all)
 * is loaded here when the drawer opens. The decision and status come from the
 * table's row, which refreshes as soon as one is staged.
 */
export default function ApplicationDetail({ row, onClose, onChanged }: { row: Row; onClose: () => void; onChanged: () => void }) {
  const event = useEventId();
  const full = useApplication(event.data, row.id);
  const app = full.data;
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
        <Field label="Email" value={row.email && <Email email={row.email} />} />
        <Field label="Phone" value={row.phone} />
        <Field label="Submitted" value={formatDate(row.submitted_at)} />
        <Field label="Batch" value={applicationBatch(row.submitted_at) === "priority" ? "Priority" : "Regular"} />
        <Field label="Check-in code" value={row.code} />
        <Field label="Checked in" value={row.code ? (row.checkedIn ? "Yes" : "No") : null} />
        {app && (hacker ? (
          <>
            <Field label="School" value={app.school} />
            <Field label="Level of study" value={app.level_of_study} />
            <Field label="Major" value={app.major} />
            <Field label="Graduation year" value={app.graduation_year} />
            <Field label="Gender" value={app.gender} />
            <Field label="Race/ethnicity" value={app.race_ethnicity} />
            <Field label="Lives in" value={[app.city_of_residence, app.country_of_residence].filter(Boolean).join(", ") || null} />
            <Field label="Hackathons before" value={app.hackathon_experience} />
            <Field label="Resume" value={<Link href={app.resume_url} />} />
            <Field label="LinkedIn" value={<Link href={app.linkedin_url} />} />
            <Field label="GitHub" value={<Link href={app.github_url} />} />
            <Field label="Devpost" value={<Link href={app.devpost_url} />} />
            <Field label="Travel reimbursement" value={app.wants_travel_stipend
              ? [app.travel_region, app.travel_method, app.travel_distance].filter(Boolean).join(" · ") + (app.travel_stipend_reason ? ` (${app.travel_stipend_reason})` : "")
              : "No"} />
            <Field label="Project they're proudest of" value={app.essay_proudest_project} />
            <Field label="Something unique they'd bring" value={app.essay_unique_thing} />
            <Field label="What they want from the event" value={app.essay_goal} />
            <Field label="Heard about us" value={app.heard_about?.join(", ")} />
          </>
        ) : (
          <>
            <Field label="Organization" value={app.organization} />
            <Field label="Role" value={app.role_title} />
            <Field label="Judging track" value={app.judging_track?.replace(/_/g, " ")} />
            <Field label="Resume" value={<Link href={app.resume_url} />} />
            <Field label="LinkedIn" value={<Link href={app.linkedin_url} />} />
            <Field label="Mentor blurb" value={app.bio} />
          </>
        ))}
      </dl>
      {full.isPending && <p className="og-hint">Loading the application…</p>}
      {full.isError && <p className="sp-error">Couldn't load the rest of this application: {(full.error as Error).message}</p>}
    </aside>
  );
}
