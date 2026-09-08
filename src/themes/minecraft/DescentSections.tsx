import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { WorldLink } from './WorldTravel';
import { PortalFrame } from './PortalFrame';

export function Speakers() {
  return <section className="mc-section mc-speakers" id="speakers"><div className="mc-container">
    <p className="mc-eyebrow">04 / MEET YOUR GUIDES</p><h2>Learn from<br /><em>fellow builders.</em></h2>
    <p className="mc-body">Speaker announcements are coming soon.</p>
    <div className="mc-speaker-slots">{[1,2,3].map(i => <div className="mc-speaker-slot" key={i}><span aria-hidden="true">?</span><strong>To be announced</strong><p>Speaker {String(i).padStart(2,'0')}</p></div>)}</div>
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
  const [selected,setSelected] = useState<number | null>(null);
  const [pulse,setPulse] = useState(0);
  const reduce = useReducedMotion();
  return <section className="mc-section mc-sculk-faq" id="faq"><div className="mc-container">
    <p className="mc-eyebrow">07 / THE DEEP DARK</p><h2>A little signal.<br /><em>A few answers.</em></h2>
    <p className="mc-body">Choose a sensor to explore the survival guide.</p>
    <div className="mc-sculk-controls" role="group" aria-label="FAQ topics">{groups.map((group,i) => <button type="button" key={group.title} id={`sculk-topic-${i}`} className={`mc-sculk-control ${selected===i?'is-selected':''}`} aria-expanded={selected===i} aria-controls={`sculk-answer-${i}`} onClick={()=>{setSelected(selected===i ? null : i);setPulse(v=>v+1);}} data-mineable>
      <span className="mc-sculk-object"><img src={`/images/minecraft/layers/${group.sprite}.png`} alt="" width="128" height="128" loading="lazy" />
      {selected===i && !reduce && <span className="mc-sculk-rings" key={pulse} aria-hidden="true">{[0,1,2].map(n=><motion.i key={n} initial={{scale:.5,opacity:.85}} animate={{scale:2.3,opacity:0}} transition={{duration:.85,delay:n*.13,ease:'easeOut'}} />)}</span>}</span>
      <span>{group.title}</span><small>{selected===i?'Close answers ↑':'Reveal answers ↓'}</small>
    </button>)}</div>
    {groups.map((group,i)=><div key={group.title} id={`sculk-answer-${i}`} role="region" aria-labelledby={`sculk-topic-${i}`} hidden={selected!==i}><AnimatePresence initial={false}>{selected===i && <motion.div className="mc-sculk-answer" initial={reduce?false:{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:.2}}>{group.items.map(([q,a])=><div key={q}><h3>{q}</h3><p>{a}</p></div>)}</motion.div>}</AnimatePresence></div>)}
    <a href="mailto:hello@ds3ucsd.com" className="mc-text-link">Still have a question? Talk to the organizers ↗</a>
  </div></section>;
}

export function LavaApply() {
  return <section className="mc-lava-apply" id="apply" aria-labelledby="mc-lava-title"><div className="mc-container">
    <p className="mc-eyebrow">08 / YOUR NEXT CHAPTER</p><h2 id="mc-lava-title">One more step.<br /><em>A whole new adventure.</em></h2>
    <p>January 16–17, 2027. Bring your curiosity. Find your people.</p>
    <WorldLink to="/minecraft/apply" kind="end" className="mc-application-portal" aria-label="Enter the End portal to the application" data-mineable><img src="/images/minecraft/layers/end-portal.png" alt="" width="400" height="400" loading="lazy" /><span className="mc-button">Enter the End portal →</span></WorldLink>
    <WorldLink to="/minecraft/schedule" kind="portal" className="mc-run-of-show-link mc-nether-gateway"><PortalFrame /><span>Explore the Nether<br /><strong>Run of show ↗</strong></span></WorldLink>
    <p className="mc-lava-note">Registration opens closer to the event</p>
  </div></section>;
}
