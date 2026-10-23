import { Link, useLocation } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { useStaffPortal } from "./StaffPortalContext";
import { GENERAL_CONTACT_EMAIL } from "./config";

/** The application tab once it's in: a confirmation, not the form again. */
export default function Questions() {
  const { basePath, status, submittedAt, portal } = useStaffPortal();
  const { search } = useLocation();
  const kind = portal === "hacker" ? "hacker" : "mentor / judge";

  return (
    <div className="sp-page">
      <header className="sp-page-header">
        <h1>Application</h1>
        <p>Your {kind} application for DataHacks.</p>
      </header>
      <section className="sp-card sp-submitted">
        <CheckCircle2 size={32} aria-hidden />
        <h2>Your application has been submitted</h2>
        <p>
          {submittedAt && <>We received it on {new Date(submittedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. </>}
          {status === "pending" ? "We're reviewing it now." : "A decision is on your Status page."}
        </p>
        <p className="sp-muted">
          Answers can't be changed after submitting. If something needs fixing, email{" "}
          <a href={`mailto:${GENERAL_CONTACT_EMAIL}`}>{GENERAL_CONTACT_EMAIL}</a>.
        </p>
        <Link className="sp-button" to={{ pathname: basePath, search }}>See your status</Link>
      </section>
    </div>
  );
}
