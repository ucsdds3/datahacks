import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Send, Users, UserCog } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { EVENT_CODE } from "@/portal/event";
import { portal } from "@/portal/paths";
import { GENERAL_CONTACT_EMAIL } from "@/staff-portal/config";
import ApplicationsTable from "./ApplicationsTable";
import EmailComposer from "./EmailComposer";
import ReleaseDialog from "./ReleaseDialog";
import { useApplications, useEventId, useRefreshApplications } from "./data";
import { isPreview } from "./preview";
import { isStaged, kindOf, unsentDecisionRows } from "./types";
import "@/staff-portal/staff-portal.css";
import "./organizer.css";

type Section = "hackers" | "staff" | "email";

function Gate({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="sp-root sp-gate">
      <section className="sp-card">
        <img src="/datahacks-logo.png" alt="" />
        <h1>{title}</h1>
        {children}
      </section>
    </div>
  );
}

const SECTIONS: { id: Section; label: string; icon: React.ReactNode; title: string }[] = [
  { id: "hackers", label: "Hackers", icon: <Users size={18} />, title: "Hacker applications" },
  { id: "staff", label: "Mentors & judges", icon: <UserCog size={18} />, title: "Mentor & judge applications" },
  { id: "email", label: "Email", icon: <Mail size={18} />, title: "Email" },
];

/** `/portal/organizer`: review applications, release decisions and email people. */
export default function OrganizerConsole() {
  const auth = useAuth();
  const preview = isPreview();
  // Dev ?preview: sample applicants, no sign-in needed.
  const { session, isOrganizer, loading } = preview
    ? { session: { user: { email: "preview@ds3.club" } }, isOrganizer: true, loading: false }
    : auth;
  const event = useEventId();
  const apps = useApplications(isOrganizer ? event.data : undefined);
  const refresh = useRefreshApplications();
  const [section, setSection] = useState<Section>("hackers");
  const [dialog, setDialog] = useState<"release" | "retry" | null>(null);

  if (loading) return <Gate title="Loading…" />;
  if (!session) {
    return (
      <Gate title="Organizer console">
        <p>Sign in with your organizer Google account.</p>
        <Link className="sp-button primary" to={portal.login("hacker")}>Sign in</Link>
      </Gate>
    );
  }
  if (!isOrganizer) {
    return (
      <Gate title="Organizers only">
        <p><strong>{session.user.email}</strong> isn't an organizer for {EVENT_CODE}.</p>
        <p>If it should be, ask at <a href={`mailto:${GENERAL_CONTACT_EMAIL}`}>{GENERAL_CONTACT_EMAIL}</a> to be added.</p>
      </Gate>
    );
  }
  if (event.isError) return <Gate title="Couldn't find the event"><p>{(event.error as Error).message}</p></Gate>;

  const rows = apps.data ?? [];
  const staged = rows.filter(isStaged).length;
  const unsent = unsentDecisionRows(rows).length;
  const current = SECTIONS.find(s => s.id === section)!;

  return (
    <div className="sp-root og-root">
      <aside className="sp-sidebar og-sidebar">
        <div className="sp-brand">
          <img src="/datahacks-logo.png" alt="" />
          <div>
            <strong>DataHacks 2027</strong>
            <span>Organizer console</span>
          </div>
        </div>
        <nav className="sp-nav" aria-label="Organizer">
          {SECTIONS.map(s => (
            <button key={s.id} className={`sp-nav-link og-nav-button${s.id === section ? " active" : ""}`} onClick={() => setSection(s.id)}>
              {s.icon} {s.label}
              {s.id !== "email" && <span className="og-nav-count">{rows.filter(r => kindOf(r.applicant_type) === (s.id === "hackers" ? "hacker" : "staff")).length}</span>}
            </button>
          ))}
        </nav>
        <div className="og-sidebar-footer">
          <span>Event</span>
          <strong>{EVENT_CODE}{preview && " · preview"}</strong>
          <span>{session.user.email}</span>
        </div>
      </aside>

      <main className="sp-main og-main">
        <header className="og-topbar">
          <h1>{current.title}</h1>
          <div className="og-topbar-actions">
            {unsent > 0 && (
              <button className="sp-button" onClick={() => setDialog("retry")}><Send size={15} aria-hidden /> Send {unsent} unsent decision email{unsent === 1 ? "" : "s"}</button>
            )}
            <button className="sp-button og-danger" disabled={staged === 0} onClick={() => setDialog("release")}>
              Release decisions ({staged} staged)
            </button>
          </div>
        </header>

        {apps.isPending && <p className="og-empty">Loading applications…</p>}
        {apps.isError && <p className="sp-error">Couldn't load applications: {(apps.error as Error).message}</p>}
        {apps.isSuccess && event.data && (
          section === "email"
            ? <EmailComposer eventId={event.data} rows={rows} />
            : <ApplicationsTable
                key={section}
                kind={section === "hackers" ? "hacker" : "staff"}
                rows={rows.filter(r => kindOf(r.applicant_type) === (section === "hackers" ? "hacker" : "staff"))}
                onChanged={refresh}
              />
        )}
      </main>

      {dialog && event.data && (
        <ReleaseDialog mode={dialog} eventId={event.data} rows={rows} onClose={() => setDialog(null)} onChanged={refresh} />
      )}
    </div>
  );
}
