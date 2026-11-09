import { useState } from "react";
import { Navigate } from "react-router-dom";
import { ClipboardCheck, DoorOpen, FileSignature, Mail, Send, ShieldCheck, Ticket, Users, UserCog } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { EVENT_CODE } from "@/portal/event";
import { portal } from "@/portal/paths";
import { SignedInAs, signOutTo } from "@/staff-portal/StaffPortalLayout";
import { switchGoogleAccount } from "@/portal/signIn";
import { usePortalTheme } from "@/portal/portalTheme";
import { Screen } from "@/staff-portal/StaffGate";
import { ThemeToggle } from "@/staff-portal/ThemeToggle";
import { NetherSky } from "@/staff-portal/nether/NetherSky";
import OrganizersPanel from "./OrganizersPanel";
import { GENERAL_CONTACT_EMAIL } from "@/staff-portal/config";
import ApplicationsTable from "./ApplicationsTable";
import CheckinPage from "./CheckinPage";
import EmailComposer from "./EmailComposer";
import ReleaseDialog, { type PassPick } from "./ReleaseDialog";
import PassesPage from "./PassesPage";
import DayOfPage from "./DayOfPage";
import WaiversPage from "./WaiversPage";
import { useApplications, useEventId, useRefreshApplications } from "./data";
import { isPreview } from "./preview";
import { isStaged, kindOf, passDue, unsentDecisionRows } from "./types";
import "@/staff-portal/staff-portal.css";
import "./organizer.css";

type Section = "hackers" | "staff" | "passes" | "waivers" | "checkin" | "dayof" | "email" | "organizers";

function Gate({ title, children }: { title: string; children?: React.ReactNode }) {
  // The Nether uses the portal's own sign-in screen (wall, lava, the switch); the End keeps the console's card.
  const nether = usePortalTheme() === "nether";
  if (nether) return <Screen title={title}>{children}</Screen>;
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
  { id: "passes", label: "Passes", icon: <Ticket size={18} />, title: "Wallet passes" },
  { id: "waivers", label: "Waivers", icon: <FileSignature size={18} />, title: "Liability waivers" },
  { id: "checkin", label: "Check-in", icon: <ClipboardCheck size={18} />, title: "Check-in" },
  { id: "dayof", label: "Day of", icon: <DoorOpen size={18} />, title: "Event day: no-shows & waitlist" },
  { id: "email", label: "Email", icon: <Mail size={18} />, title: "Email" },
  { id: "organizers", label: "Organizers", icon: <ShieldCheck size={18} />, title: "Organizers" },
];

/** `/portal/organizer`: review applications, release decisions and email people. */
export default function OrganizerConsole() {
  const auth = useAuth();
  // The End is the console's own green look (organizer.css); the Nether adds `og-nether` (nether-organizer.css).
  const nether = usePortalTheme() === "nether";
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
  // Who "Send pass" was pressed for in a table, to select on the Passes page; null when it was opened any other way.
  const [passPick, setPassPick] = useState<{ ids: string[]; n: number } | null>(null);
  // Set when the Passes page opens the Release dialog to release and then send passes.
  const [releasePick, setReleasePick] = useState<PassPick | undefined>(undefined);
  const openRelease = (pick?: PassPick) => { setReleasePick(pick); setDialog("release"); };
  const goTo = (s: Section) => { setPassPick(null); setSection(s); };
  const openPasses = (ids: string[]) => { setPassPick(prev => ({ ids, n: (prev?.n ?? 0) + 1 })); setSection("passes"); };

  if (loading) return <Gate title="Loading…" />;
  if (!session) return <Navigate to={portal.organizerLogin} replace />;
  if (!isOrganizer) {
    return (
      <Gate title="Organizers only">
        <p><strong>{session.user.email}</strong> isn't an organizer for {EVENT_CODE}.</p>
        <p>If it should be, ask an organizer to add you, or email <a href={`mailto:${GENERAL_CONTACT_EMAIL}`}>{GENERAL_CONTACT_EMAIL}</a>.</p>
        <button className="sp-button" onClick={() => switchGoogleAccount("organizer").catch(() => signOutTo(portal.organizerLogin))}>Use a different account</button>
      </Gate>
    );
  }
  if (event.isError) return <Gate title="Couldn't find the event"><p>{(event.error as Error).message}</p></Gate>;

  const rows = apps.data ?? [];
  const staged = rows.filter(isStaged).length;
  const unsent = unsentDecisionRows(rows).length;
  // Everyone accepted without a pass, released or not, minus anyone picked for a different decision since.
  const passesDue = rows.filter(passDue).length;
  const current = SECTIONS.find(s => s.id === section)!;

  return (
    <div className={`sp-root og-root${nether ? " og-nether" : ""}`}>
      {nether && <NetherSky />}
      <aside className="sp-sidebar og-sidebar">
        <div className="sp-brand">
          <img src="/datahacks-logo.png" alt="DataHacks" />
          <div>
            {/* The Nether hides the logo and spells the name out across its top bar. */}
            {nether && <strong>DataHacks</strong>}
            <span>Organizer console</span>
          </div>
        </div>
        <nav className="sp-nav" aria-label="Organizer">
          {SECTIONS.map(s => (
            <button key={s.id} className={`sp-nav-link og-nav-button${s.id === section ? " active" : ""}`} onClick={() => goTo(s.id)} aria-current={s.id === section ? "page" : undefined}>
              {s.icon} {s.label}
              {(s.id === "hackers" || s.id === "staff") && <span className="og-nav-count">{rows.filter(r => kindOf(r.applicant_type) === (s.id === "hackers" ? "hacker" : "staff")).length}</span>}
              {s.id === "passes" && passesDue > 0 && <span className="og-nav-count" aria-label={`${passesDue} to send`}>{passesDue}</span>}
            </button>
          ))}
        </nav>
        <div className="og-sidebar-footer">
          <ThemeToggle className="og-theme-toggle" />
          <span>Event</span>
          <strong>{EVENT_CODE}{preview && " · preview"}</strong>
          <SignedInAs email={session.user.email ?? ""} signOut={!preview} onSignOut={() => signOutTo(portal.organizerLogin)} />
        </div>
      </aside>

      <main className="sp-main og-main">
        <header className="og-topbar">
          <h1>{current.title}</h1>
          <div className="og-topbar-actions">
            {section !== "passes" && (
              <button className="sp-button" onClick={() => goTo("passes")}>
                <Ticket size={15} aria-hidden /> Passes ({passesDue} to send)
              </button>
            )}
            {unsent > 0 && (
              <button className="sp-button" onClick={() => setDialog("retry")}><Send size={15} aria-hidden /> Send {unsent} unsent decision email{unsent === 1 ? "" : "s"}</button>
            )}
            <button className="sp-button og-danger" disabled={staged === 0} onClick={() => openRelease()}>
              Release decisions ({staged} staged)
            </button>
          </div>
        </header>

        {apps.isPending && <p className="og-empty">Loading applications…</p>}
        {apps.isError && <p className="sp-error">Couldn't load applications: {(apps.error as Error).message}</p>}
        {apps.isSuccess && event.data && (
          section === "organizers"
            ? <OrganizersPanel eventId={event.data} myEmail={session.user.email ?? ""} />
            : section === "passes"
            ? <PassesPage
                key={passPick?.n ?? 0}
                eventId={event.data}
                rows={rows}
                initialSelected={passPick?.ids}
                onChanged={refresh}
                onReleaseAndSend={openRelease}
              />
            : section === "waivers"
            ? <WaiversPage eventId={event.data} rows={rows} onChanged={refresh} />
            : section === "checkin"
            ? <CheckinPage eventId={event.data} />
            : section === "dayof"
            ? <DayOfPage eventId={event.data} onChanged={refresh} />
            : section === "email"
            ? <EmailComposer eventId={event.data} rows={rows} />
            : <ApplicationsTable
                key={section}
                kind={section === "hackers" ? "hacker" : "staff"}
                rows={rows.filter(r => kindOf(r.applicant_type) === (section === "hackers" ? "hacker" : "staff"))}
                onChanged={refresh}
                onSendPasses={openPasses}
              />
        )}
      </main>

      {(dialog === "release" || dialog === "retry") && event.data && (
        <ReleaseDialog mode={dialog} eventId={event.data} rows={rows} passPick={dialog === "release" ? releasePick : undefined} onClose={() => setDialog(null)} onChanged={refresh} />
      )}
    </div>
  );
}
