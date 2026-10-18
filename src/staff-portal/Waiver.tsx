import { useState } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { useStaffPortal } from "./StaffPortalContext";
import { WAIVER_URL } from "./config";

export default function Waiver() {
  const { status, waiverSubmitted, submitWaiver } = useStaffPortal();
  const { search } = useLocation();
  const [params] = useSearchParams();
  // DocuSign appends `event=signing_complete` when it redirects back after signing.
  const [signed, setSigned] = useState(params.get("event") === "signing_complete");
  const [submitting, setSubmitting] = useState(false);

  if (status !== "accepted") return <Navigate to={{ pathname: "/portal", search }} replace />;

  const handleSubmit = async () => {
    setSubmitting(true);
    await submitWaiver();
    setSubmitting(false);
  };

  return (
    <div className="sp-page">
      <header className="sp-page-header">
        <h1>Liability waiver</h1>
        <p>Every mentor and judge needs a signed waiver on file before the event.</p>
      </header>

      <section className="sp-card">
        {waiverSubmitted ? (
          <div className="sp-done">
            <CheckCircle2 size={36} aria-hidden />
            <h2>Waiver submitted</h2>
            <p>Thanks — you're all set. <Link to={{ pathname: "/portal", search }}>Back to dashboard</Link></p>
          </div>
        ) : (
          <ol className="sp-steps">
            <li>
              <h2>Sign the waiver in DocuSign</h2>
              <p>It opens in a new tab. Fill in your name and signature, then come back here.</p>
              {WAIVER_URL ? (
                <a className="sp-button" href={WAIVER_URL} target="_blank" rel="noreferrer">
                  Open waiver in DocuSign <ExternalLink size={16} aria-hidden />
                </a>
              ) : (
                <button className="sp-button" disabled>Waiver document coming soon</button>
              )}
            </li>
            <li>
              <h2>Submit</h2>
              <label className="sp-check">
                <input type="checkbox" checked={signed} onChange={e => setSigned(e.target.checked)} />
                I have signed the waiver in DocuSign.
              </label>
              <button className="sp-button primary" disabled={!signed || submitting} onClick={handleSubmit}>
                {submitting ? "Submitting…" : "Submit waiver"}
              </button>
            </li>
          </ol>
        )}
      </section>
    </div>
  );
}
