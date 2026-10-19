import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { CheckCircle2, PenLine } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useStaffPortal } from "./StaffPortalContext";
import { DOCUSIGN } from "./config";

// DocuSign's embedding script ("focused view"), which mounts the signing session in the page.
const BUNDLE_URL = { demo: "https://js-d.docusign.com/bundle.js", production: "https://js.docusign.com/bundle.js" };

type SigningSession = {
  on: (event: "ready" | "sessionEnd", handler: (event: { sessionEndType?: string }) => void) => void;
  mount: (selector: string) => void;
};
declare global {
  interface Window {
    DocuSign?: { loaded: (opts: { clientId: string }) => Promise<{ signing: (opts: { url: string; displayFormat: "focused" }) => SigningSession }> };
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
const ENVELOPE_KEY = "datahacks.staffPortal.waiverEnvelope";
const storedEnvelope = () => { try { return sessionStorage.getItem(ENVELOPE_KEY); } catch { return null; } };
const storeEnvelope = (id: string) => { try { sessionStorage.setItem(ENVELOPE_KEY, id); } catch { /* storage blocked */ } };

async function callWaiverFunction<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("docusign-waiver", { body });
  if (error) {
    const message = await error.context?.json?.().then((b: { error?: string }) => b.error).catch(() => undefined);
    throw new Error(message ?? "Something went wrong talking to DocuSign.");
  }
  return data as T;
}

type Phase = "idle" | "loading" | "signing" | "verifying" | "signed";

const END_MESSAGES: Record<string, string> = {
  cancel: "You closed the waiver before finishing. Start again when you're ready.",
  decline: "You declined to sign. You'll need a signed waiver to take part.",
  session_timeout: "The signing session timed out. Start again to continue.",
  ttl_expired: "The signing link expired. Start again to continue.",
};

export default function Waiver() {
  const { basePath, status, waiverSubmitted, submitWaiver } = useStaffPortal();
  const { search } = useLocation();
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const configured = Boolean(DOCUSIGN.clientId);

  // Asks the server, which asks DocuSign; the browser's word isn't enough.
  const verify = useCallback(async (envelopeId: string) => {
    setPhase("verifying");
    try {
      const { signed } = await callWaiverFunction<{ signed: boolean }>({ action: "status", envelopeId });
      setPhase(signed ? "signed" : "idle");
      if (!signed) setMessage("No signature detected on the waiver yet.");
    } catch (e) {
      setPhase("idle");
      setMessage((e as Error).message);
    }
  }, []);

  useEffect(() => {
    const envelopeId = storedEnvelope();
    if (configured && envelopeId && !waiverSubmitted) verify(envelopeId);
  }, [configured, verify, waiverSubmitted]);

  if (status !== "accepted") return <Navigate to={{ pathname: basePath, search }} replace />;

  const startSigning = async () => {
    setMessage(null);
    setPhase("loading");
    try {
      const [{ url, envelopeId }] = await Promise.all([
        callWaiverFunction<{ url: string; envelopeId: string }>({ action: "start", envelopeId: storedEnvelope(), returnPath: `${basePath}/waiver` }),
        loadBundle(),
      ]);
      storeEnvelope(envelopeId);
      const docusign = await window.DocuSign!.loaded({ clientId: DOCUSIGN.clientId });
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

  const handleSubmit = async () => {
    setSubmitting(true);
    await submitWaiver();
    setSubmitting(false);
  };

  const signed = phase === "signed";

  return (
    <div className="sp-page">
      <header className="sp-page-header">
        <h1>Liability Waiver</h1>
        <p>Every mentor and judge needs a signed waiver on file before the event.</p>
      </header>

      <section className="sp-card">
        {waiverSubmitted ? (
          <div className="sp-done">
            <CheckCircle2 size={36} aria-hidden />
            <h2>Waiver submitted</h2>
            <p>Thanks — you're all set. <Link to={{ pathname: basePath, search }}>Back to dashboard</Link></p>
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
              <div id="sp-docusign" className={phase === "signing" ? "sp-docusign active" : "sp-docusign"} />
            </li>
            <li>
              <h2>Submit</h2>
              <p>{signed ? "Your signature is on file. Submit to finish." : "Available once your signature is detected."}</p>
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
