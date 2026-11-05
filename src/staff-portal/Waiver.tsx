import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { CheckCircle2, ExternalLink, PenLine } from "lucide-react";
import { useStaffPortal } from "./StaffPortalContext";
import { DOCUSIGN } from "./config";
import { EVENT_CODE } from "@/portal/event";
import MockSigning, { type MockSessionEnd } from "./MockSigning";
import { callWaiverFunction, type WaiverStatus } from "./waiverFunction";
import { powerFormLink, powerFormOpen } from "./powerForm";

// DocuSign's embedding script ("focused view"), which mounts the signing session in the page.
const BUNDLE_URL = { demo: "https://js-d.docusign.com/bundle.js", production: "https://js.docusign.com/bundle.js" };

type SigningSession = {
  on: (event: "ready" | "sessionEnd", handler: (event: { sessionEndType?: string }) => void) => void;
  mount: (selector: string) => void;
};
declare global {
  interface Window {
    // bundle.js exposes loadDocuSign(integrationKey); there is no `loaded`.
    DocuSign?: { loadDocuSign: (clientId: string) => Promise<{ signing: (opts: { url: string; displayFormat: "focused" }) => SigningSession }> };
  }
}

let bundle: Promise<void> | null = null;
const loadBundle = () =>
  (bundle ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = BUNDLE_URL[DOCUSIGN.environment];
    script.onload = () => resolve();
    script.onerror = () => { bundle = null; reject(new Error("Couldn't load DocuSign.")); };
    document.head.appendChild(script);
  }));

// Remembers this visit's envelope so a refresh re-checks it instead of starting over.
const ENVELOPE_KEY = `datahacks.staffPortal.waiverEnvelope.${EVENT_CODE}`;
const storedEnvelope = () => { try { return sessionStorage.getItem(ENVELOPE_KEY); } catch { return null; } };
const storeEnvelope = (id: string) => { try { sessionStorage.setItem(ENVELOPE_KEY, id); } catch { /* storage blocked */ } };

type Phase = "idle" | "loading" | "signing" | "verifying" | "signed";

const END_MESSAGES: Record<string, string> = {
  cancel: "You closed the waiver before finishing. Start again when you're ready.",
  decline: "You declined to sign. You'll need a signed waiver to take part.",
  session_timeout: "The signing session timed out. Start again to continue.",
  ttl_expired: "The signing link expired. Start again to continue.",
};

/**
 * The waiver page. DOCUSIGN.mode picks how people sign: a PowerForm link on UC San
 * Diego's DocuSign (organizers import who signed), or embedded signing through the
 * docusign-waiver edge function. Either way, "signed" comes from public.waivers.
 */
export default function Waiver() {
  return DOCUSIGN.mode === "embedded" ? <EmbeddedWaiver /> : <PowerFormWaiver />;
}

function PowerFormWaiver() {
  const { basePath, status, waiverSubmitted, signer, preview, submitWaiver, resetWaiver } = useStaffPortal();
  const { search } = useLocation();
  if (status !== "accepted") return <Navigate to={{ pathname: basePath, search }} replace />;

  // Dev `?preview&waiver=ready` shows the live button before the waiver is published.
  const open = powerFormOpen(preview && new URLSearchParams(search).get("waiver") === "ready" ? { ...DOCUSIGN, waiverPublished: true } : DOCUSIGN);
  const link = open ? powerFormLink(signer) : null;

  return (
    <div className="sp-page">
      <header className="sp-page-header">
        <h1>Liability Waiver</h1>
        <p>Everyone taking part (hackers, mentors and judges) needs a signed waiver on file before the event.</p>
        <p className="sp-waiver-line">
          Waiver:{" "}
          <span className={waiverSubmitted ? "sp-complete" : "sp-incomplete"}>{waiverSubmitted ? "Signed" : "Not on file yet"}</span>
        </p>
      </header>

      <section className="sp-card">
        {waiverSubmitted ? (
          <div className="sp-done">
            <CheckCircle2 size={36} aria-hidden />
            <h2>Waiver on file</h2>
            <p>Thanks, you're all set. <Link to={{ pathname: basePath, search }}>Back to dashboard</Link></p>
            {preview && (
              <button className="sp-link-button" onClick={resetWaiver}>Reset waiver (preview only)</button>
            )}
          </div>
        ) : (
          <ol className="sp-steps">
            <li>
              <h2>Sign on DocuSign</h2>
              {link ? (
                <>
                  <p>
                    The waiver opens on UC San Diego's DocuSign in a new tab, with your name and email filled in.
                    DocuSign emails you a code to confirm that email, then you sign. Keep the email as it is so we
                    can match your signature to you.
                  </p>
                  <a className="sp-button primary" href={link} target="_blank" rel="noopener noreferrer">
                    <PenLine size={16} aria-hidden /> Sign the waiver <ExternalLink size={14} aria-hidden />
                  </a>
                </>
              ) : (
                <>
                  <p>The waiver isn't open for signing yet. Check back here soon.</p>
                  <button className="sp-button" disabled>Waiver opens soon</button>
                </>
              )}
            </li>
            <li>
              <h2>It shows up here</h2>
              <p>
                Signed? It shows here within a day once we sync with DocuSign. DocuSign also emails you a copy when
                you finish; if it isn't showing by the event, show that email at check-in.
              </p>
              {preview && link && (
                <button className="sp-link-button" onClick={() => submitWaiver(null)}>Pretend DocuSign synced (preview only)</button>
              )}
            </li>
          </ol>
        )}
      </section>
    </div>
  );
}

/** DocuSign signing embedded in the page, through the docusign-waiver edge function. */
function EmbeddedWaiver() {
  const { basePath, status, waiverSubmitted, submitWaiver, preview, resetWaiver } = useStaffPortal();
  const { search } = useLocation();
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // In dev `?preview`, a simulated DocuSign stands in for the real one.
  const simulated = preview;
  const configured = simulated || Boolean(DOCUSIGN.clientId);

  const settle = useCallback((signed: boolean) => {
    setPhase(signed ? "signed" : "idle");
    // Keep a more specific message (closed, declined…) if the session end set one.
    if (!signed) setMessage(m => m ?? "No signature detected on the waiver yet.");
  }, []);

  // Asks the server, which asks DocuSign; the browser's word isn't enough. A completed
  // envelope is also recorded in the database then, so the check-in desk can see it.
  const verify = useCallback(async (envelopeId: string) => {
    setPhase("verifying");
    try {
      const { signed } = await callWaiverFunction<WaiverStatus>({ action: "status", envelopeId });
      settle(signed);
    } catch (e) {
      setPhase("idle");
      setMessage((e as Error).message);
    }
  }, [settle]);

  useEffect(() => {
    const envelopeId = storedEnvelope();
    if (!simulated && configured && envelopeId && !waiverSubmitted) verify(envelopeId);
  }, [simulated, configured, verify, waiverSubmitted]);

  if (status !== "accepted") return <Navigate to={{ pathname: basePath, search }} replace />;

  const endMockSession = (end: MockSessionEnd, signed: boolean) => {
    if (end !== "signing_complete") setMessage(END_MESSAGES[end]);
    setPhase("verifying");
    // Pretend round trip to the server's signature check.
    window.setTimeout(() => settle(signed), 700);
  };

  const startSigning = async () => {
    setMessage(null);
    if (simulated) { setPhase("signing"); return; }
    setPhase("loading");
    try {
      const [{ url, envelopeId }] = await Promise.all([
        callWaiverFunction<{ url: string; envelopeId: string }>({ action: "start", envelopeId: storedEnvelope(), returnPath: `${basePath}/waiver` }),
        loadBundle(),
      ]);
      storeEnvelope(envelopeId);
      const docusign = await window.DocuSign!.loadDocuSign(DOCUSIGN.clientId);
      const signing = docusign.signing({ url, displayFormat: "focused" });
      signing.on("sessionEnd", event => {
        const end = event.sessionEndType ?? "";
        if (end !== "signing_complete") setMessage(END_MESSAGES[end] ?? null);
        verify(envelopeId);
      });
      setPhase("signing");
      signing.mount("#sp-docusign");
    } catch (e) {
      setPhase("idle");
      setMessage((e as Error).message);
    }
  };

  // Submit re-checks with the server (which records the waiver), rather than trusting this page.
  const handleSubmit = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      await submitWaiver(storedEnvelope());
    } catch (e) {
      setMessage((e as Error).message);
    }
    setSubmitting(false);
  };

  const signed = phase === "signed";

  return (
    <div className="sp-page">
      <header className="sp-page-header">
        <h1>Liability Waiver</h1>
        <p>Everyone taking part (hackers, mentors and judges) needs a signed waiver on file before the event.</p>
        <p className="sp-waiver-line">
          Waiver submission:{" "}
          <span className={waiverSubmitted ? "sp-complete" : "sp-incomplete"}>{waiverSubmitted ? "Completed" : "Incomplete"}</span>
        </p>
      </header>

      <section className="sp-card">
        {waiverSubmitted ? (
          <div className="sp-done">
            <CheckCircle2 size={36} aria-hidden />
            <h2>Waiver submitted</h2>
            <p>Thanks — you're all set. <Link to={{ pathname: basePath, search }}>Back to dashboard</Link></p>
            {preview && (
              <button className="sp-link-button" onClick={() => { resetWaiver(); setPhase("idle"); setMessage(null); }}>
                Reset waiver (preview only)
              </button>
            )}
          </div>
        ) : (
          <ol className="sp-steps">
            <li>
              <h2>Sign the waiver</h2>
              {signed ? (
                <p className="sp-signed"><CheckCircle2 size={16} aria-hidden /> Signature detected</p>
              ) : (
                <>
                  <p>Read the waiver below and add your name and signature.</p>
                  {!configured ? (
                    <button className="sp-button" disabled>Waiver document coming soon</button>
                  ) : phase === "idle" || phase === "loading" ? (
                    <button className="sp-button" onClick={startSigning} disabled={phase === "loading"}>
                      <PenLine size={16} aria-hidden /> {phase === "loading" ? "Opening waiver…" : "Start signing"}
                    </button>
                  ) : phase === "verifying" ? (
                    <p>Checking your signature…</p>
                  ) : null}
                  {message && <p className="sp-error" role="alert">{message}</p>}
                </>
              )}
              {simulated && phase === "signing" && <MockSigning onEnd={endMockSession} />}
              <div id="sp-docusign" className={!simulated && phase === "signing" ? "sp-docusign active" : "sp-docusign"} />
            </li>
            <li>
              <h2>Submit</h2>
              <p>{signed ? "Your signature is on file. Submit to finish." : "Available once your signature is detected."}</p>
              <button className="sp-button primary" disabled={!signed || submitting} onClick={handleSubmit}>
                {submitting ? "Submitting…" : "Submit waiver"}
              </button>
              {signed && message && <p className="sp-error" role="alert">{message}</p>}
            </li>
          </ol>
        )}
      </section>
    </div>
  );
}
