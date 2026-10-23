import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { WorldLink } from "./WorldTravel";

export function TrialEntrance() {
  return <section className="mc-trial-entrance" id="mentors" aria-labelledby="mc-trial-title">
    <div className="mc-trial-intro">
      <p className="mc-eyebrow">06 / THE TRIAL CHAMBERS</p>
      <h2 id="mc-trial-title">Great builders.<br /><em>Even better guides.</em></h2>
      <p>Share what you know. Help a team find its next idea, or celebrate the work that stands out.</p>
      {/* Counters reading XX advertised that we had not recruited anyone yet. The
          ask is the point of this panel; the numbers were never the point. */}
      <p className="mc-trial-ask">Mentoring runs across the full 36 hours. Judging is a few hours on the Sunday.</p>
    </div>
    <WorldLink to="/datacraft/mentors" kind="trial" className="mc-trial-door" aria-label="Break into the Trial Chambers — apply to mentor or judge" data-mineable>
      <span className="mc-trial-door-highlight" aria-hidden="true" />
      <span className="mc-button">Enter the Trial Chambers ↗</span>
      <small>Mentor & judge applications</small>
    </WorldLink>
  </section>;
}

/** `/datacraft/mentors`: the mentor and judge entrance, the counterpart of the End page for hackers. */
export default function TrialChambersPage() {
  const reduce = useReducedMotion();
  const [signInError, setSignInError] = useState<string | null>(null);
  // Straight to Google, then the mentor/judge application. Loaded on click so
  // the Supabase client stays out of the site's own bundle.
  const signIn = () =>
    import("@/portal/signIn")
      .then(m => m.startGoogleSignIn("staff"))
      .catch(error => setSignInError(error instanceof Error ? error.message : String(error)));

  return <div className="mc-trial-page mc-dimension-page">
    <img className="mc-dimension-art" src="/images/minecraft/dimensions/trial-chamber-interest.webp" alt="" width="1536" height="1024" {...{ fetchpriority: "high" }} />
    <div className="mc-container mc-trial-page-layout">
      <aside className="mc-trial-page-intro">
        <Link to="/datacraft#trial-layer" className="mc-dimension-back">← Return to the overworld</Link>
        <p className="mc-eyebrow">THE TRIAL CHAMBERS</p>
        <h1 tabIndex={-1}>Help the next<br /><em>builder level up.</em></h1>
        <p>Join DataHacks as a mentor or judge. A little guidance can open a whole new path.</p>
        <div className="mc-guide-role"><span>01 / MENTOR</span><p>Ask good questions. Unstick an idea. Share your experience. Saturday, January 16, 12:30–4:30 PM.</p></div>
        <div className="mc-guide-role"><span>02 / JUDGE</span><p>Explore the demos. Recognize thoughtful work. Offer useful feedback. Sunday, January 17.</p></div>
        <p className="mc-trial-date">JANUARY 16–17, 2027</p>
      </aside>
      <motion.div className="mc-application-form mc-interest-form" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .25 }}>
        <p className="mc-interest-label">MENTOR & JUDGE APPLICATION</p>
        <h2>Ready to guide the next builders?</h2>
        <p className="mc-form-disclaimer">
          Sign in with Google to apply as a mentor, a judge, or both, or to check on an application you've already sent.
        </p>
        <div className="mc-form-actions">
          <button type="button" className="mc-button" onClick={signIn} style={{ width: "100%", justifyContent: "center" }}>
            Apply to mentor or judge →
          </button>
        </div>
        {signInError && <p className="mc-form-help" style={{ color: "#c96b6b" }}>{signInError}</p>}
        <p className="mc-form-help">Questions? <a href="mailto:info@ds3.club">Talk to the organizers ↗</a></p>
      </motion.div>
    </div>
  </div>;
}
