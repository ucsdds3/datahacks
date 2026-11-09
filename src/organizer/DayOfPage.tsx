import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, X } from "lucide-react";
import {
  emailOffers, eventDateTime, eventTime, fromEventInput, markNoShows, markable, nextOffers, offerSpots,
  openAfterMarking, phaseOf, saveSettings, toEventInput, unemailedOffers, unmarkNoShows, useOverview, withDeadline,
  type DaySettings, type OfferEmailOutcome, type Overview,
} from "./dayOf";
import ScanTypesCard from "./ScanTypesCard";
import { PLACEHOLDERS, type Template } from "./templates";
import { loadOfferTemplate, saveOfferTemplate } from "./templateStore";
import { errorText } from "./errors";

/**
 * The console's Day-of section. After check-in closes: see who didn't come,
 * mark them as no-shows (frees their spots, reversible), and offer the open
 * spots to waitlisted hackers who asked to be emailed, in the order they
 * asked. Each offer moves them to accepted (check-in code), emails them a
 * "come check in by HH:MM" note, then their wallet pass. Last, the meal
 * and swag scans the check-in desk can switch to.
 */
export default function DayOfPage({ eventId, onChanged }: { eventId: string; onChanged: () => void }) {
  const overview = useOverview(eventId);
  const client = useQueryClient();
  const reload = () => {
    client.invalidateQueries({ queryKey: ["waitlist-overview", eventId] });
    onChanged();
  };

  if (overview.isPending) return <p className="og-empty">Loading the event day…</p>;
  if (overview.isError) return <p className="sp-error">Couldn't load the event day: {(overview.error as Error).message}</p>;
  const o = overview.data;
  const phase = phaseOf(o);

  return (
    <div className="og-dayof">
      <Summary o={o} />
      <SettingsCard eventId={eventId} o={o} open={phase === "no-settings"} onSaved={reload} />
      {phase !== "no-settings" && (
        <>
          <NoShowsCard eventId={eventId} o={o} phase={phase} onChanged={reload} />
          <WaitlistCard eventId={eventId} o={o} onChanged={reload} />
          <OffersCard eventId={eventId} o={o} onChanged={reload} />
        </>
      )}
      <ScanTypesCard eventId={eventId} />
    </div>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Summary({ o }: { o: Overview }) {
  const { hacker_capacity: cap, checkin_cutoff_at: cutoff, ucsd_checkin_cutoff_at: ucsd } = o.settings;
  const now = Date.parse(o.now);
  const closes = (iso: string) => `${Date.parse(iso) <= now ? "closed" : "closes"} at ${eventTime(iso)}`;
  return (
    <section className="sp-card og-dayof-summary" aria-label="Check-in so far">
      <dl className="og-stats">
        <div><dt>Checked in</dt><dd>{o.checked_in}{cap !== null && <span> of {cap}</span>}</dd></div>
        <div><dt>Still expected</dt><dd>{o.expected}</dd></div>
        <div><dt>Open spots</dt><dd>{o.open_spots ?? "–"}</dd></div>
        <div><dt>Asked for a spot</dt><dd>{o.queue.length}<span> of {o.waitlisted} waitlisted</span></dd></div>
      </dl>
      <p className="og-hint">
        {cutoff
          ? <>Check-in {closes(cutoff)}{ucsd && <> (UC San Diego students: {closes(ucsd)})</>}. Times are Pacific.</>
          : <>Set a capacity and check-in cutoff below to start.</>}
        {" "}Open spots = capacity − checked in − still expected (accepted, not here yet, not marked as no-shows).
      </p>
    </section>
  );
}

function SettingsCard({ eventId, o, open, onSaved }: { eventId: string; o: Overview; open: boolean; onSaved: () => void }) {
  const s = o.settings;
  const [cap, setCap] = useState(s.hacker_capacity?.toString() ?? "");
  const [cutoff, setCutoff] = useState(toEventInput(s.checkin_cutoff_at));
  const [ucsd, setUcsd] = useState(toEventInput(s.ucsd_checkin_cutoff_at));
  const [windowMinutes, setWindowMinutes] = useState(String(s.offer_window_minutes));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const capacity = cap.trim() === "" ? null : Number(cap);
    const minutes = Number(windowMinutes);
    if (capacity !== null && (!Number.isInteger(capacity) || capacity < 0)) return setMessage({ ok: false, text: "Capacity must be a whole number." });
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 600) return setMessage({ ok: false, text: "The release window must be 5 to 600 minutes." });
    const next: DaySettings = {
      hacker_capacity: capacity,
      checkin_cutoff_at: fromEventInput(cutoff),
      ucsd_checkin_cutoff_at: fromEventInput(ucsd),
      offer_window_minutes: minutes,
    };
    setSaving(true);
    setMessage(null);
    try {
      await saveSettings(eventId, next);
      setMessage({ ok: true, text: "Saved." });
      onSaved();
    } catch (err) {
      setMessage({ ok: false, text: errorText(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <details className="sp-card og-dayof-settings" open={open}>
      <summary><h2>Settings</h2><span className="og-hint">{settingsLine(s)}</span></summary>
      <form onSubmit={save} className="og-dayof-form">
        <label>Hacker capacity<input type="number" min={0} inputMode="numeric" value={cap} onChange={e => setCap(e.target.value)} placeholder="e.g. 500" /></label>
        <label>Check-in closes (Pacific)<input type="datetime-local" value={cutoff} onChange={e => setCutoff(e.target.value)} /></label>
        <label>UC San Diego students close (optional)<input type="datetime-local" value={ucsd} onChange={e => setUcsd(e.target.value)} /></label>
        <label>Minutes to show up after an offer<input type="number" min={5} max={600} inputMode="numeric" value={windowMinutes} onChange={e => setWindowMinutes(e.target.value)} /></label>
        <div className="og-dayof-form-actions">
          <button className="sp-button primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save settings"}</button>
          {message && <span className={message.ok ? "og-success" : "sp-error"} role="status">{message.text}</span>}
        </div>
      </form>
      <p className="og-hint">UC San Diego students are matched by the school on their application. Leave their time empty to use the same cutoff for everyone.</p>
    </details>
  );
}

const settingsLine = (s: DaySettings) =>
  [
    s.hacker_capacity !== null ? `Capacity ${s.hacker_capacity}` : "No capacity set",
    s.checkin_cutoff_at ? `closes ${eventDateTime(s.checkin_cutoff_at)}` : "no cutoff set",
    s.ucsd_checkin_cutoff_at && `UCSD ${eventTime(s.ucsd_checkin_cutoff_at)}`,
    `${s.offer_window_minutes} min to show up`,
  ].filter(Boolean).join(" · ");

function Confirm({ title, children, confirmLabel, working, onConfirm, onCancel }: {
  title: string; children: React.ReactNode; confirmLabel: string; working: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !working) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [working, onCancel]);
  return (
    <div className="og-overlay" role="presentation" onClick={working ? undefined : onCancel}>
      <div className="og-modal" role="dialog" aria-modal="true" aria-labelledby="og-dayof-confirm" onClick={e => e.stopPropagation()}>
        <header className="og-modal-header">
          <h2 id="og-dayof-confirm">{title}</h2>
          {!working && <button className="og-icon-button" onClick={onCancel} aria-label="Close"><X size={18} /></button>}
        </header>
        <div className="og-modal-body">
          {children}
          <div className="og-modal-actions">
            <button className="sp-button" onClick={onCancel} disabled={working}>Cancel</button>
            <button className="sp-button og-danger" onClick={onConfirm} disabled={working}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NoShowsCard({ eventId, o, phase, onChanged }: { eventId: string; o: Overview; phase: "before-cutoff" | "after-cutoff"; onChanged: () => void }) {
  const late = markable(o);
  const after = openAfterMarking(o);
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string; undo?: string[] } | null>(null);

  const mark = async () => {
    setWorking(true);
    try {
      const marked = await markNoShows(eventId);
      setNote({ ok: true, text: `Marked ${plural(marked.length, "no-show")}.`, undo: marked.map(m => m.application_id) });
      onChanged();
    } catch (e) {
      setNote({ ok: false, text: errorText(e) });
    } finally {
      setWorking(false);
      setConfirming(false);
    }
  };
  const unmark = async (ids: string[]) => {
    setWorking(true);
    try {
      const n = await unmarkNoShows(eventId, ids);
      setNote({ ok: true, text: `Put back ${plural(n, "person", "people")}. Their codes check in again.` });
      onChanged();
    } catch (e) {
      setNote({ ok: false, text: errorText(e) });
    } finally {
      setWorking(false);
    }
  };

  return (
    <section className="sp-card og-dayof-card" aria-labelledby="og-noshows">
      <div className="sp-card-header">
        <h2 id="og-noshows">No-shows</h2>
        <button className="sp-button og-danger" disabled={working || late.length === 0} onClick={() => setConfirming(true)}>
          {late.length ? `Mark ${plural(late.length, "no-show")}` : "Mark no-shows"}
        </button>
      </div>
      {phase === "before-cutoff" && late.length === 0 ? (
        <p className="og-empty">Check-in hasn't closed yet, so nobody is a no-show.</p>
      ) : late.length === 0 ? (
        <p className="og-empty">Everyone accepted is here, marked, or still inside their window.</p>
      ) : (
        <>
          <p>
            <strong>{plural(late.length, "accepted hacker")}</strong> {late.length === 1 ? "is" : "are"} past their check-in
            deadline and not checked in. Marking them frees their spots{after !== null && <> ({after} open after)</>}; their codes stop working at the desk until you undo it.
          </p>
          <PeopleList people={late.map(a => ({
            id: a.application_id, name: a.name, email: a.email, code: a.code,
            tag: a.offered_at ? "Offer expired" : a.ucsd ? "UCSD" : null,
            when: a.deadline ? `Due ${eventTime(a.deadline)}` : "",
          }))} />
        </>
      )}
      <Note note={note} working={working} onUndo={note?.undo?.length ? () => unmark(note.undo!) : undefined} />

      {o.no_shows.length > 0 && (
        <details className="og-pass-role og-dayof-marked">
          <summary><span className="og-pass-role-name">Marked</span><span className="og-pass-count">{o.no_shows.length}</span></summary>
          <ul className="og-pass-rows">
            {o.no_shows.map(n => (
              <li key={n.application_id}>
                <div className="og-pass-row sent">
                  <span className="og-pass-who"><strong>{n.name}</strong></span>
                  <span className="og-pass-email">{n.email}</span>
                  <span className="og-pass-date">{n.code} · marked {eventTime(n.no_show_at)}</span>
                  <span className="og-pass-resend-cell">
                    <button className="sp-button" disabled={working} onClick={() => unmark([n.application_id])} aria-label={`Undo no-show for ${n.name}`}>Undo</button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}

      {confirming && (
        <Confirm title={`Mark ${plural(late.length, "no-show")}?`} confirmLabel={`Mark ${plural(late.length, "no-show")}`} working={working} onConfirm={mark} onCancel={() => setConfirming(false)}>
          <p>Everyone accepted who is past their deadline and not checked in is marked, frees their spot, and can't check in with their code.</p>
          <p className="og-hint">Nothing is deleted or emailed. Undo puts them back; someone who turns up later can be let in from the check-in desk if there's room.</p>
        </Confirm>
      )}
    </section>
  );
}

function WaitlistCard({ eventId, o, onChanged }: { eventId: string; o: Overview; onChanged: () => void }) {
  const next = nextOffers(o);
  const later = o.queue.slice(next.length);
  const [confirming, setConfirming] = useState(false);
  // Kept for this event, so "Email N people not emailed yet" sends the same words.
  const [template, setTemplateState] = useState<Template>(() => loadOfferTemplate(eventId));
  const setTemplate = (update: (t: Template) => Template) => setTemplateState(t => {
    const next = update(t);
    saveOfferTemplate(eventId, next);
    return next;
  });
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState("");
  const [outcome, setOutcome] = useState<{ offered: string[]; email: OfferEmailOutcome | null; error: string | null } | null>(null);
  const deadline = new Date(Date.parse(o.now) + o.settings.offer_window_minutes * 60_000).toISOString();
  const sample = withDeadline(template, deadline);

  const offer = async () => {
    setWorking(true);
    setOutcome(null);
    setProgress("Giving out spots…");
    let offered: Awaited<ReturnType<typeof offerSpots>> = [];
    try {
      offered = await offerSpots(eventId, next.length);
      onChanged();
      const email = offered.length
        ? await emailOffers(eventId, offered.map(x => ({ application_id: x.application_id, expires_at: x.offer_expires_at })), template, setProgress)
        : null;
      setOutcome({ offered: offered.map(x => x.name), email, error: null });
    } catch (e) {
      setOutcome({ offered: offered.map(x => x.name), email: null, error: errorText(e) });
    } finally {
      setWorking(false);
      setConfirming(false);
      onChanged();
    }
  };

  return (
    <section className="sp-card og-dayof-card" aria-labelledby="og-waitlist">
      <div className="sp-card-header">
        <h2 id="og-waitlist">Waitlist</h2>
        <button className="sp-button primary" disabled={working || next.length === 0} onClick={() => setConfirming(true)}>
          Offer {plural(next.length, "spot")}
        </button>
      </div>
      <p>
        {o.open_spots === 0 ? <>No open spots right now. </> : <><strong>{plural(o.open_spots ?? 0, "open spot")}</strong>. </>}
        {o.queue.length === 0
          ? <>Nobody on the waitlist has asked for a spot yet.</>
          : <>{plural(o.queue.length, "waitlisted hacker")} asked to be emailed. They're offered spots in the order they asked for a spot.</>}
      </p>
      {next.length > 0 && (
        <>
          <h3 className="og-dayof-sub">Next up</h3>
          <PeopleList people={next.map((q, i) => ({ id: q.application_id, name: q.name, email: q.email, code: null, tag: `#${i + 1}`, when: "" }))} />
        </>
      )}
      {later.length > 0 && (
        <details className="og-pass-role og-dayof-later">
          <summary><span className="og-pass-role-name">Still waiting</span><span className="og-pass-count">{later.length}</span></summary>
          <PeopleList people={later.map((q, i) => ({ id: q.application_id, name: q.name, email: q.email, code: null, tag: `#${next.length + i + 1}`, when: "" }))} />
        </details>
      )}

      {working && <p className="og-progress" aria-live="polite">{progress}</p>}
      {outcome && <OfferOutcome outcome={outcome} />}

      {confirming && (
        <Confirm title={`Offer ${plural(next.length, "spot")}?`} confirmLabel={`Offer ${plural(next.length, "spot")} & email`} working={working} onConfirm={offer} onCancel={() => setConfirming(false)}>
          <p>These people are accepted now, get a check-in code, and are emailed to come by <strong>{eventTime(deadline)}</strong> ({o.settings.offer_window_minutes} minutes), then sent their wallet pass:</p>
          <ul className="og-dayof-names">{next.map(q => <li key={q.application_id}>{q.name} <span className="og-hint">{q.email}</span></li>)}</ul>
          <div className="og-warning">
            <AlertTriangle size={16} aria-hidden />
            <p>This emails real people. If spots fill up before you confirm (say, a walk-in at the desk), fewer are offered: the database never gives out more than the open spots.</p>
          </div>
          <details className="og-template">
            <summary>Email: <em>{sample.subject}</em></summary>
            <p className="og-hint">Placeholders: {[...PLACEHOLDERS.filter(p => p !== "qr"), "deadline"].map(p => `{{${p}}}`).join(" ")}</p>
            <label>Subject<input value={template.subject} onChange={e => setTemplate(t => ({ ...t, subject: e.target.value }))} disabled={working} /></label>
            <label>Body<textarea rows={10} value={template.body} onChange={e => setTemplate(t => ({ ...t, body: e.target.value }))} disabled={working} /></label>
          </details>
          {working && <p className="og-progress">{progress}</p>}
        </Confirm>
      )}
    </section>
  );
}

function OfferOutcome({ outcome }: { outcome: { offered: string[]; email: OfferEmailOutcome | null; error: string | null } }) {
  const { offered, email, error } = outcome;
  return (
    <div className="og-dayof-outcome" role="status">
      {offered.length === 0 && !error && <p>No spots were given out: someone else may have just filled them. The list has been reloaded.</p>}
      {offered.length > 0 && <p className="og-success">Gave {plural(offered.length, "spot")}: {offered.join(", ")}.</p>}
      {email && (
        <p>
          Emailed {email.emailed}; sent {plural(email.passesSent, "wallet pass", "wallet passes")}
          {email.passesFailed > 0 && <>, {email.passesFailed} failed</>}.
          {email.emailFailed.length > 0 && <span className="sp-error"> {email.emailFailed.length} email{email.emailFailed.length === 1 ? "" : "s"} failed: {email.emailFailed.slice(0, 3).map(f => f.error).join("; ")}</span>}
        </p>
      )}
      {(error || email?.emailError || email?.passError) && (
        <div className="og-warning">
          <AlertTriangle size={16} aria-hidden />
          <div>
            <p>{error ?? email?.emailError ?? email?.passError}</p>
            {offered.length > 0 && <p>The spots are given. Send the emails again from "Offers" below.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function OffersCard({ eventId, o, onChanged }: { eventId: string; o: Overview; onChanged: () => void }) {
  const unsent = unemailedOffers(o);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  if (o.offers.length === 0) return null;
  const now = Date.parse(o.now);

  const resend = async () => {
    setWorking(true);
    setResult(null);
    try {
      const out = await emailOffers(eventId, unsent.map(x => ({ application_id: x.application_id, expires_at: x.expires_at })), loadOfferTemplate(eventId));
      setResult(out.emailError ?? out.passError ?? `Emailed ${out.emailed}; ${out.passesSent} passes sent.`);
    } catch (e) {
      setResult(errorText(e));
    } finally {
      setWorking(false);
      onChanged();
    }
  };

  const state = (x: Overview["offers"][number]) =>
    x.checked_in_at ? { label: "Checked in", cls: "accepted" }
      : x.no_show_at ? { label: "No-show", cls: "rejected" }
      : Date.parse(x.expires_at) <= now ? { label: "Expired", cls: "rejected" }
      : { label: `Until ${eventTime(x.expires_at)}`, cls: "waitlisted" };

  return (
    <section className="sp-card og-dayof-card" aria-labelledby="og-offers">
      <div className="sp-card-header">
        <h2 id="og-offers">Offers</h2>
        {unsent.length > 0 && (
          <button className="sp-button" disabled={working} onClick={resend}>Email {plural(unsent.length, "person", "people")} not emailed yet</button>
        )}
      </div>
      <p className="og-hint">Someone whose offer expires shows up under No-shows; marking them frees the spot for the next person.</p>
      {result && <p role="status">{result}</p>}
      <ul className="og-pass-rows og-dayof-people">
        {o.offers.map(x => {
          const s = state(x);
          return (
            <li key={x.application_id}>
              <div className="og-pass-row sent">
                <span className="og-pass-who"><strong>{x.name}</strong></span>
                <span className="og-pass-email">{x.email}</span>
                <span className="og-pass-date">{x.code} · offered {eventTime(x.offered_at)}{!x.emailed_at && " · not emailed"}</span>
                <span className="og-pass-resend-cell"><span className={`og-badge ${s.cls}`}>{s.label}</span></span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type Person = { id: string; name: string; email: string | null; code: string | null; tag: string | null; when: string };

function PeopleList({ people }: { people: Person[] }) {
  return (
    <ul className="og-pass-rows og-dayof-people">
      {people.map(p => (
        <li key={p.id}>
          <div className="og-pass-row sent">
            <span className="og-pass-who"><strong>{p.name}</strong></span>
            <span className="og-pass-email">{p.email}</span>
            <span className="og-pass-date">{[p.code, p.when].filter(Boolean).join(" · ")}</span>
            <span className="og-pass-resend-cell">{p.tag && <span className="og-badge waitlisted">{p.tag}</span>}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Note({ note, working, onUndo }: { note: { ok: boolean; text: string } | null; working: boolean; onUndo?: () => void }) {
  if (!note) return null;
  return (
    <p className={note.ok ? "og-success" : "sp-error"} role="status">
      {note.text}
      {onUndo && <> <button className="sp-button og-dayof-undo" disabled={working} onClick={onUndo}>Undo</button></>}
    </p>
  );
}
