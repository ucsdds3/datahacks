import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, CheckCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";


const initial = { name: "", email: "", school: "", experience: "First hackathon", team: "Looking for teammates", motivation: "" };
const steps = ["Your player", "Your adventure", "Review"];

export default function ApplicationPage() {
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState(initial);
  const [complete, setComplete] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  useEffect(() => { if (mounted.current) heading.current?.focus(); mounted.current = true; }, [step, complete]);
  const set = (key: keyof typeof initial, value: string) => setDetails(previous => ({ ...previous, [key]: value }));
  const next = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setStep(value => Math.min(value + 1, 2)); };

  return <div className="mc-application-page mc-end-page"><img className="mc-dimension-art" src="/images/minecraft/dimensions/end-application.webp" alt="" width="1536" height="1024" fetchPriority="high" /><div className="mc-container mc-application-layout">
    <aside className="mc-application-intro"><Link to="/minecraft" className="mc-dimension-back">← Return to the overworld</Link><p className="mc-eyebrow">DIMENSION 03 / THE END</p><h1 tabIndex={-1}>A new world.<br /><em>Your next adventure.</em></h1><p>Bring your curiosity.<br />We’ll help you find the rest.</p><p className="mc-end-caption">A new world. A new party. Your next adventure.</p><dl><div><dt>WHEN</dt><dd>January 16–17, 2027</dd></div><div><dt>PARTY SIZE</dt><dd>Up to 4 hackers</dd></div><div><dt>ENTRY FEE</dt><dd>Free. Always.</dd></div></dl></aside>
    <div className="mc-application-form"><div className="mc-application-preview-label"><span /> APPLICATION PREVIEW</div><p className="mc-form-disclaimer">Try the application flow. Entries aren’t submitted or saved. Registration opens closer to the event.</p>
      {complete ? <div className="mc-preview-complete"><CheckCheck size={44} /><h2 ref={heading} tabIndex={-1}>Ready for your<br />next adventure.</h2><p>You’ve reached the end of the preview.<br /><strong>No application has been submitted.</strong></p><button className="mc-button" onClick={() => { setDetails(initial); setStep(0); setComplete(false); }}>Try again <ArrowRight size={17} /></button><Link to="/minecraft">Back to the world</Link></div> : <>
        <ol className="mc-application-steps" aria-label="Application progress">{steps.map((label, i) => <li key={label} aria-current={step === i ? "step" : undefined} className={i <= step ? "is-reached" : ""}><span>{i < step ? <Check size={14} /> : `0${i + 1}`}</span><b>{label}</b></li>)}</ol>
        <h2 ref={heading} tabIndex={-1}>{step === 0 ? "First, the essentials." : step === 1 ? "Choose your adventure." : "Check your inventory."}</h2>
        {step < 2 ? <form onSubmit={next}>
          {step === 0 ? <div className="mc-form-fields"><div><Label htmlFor="mc-name">What should we call you?</Label><Input id="mc-name" name="name" autoComplete="name" required maxLength={100} placeholder="Your name" value={details.name} onChange={event => set("name", event.target.value)} /></div><div><Label htmlFor="mc-email">Email address</Label><Input id="mc-email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@school.edu" value={details.email} onChange={event => set("email", event.target.value)} /></div><div><Label htmlFor="mc-school">School or university</Label><Input id="mc-school" name="school" autoComplete="organization" required maxLength={150} placeholder="Where you’re studying" value={details.school} onChange={event => set("school", event.target.value)} /></div></div>
          : <div className="mc-form-fields"><fieldset><legend>Your hackathon experience</legend><RadioGroup value={details.experience} onValueChange={value => set("experience", value)} aria-label="Your hackathon experience">{["First hackathon", "A few adventures in", "Experienced builder"].map((value, i) => <Label key={value} className="mc-radio-option" htmlFor={`mc-experience-${i}`}><RadioGroupItem id={`mc-experience-${i}`} value={value} /><span>{value}</span></Label>)}</RadioGroup></fieldset><fieldset><legend>Your party</legend><RadioGroup value={details.team} onValueChange={value => set("team", value)} aria-label="Your party">{["Looking for teammates", "Bringing a team"].map((value, i) => <Label key={value} className="mc-radio-option" htmlFor={`mc-team-${i}`}><RadioGroupItem id={`mc-team-${i}`} value={value} /><span>{value}</span></Label>)}</RadioGroup></fieldset><div><Label htmlFor="mc-motivation">What are you excited to explore? <span>(optional)</span></Label><Textarea id="mc-motivation" maxLength={1000} rows={4} placeholder="An idea, a skill, or something you’re curious about…" value={details.motivation} onChange={event => set("motivation", event.target.value)} /></div></div>}
          <div className="mc-form-actions">{step > 0 && <button type="button" className="mc-form-back" onClick={() => setStep(step - 1)}><ArrowLeft size={17} /> Back</button>}<button type="submit" className="mc-button">{step === 0 ? "Continue" : "Review your details"}<ArrowRight size={17} /></button></div>
        </form> : <div><dl className="mc-application-review">{[["Name", details.name], ["Email", details.email], ["School", details.school], ["Experience", details.experience], ["Team", details.team], ["Curious about", details.motivation || "Still exploring"]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><div className="mc-form-actions"><button className="mc-form-back" onClick={() => setStep(0)}>Edit details</button><button className="mc-button" onClick={() => { setDetails(initial); setComplete(true); }}>Finish preview <Check size={17} /></button></div></div>}
        <p className="mc-form-help">Need a hand? <a href="mailto:hello@ds3ucsd.com">Talk to the organizers ↗</a></p>
      </>}
    </div>
  </div></div>;
}
