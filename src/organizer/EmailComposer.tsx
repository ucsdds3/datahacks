import { useMemo, useState } from "react";
import { Send } from "lucide-react";
import { SendError, sendEmails, useEmailQuota, useRefreshQuota, type SendResult } from "./data";
import { errorText } from "./errors";
import QuotaNote from "./QuotaNote";
import ReceivedEmailsCard from "./ReceivedEmailsCard";
import { PLACEHOLDERS, fillTemplate, varsFor } from "./templates";
import { TAB_LABEL, fullName, isDraft, kindOf, tabOf, type Row, type Tab } from "./types";
import { BLASTS, hasBlanks, type Audience } from "./blasts";
const AUDIENCE_LABEL: Record<Audience, string> = { all: "Everyone", hacker: "Hackers", staff: "Mentors & judges" };

/** Writes one message to a filtered group and sends it from the console. */
export default function EmailComposer({ eventId, rows }: { eventId: string; rows: Row[] }) {
  const [audience, setAudience] = useState<Audience>("all");
  const [status, setStatus] = useState<Tab | "any">("accepted");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("Hi {{first_name}},\n\n\n\nThe DataHacks team\ninfo@ds3.club");
  const [blastId, setBlastId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<SendResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const quota = useEmailQuota(eventId);
  const refreshQuota = useRefreshQuota();

  // Never drafts: they haven't applied yet.
  const recipients = useMemo(
    () => rows.filter(r => !isDraft(r) && (audience === "all" || kindOf(r.applicant_type) === audience) && (status === "any" || tabOf(r.status) === status)),
    [rows, audience, status],
  );
  const sample = recipients[0];
  const blanks = hasBlanks(subject, body);
  const usesQr = /\{\{\s*qr\s*\}\}/.test(body);
  const withoutCode = usesQr ? recipients.filter(r => !r.code).length : 0;
  const ready = recipients.length > 0 && subject.trim() !== "" && body.trim() !== "" && !blanks;
  const blast = BLASTS.find(b => b.id === blastId);

  const startFrom = (id: string) => {
    setBlastId(id);
    setConfirming(false);
    setResult(null);
    const preset = BLASTS.find(b => b.id === id);
    if (!preset) return;
    setAudience(preset.audience);
    setStatus(preset.status);
    setSubject(preset.subject);
    setBody(preset.body);
  };

  const send = async () => {
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const ids = recipients.map(r => r.id);
      const sent = await sendEmails(eventId, ids, subject, body, "blast", done => setProgress(`Sent ${done} of ${ids.length}…`));
      setResult(sent);
      setConfirming(false);
    } catch (e) {
      // Partway: what went out is recorded, so "Yes, send" again only reaches the rest.
      if (e instanceof SendError) setResult(e.partial);
      setError(`${errorText(e)}${e instanceof SendError ? " Press \"Yes, send\" again to send to the rest." : ""}`);
    } finally {
      setSending(false);
      setProgress("");
      refreshQuota();
    }
  };
  const remaining = quota.data?.remaining;

  return (
    <div className="og-email">
      <ReceivedEmailsCard eventId={eventId} />

      <section className="sp-card">
        <div className="sp-card-header"><h2>Start from</h2></div>
        <div className="og-filters">
          <label>Template
            <select value={blastId} onChange={e => startFrom(e.target.value)}>
              <option value="">Blank email</option>
              {BLASTS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </label>
          {blast && <p className="og-hint">Send: {blast.when}</p>}
        </div>
      </section>

      <section className="sp-card">
        <div className="sp-card-header"><h2>Recipients</h2></div>
        <div className="og-filters">
          <label>Who
            <select value={audience} onChange={e => { setAudience(e.target.value as Audience); setConfirming(false); }}>
              {(Object.keys(AUDIENCE_LABEL) as Audience[]).map(a => <option key={a} value={a}>{AUDIENCE_LABEL[a]}</option>)}
            </select>
          </label>
          <label>Status
            <select value={status} onChange={e => { setStatus(e.target.value as Tab | "any"); setConfirming(false); }}>
              <option value="any">Any status</option>
              {(Object.keys(TAB_LABEL) as Tab[]).map(t => <option key={t} value={t}>{TAB_LABEL[t]}</option>)}
            </select>
          </label>
          <p className="og-recipient-count"><strong>{recipients.length}</strong> recipient{recipients.length === 1 ? "" : "s"}</p>
        </div>
        <QuotaNote quota={quota.data ?? null} need={recipients.length} />
        {typeof remaining === "number" && recipients.length > remaining && (
          <p className="sp-error">Only {remaining} more email{remaining === 1 ? "" : "s"} can go out today, so this stops partway. The rest go out when you send again later.</p>
        )}
      </section>

      <section className="sp-card">
        <div className="sp-card-header"><h2>Message</h2></div>
        <div className="og-compose">
          <label>Subject<input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. DataHacks: what to bring on Saturday" /></label>
          <label>Body<textarea rows={10} value={body} onChange={e => setBody(e.target.value)} /></label>
          <p className="og-hint">
            Placeholders, filled in per person: {PLACEHOLDERS.map(p => `{{${p}}}`).join(" ")}. {"{{qr}}"} puts the person's check-in QR code in the email.
          </p>
          {blanks && <p className="sp-error">Fill in everything in [[double brackets]] before sending.</p>}
          {withoutCode > 0 && (
            <p className="sp-error">
              {withoutCode} recipient{withoutCode === 1 ? " has" : "s have"} no check-in code yet (only accepted people get one), so they won't be sent this email.
            </p>
          )}
        </div>
      </section>

      {sample && (
        <section className="sp-card">
          <div className="sp-card-header"><h2>Preview</h2><span className="og-hint">as {fullName(sample)} will see it</span></div>
          <div className="og-preview">
            <strong>{fillTemplate(subject, varsFor(sample)) || "(no subject)"}</strong>
            <pre>{fillTemplate(body, varsFor(sample))}</pre>
          </div>
        </section>
      )}

      {error && <p className="sp-error" role="alert">{error}</p>}
      {result && (
        <p className={result.failed.length || result.notSent.length ? "sp-error" : "og-success"}>
          Sent {result.sent} email{result.sent === 1 ? "" : "s"}.
          {result.skipped.length > 0 && ` ${result.skipped.length} already had this exact email, so weren't sent it again.`}
          {result.failed.length > 0 && ` ${result.failed.length} failed: ${result.failed.slice(0, 3).map(f => f.error).join("; ")}`}
          {result.stopped === "daily_limit" && ` Gmail's daily limit is reached: ${result.notSent.length} not sent yet. Send again once it frees up; nobody gets it twice.`}
        </p>
      )}


      <div className="og-send-row">
        {confirming ? (
          <>
            <span>Send this to {recipients.length} {recipients.length === 1 ? "person" : "people"} from DataHacks Team (info@ds3.club)? Anyone who already got this exact email is skipped.</span>
            <button className="sp-button" onClick={() => setConfirming(false)} disabled={sending}>Cancel</button>
            <button className="sp-button primary" onClick={send} disabled={sending}><Send size={15} aria-hidden /> {sending ? progress || "Sending…" : "Yes, send"}</button>
          </>
        ) : (
          <button className="sp-button primary" onClick={() => setConfirming(true)} disabled={!ready}><Send size={15} aria-hidden /> Send…</button>
        )}
      </div>
    </div>
  );
}
