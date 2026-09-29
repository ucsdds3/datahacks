import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { WorldLink } from './WorldTravel';

/** Three empty tiles reading "?" told a visitor we had nothing and had thought
 * about it no further. A dated sentence says more and claims less. */
export function Speakers() {
  return <section className="mc-section mc-scene-open mc-speakers" id="speakers"><div className="mc-container">
    <p className="mc-eyebrow">04 / MEET YOUR GUIDES</p><h2>Learn from<br /><em>fellow builders.</em></h2>
    <p className="mc-body">Speakers and workshop leads are being confirmed now. We announce them alongside applications in October.</p>
    <p className="mc-section-note">DataHacks 2026 ran twelve hours of mentoring across the weekend, with engineers from Databricks on the floor.</p>
  </div></section>;
}

const groups = [
  { title:'Getting started', sprite:'sensor', items:[
    ['Do I need experience to join?', 'Nope. Any current student, any major, any experience level is welcome. We’ll have beginner workshops and mentors to help you find your footing.'],
    ['Do we have to build something in Minecraft?', 'No. Minecraft is the theme of this website concept. DataHacks is a data science and machine learning hackathon; your project doesn’t have to involve Minecraft.'],
  ]},
  { title:'Your team', sprite:'shrieker', items:[['Can I come without a team?', 'Absolutely. Teams can have up to four people, and we’ll help solo hackers meet teammates at team formation.']]},
  { title:'What to bring', sprite:'sensor', items:[['What should I put in my inventory?', 'Bring a laptop, charger, and student ID. A water bottle and anything that helps you stay comfortable are good additions.']]},
  { title:'Costs & travel', sprite:'shrieker', items:[
    ['Does it cost anything?', 'DataHacks is free to attend. Meals and swag are included. Bring your curiosity; we’ll take care of the essentials.'],
    ['Is travel reimbursement available?', 'Travel reimbursement details are still to be confirmed. We’ll share the policy when applications open.'],
  ]},
];

export function SculkFaq() {
  // A sensor is always tuned in. Starting empty left a dead box where the answers go.
  const [selected,setSelected] = useState(0);
  const [pulse,setPulse] = useState(0);
  const reduce = useReducedMotion();
  return <section className="mc-section mc-sculk-faq" id="faq"><div className="mc-container mc-sculk-grid">
    <div className="mc-sculk-side">
      <p className="mc-eyebrow">07 / THE DEEP DARK</p><h2>A little signal.<br /><em>A few answers.</em></h2>
      <div className="mc-sculk-controls" role="tablist" aria-label="FAQ topics" aria-orientation="vertical">{groups.map((group,i) => <button type="button" role="tab" key={group.title} id={`sculk-topic-${i}`} className={`mc-sculk-control ${selected===i?'is-selected':''}`} aria-selected={selected===i} aria-controls={`sculk-answer-${i}`} onClick={()=>{setSelected(i);setPulse(v=>v+1);}} data-mineable>
        <span className="mc-sculk-object"><img src={`/images/minecraft/layers/${group.sprite}.png`} alt="" width="128" height="128" loading="lazy" />
        {selected===i && !reduce && <span className="mc-sculk-rings" key={pulse} aria-hidden="true">{[0,1,2].map(n=><motion.i key={n} initial={{scale:.5,opacity:.85}} animate={{scale:2.3,opacity:0}} transition={{duration:.85,delay:n*.13,ease:'easeOut'}} />)}</span>}</span>
        <span>{group.title}</span>
      </button>)}</div>
      <a href="mailto:info@ds3.club" className="mc-text-link">Still have a question? Talk to the organizers ↗</a>
    </div>
    <div className="mc-sculk-answer-stage">
      {groups.map((group,i)=><div key={group.title} id={`sculk-answer-${i}`} role="tabpanel" aria-labelledby={`sculk-topic-${i}`} hidden={selected!==i} className={`mc-sculk-answer-region ${selected===i?'is-active':''}`}><div className="mc-sculk-answer">{group.items.map(([q,a])=><div key={q}><h3>{q}</h3><p>{a}</p></div>)}</div></div>)}
    </div>
  </div></section>;
}

export function LavaApply() {
  return <section className="mc-lava-apply" id="apply" aria-labelledby="mc-lava-title"><div className="mc-container">
    <p className="mc-eyebrow">08 / YOUR NEXT CHAPTER</p><h2 id="mc-lava-title">One more step.<br /><em>A whole new adventure.</em></h2>
    <p>January 16–17, 2027. Bring your curiosity. Find your people.</p>
    <WorldLink to="/datacraft/apply" kind="end" className="mc-application-portal" aria-label="Enter the End portal to the application" data-mineable><img src="/images/minecraft/layers/end-portal.png" alt="" width="400" height="400" loading="lazy" /><span className="mc-button">Enter the End portal →</span></WorldLink>
    <p className="mc-lava-note">Registration opens closer to the event</p>
  </div></section>;
}
