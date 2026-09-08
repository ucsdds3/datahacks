import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { WorldLink } from "./WorldTravel";

export function TrialEntrance() {
  return <section className="mc-trial-entrance" id="mentors" aria-labelledby="mc-trial-title">
    <div className="mc-trial-intro">
      <p className="mc-eyebrow">06 / THE TRIAL CHAMBERS</p>
      <h2 id="mc-trial-title">Great builders.<br /><em>Even better guides.</em></h2>
      <p>Share what you know. Help a team find its next idea, or celebrate the work that stands out.</p>
      <dl className="mc-trial-stats"><div><dd>XX</dd><dt>MENTORS</dt></div><div><dd>XX</dd><dt>JUDGES</dt></div></dl>
    </div>
    <WorldLink to="/minecraft/mentors" kind="trial" className="mc-trial-door" aria-label="Break into the Trial Chambers — mentor and judge interest" data-mineable>
      <span className="mc-trial-door-highlight" aria-hidden="true" />
      <span className="mc-button">Enter the Trial Chambers ↗</span>
      <small>Mentor & judge interest</small>
    </WorldLink>
  </section>;
}

const initial = { role: "Mentor", name: "", email: "", affiliation: "", expertise: "", availability: "", note: "" };

export default function TrialChambersPage() {
  const [details, setDetails] = useState(initial);
  const [review, setReview] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  const reduce = useReducedMotion();
  useEffect(() => { if (mounted.current) heading.current?.focus(); mounted.current = true; }, [review]);
  const set = (key: keyof typeof initial, value: string) => setDetails(previous => ({ ...previous, [key]: value }));
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setReview(true); };

  return <div className="mc-trial-page mc-dimension-page">
    <img className="mc-dimension-art" src="/images/minecraft/dimensions/trial-chamber-interest.webp" alt="" width="1536" height="1024" fetchPriority="high" />
    <div className="mc-container mc-trial-page-layout">
      <aside className="mc-trial-page-intro">
        <Link to="/minecraft#trial-layer" className="mc-dimension-back">← Return to the overworld</Link>
        <p className="mc-eyebrow">THE TRIAL CHAMBERS</p>
        <h1 tabIndex={-1}>Help the next<br /><em>builder level up.</em></h1>
        <p>Join DataHacks as a mentor or judge. A little guidance can open a whole new path.</p>
        <div className="mc-guide-role"><span>01 / MENTOR</span><p>Ask good questions. Unstick an idea. Share your experience.</p></div>
        <div className="mc-guide-role"><span>02 / JUDGE</span><p>Explore the demos. Recognize thoughtful work. Offer useful feedback.</p></div>
        <p className="mc-trial-date">JANUARY 16–17, 2027</p>
      </aside>
      <motion.div className="mc-application-form mc-interest-form" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .25 }}>
        <p className="mc-interest-label">MENTOR & JUDGE INTEREST</p>
        <p className="mc-form-disclaimer">Submissions open soon. You can prepare and review your details here; nothing is sent or saved.</p>
        <h2 ref={heading} tabIndex={-1}>{review ? "Review your details." : "Choose your role."}</h2>
        {review ? <div>
          <dl className="mc-application-review">{[["Role", details.role], ["Name", details.name], ["Email", details.email], ["School or organization", details.affiliation], ["Areas of experience", details.expertise], ["Availability", details.availability || "To be confirmed"], ["Anything else", details.note || "—"]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          <p className="mc-review-status" role="status">Your details are ready to review. No interest form has been submitted.</p>
          <button type="button" className="mc-button" onClick={() => setReview(false)}>← Edit details</button>
        </div> : <form onSubmit={submit}>
          <div className="mc-form-fields">
            <fieldset className="mc-interest-roles"><legend>I’m interested in…</legend><div>{["Mentor", "Judge", "Both"].map(role => <label key={role} className={details.role === role ? "is-selected" : ""}><input type="radio" name="role" value={role} checked={details.role === role} onChange={() => set("role",role)} /><span>{role}</span></label>)}</div></fieldset>
            <div><label htmlFor="mc-guide-name">Full name</label><input id="mc-guide-name" autoComplete="name" required maxLength={100} value={details.name} onChange={e => set("name",e.target.value)} /></div>
            <div><label htmlFor="mc-guide-email">Email address</label><input id="mc-guide-email" type="email" autoComplete="email" required maxLength={254} value={details.email} onChange={e => set("email",e.target.value)} /></div>
            <div><label htmlFor="mc-guide-affiliation">School or organization</label><input id="mc-guide-affiliation" autoComplete="organization" required maxLength={150} value={details.affiliation} onChange={e => set("affiliation",e.target.value)} /></div>
            <div><label htmlFor="mc-guide-expertise">Areas of experience</label><textarea id="mc-guide-expertise" required maxLength={1000} rows={3} placeholder="Data science, machine learning, design, research…" value={details.expertise} onChange={e => set("expertise",e.target.value)} /></div>
            <div><label htmlFor="mc-guide-availability">Availability <span>(optional)</span></label><input id="mc-guide-availability" maxLength={200} placeholder="A few hours, a full day, or still figuring it out" value={details.availability} onChange={e => set("availability",e.target.value)} /></div>
            <div><label htmlFor="mc-guide-note">Anything else? <span>(optional)</span></label><textarea id="mc-guide-note" rows={3} maxLength={1000} value={details.note} onChange={e => set("note",e.target.value)} /></div>
          </div>
          <div className="mc-form-actions"><button type="submit" className="mc-button">Review interest →</button></div>
        </form>}
        <p className="mc-form-help">Questions? <a href="mailto:hello@ds3ucsd.com">Talk to the organizers ↗</a></p>
      </motion.div>
    </div>
  </div>;
}
