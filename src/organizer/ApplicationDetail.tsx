import { useState } from "react";
import { ExternalLink, Maximize2, Minimize2, X } from "lucide-react";
import { safeHref, safeMailto } from "@/lib/applicantInput";
import { applicationBatch } from "@/staff-portal/config";
import { OVERNIGHT_STAY, TEAM_MATCHING, UCSD_AFFILIATION } from "@/staff-portal/formOptions";
import { stageDecision, stageProblems, useApplication, useEventId } from "./data";
import { errorText } from "./errors";
import { useStoredFlag } from "./storedFlag";
import { DECISION_LABEL, TAB_LABEL, TYPE_LABEL, fullName, isDraft, isStaged, placeOf, tabOf, type Decision, type Row } from "./types";

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

/** The form's wording for a saved code (OVERNIGHT_STAY, TEAM_MATCHING, UCSD_AFFILIATION); unknown codes as saved. */
const labelOf = (options: Record<string, string>, code: string | null) =>
  code ? Object.keys(options).find(label => options[label] === code) ?? code : null;

/** Shown for an optional question they skipped, so it doesn't look like the drawer left it out. */
const BLANK = "(left blank)";

/** `long` answers (essays) take the whole width when the drawer is expanded. */
function Field({ label, value, long = false }: { label: string; value: React.ReactNode; long?: boolean }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className={long ? "og-field og-field-long" : "og-field"}>
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
  // Opens wide if it was wide last time.
  const [expanded, toggleExpanded] = useStoredFlag("og-drawer-expanded");

  const stage = async (decision: Decision | null) => {
    setBusy(true);
    setError(null);
    try {
      // With the version this page loaded: if someone else decided since, theirs stands and we say so.
      const outcome = await stageDecision([row], decision);
      setError(stageProblems(outcome, () => fullName(row)));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      onChanged();
    }
  };
  const draft = isDraft(row);
  // A draft hasn't answered anything yet, so nothing counts as skipped.
  const skipped = draft ? null : BLANK;

  const hacker = row.applicant_type === "hacker";
  return (
    <aside className={expanded ? "og-drawer og-drawer-expanded" : "og-drawer"} aria-label={`Application from ${fullName(row)}`}>
      <header className="og-drawer-header">
        <div>
          <h2>{fullName(row)}</h2>
          <p>
            {TYPE_LABEL[row.applicant_type]} · {draft ? "Draft (not submitted)" : TAB_LABEL[placeOf(row)]}
            {isStaged(row) && <span className={`og-badge ${row.decision}`}>Not released{tabOf(row.status) !== "applied" ? ` · they still see ${TAB_LABEL[tabOf(row.status)].toLowerCase()}` : ""}</span>}
          </p>
        </div>
        <div className="og-drawer-actions">
          <button className="og-icon-button og-expand" onClick={toggleExpanded} aria-pressed={expanded}
            aria-label={expanded ? "Shrink the application" : "Expand the application"} title={expanded ? "Shrink" : "Expand"}>
            {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button className="og-icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
      </header>

      <div className="og-decide">
        {(["accepted", "waitlisted", "rejected"] as const).map(d => (
          <button key={d} className={`sp-button og-decide-${d}${row.decision === d ? " selected" : ""}`} disabled={busy || draft} onClick={() => stage(d)}>
            {DECISION_LABEL[d]}
          </button>
        ))}
        <button className="sp-button" disabled={busy || row.decision === null} onClick={() => stage(null)}>Clear</button>
      </div>
      {draft
        ? <p className="og-hint">They haven't submitted yet, so this can't be decided. It moves to Applied once they submit.</p>
        : <p className="og-hint">The row moves to that tab now. The applicant isn't told, and nothing changes for them, until you release decisions.</p>}
      {row.decision && row.decided_at && (
        <p className="og-decided">
          {DECISION_LABEL[row.decision]}ed{row.decided_by ? ` by ${row.decided_by}` : ""}, {formatDate(row.decided_at)}
        </p>
      )}
      {error && <p className="sp-error" role="alert">{error}</p>}

      <dl className="og-fields">
        <Field label="Email" value={row.email && <Email email={row.email} />} />
        <Field label="Phone" value={row.phone} />
        <Field label="Submitted" value={formatDate(row.submitted_at)} />
        <Field label="Batch" value={draft ? "Draft" : applicationBatch(row.submitted_at) === "priority" ? "Priority" : "Regular"} />
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
            <Field label="Birthdate" value={app.birthdate} />
            <Field label="Lives in" value={[app.city_of_residence, app.country_of_residence].filter(Boolean).join(", ") || null} />
            <Field label="Hackathons before" value={app.hackathon_experience} />
            <Field label="Been to DataHacks before" value={app.attended_before === null ? null : app.attended_before ? "Yes" : "No"} />
            <Field label="Resume" value={app.resume_url && <Link href={app.resume_url} />} />
            <Field label="LinkedIn" value={app.linkedin_url && <Link href={app.linkedin_url} />} />
            <Field label="GitHub" value={app.github_url && <Link href={app.github_url} />} />
            <Field label="Devpost" value={app.devpost_url ? <Link href={app.devpost_url} /> : skipped} />
            <Field label="Travel reimbursement" value={app.wants_travel_stipend
              ? [app.travel_region, app.travel_method, app.travel_distance].filter(Boolean).join(" · ") + (app.travel_stipend_reason ? ` (${app.travel_stipend_reason})` : "")
              : "No"} long={!!app.travel_stipend_reason} />
            <Field label="Project they're proudest of" value={app.essay_proudest_project} long />
            <Field label="Something unique they'd bring" value={app.essay_unique_thing} long />
            <Field label="What they want from the event" value={app.essay_goal} long />
            <Field label="Funniest joke" value={app.funniest_joke || skipped} long />
            <Field label="A lifetime goal" value={app.lifetime_goal || skipped} long />
            <Field label="Suggested food" value={app.suggested_food} />
            <Field label="Suggested activity" value={app.suggested_activity} />
            <Field label="Heard about us" value={app.heard_about?.join(", ")} />
            <Field label="Emergency contact" value={[app.emergency_contact_name, app.emergency_contact_relation, app.emergency_contact_phone].filter(Boolean).join(" · ")} />
            <Field label="Dietary restrictions" value={app.emergency_contact_name || app.shirt_size ? app.dietary_restrictions ?? "None" : null} />
            <Field label="T-shirt size" value={app.shirt_size} />
            <Field label="Staying overnight" value={labelOf(OVERNIGHT_STAY, app.overnight_stay)} />
            <Field label="Teammates" value={labelOf(TEAM_MATCHING, app.team_matching)} />
            <Field label="Event details from" value={app.logistics_source === "dh26_import" ? "Their DataHacks 2026 application" : null} />
          </>
        ) : (
          <>
            <Field label="Organization" value={app.organization} />
            <Field label="Role" value={app.role_title} />
            <Field label="UCSD affiliation" value={labelOf(UCSD_AFFILIATION, app.ucsd_affiliation)} />
            <Field label="Judging track" value={app.judging_track?.replace(/_/g, " ")} />
            <Field label="Resume" value={app.resume_url && <Link href={app.resume_url} />} />
            <Field label="LinkedIn" value={app.linkedin_url && <Link href={app.linkedin_url} />} />
            <Field label="Mentor blurb" value={app.bio} long />
            <Field label="Heard about us" value={app.heard_about?.join(", ")} />
          </>
        ))}
      </dl>
      {full.isPending && <p className="og-hint">Loading the application…</p>}
      {full.isError && <p className="sp-error">Couldn't load the rest of this application: {(full.error as Error).message}</p>}
    </aside>
  );
}
