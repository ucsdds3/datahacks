import { ArrowRight, ArrowUpRight, Braces, Compass, Gem, Lightbulb, LockKeyhole, Trophy, Users } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorldLink } from "./WorldTravel";
import { PixelItem } from "./PixelItem";

const days = [
  { id: "saturday", label: "Day 01 / Saturday", date: "January 16", rows: [
    ["09:00", "Spawn in", "Check-in, coffee, and your first inventory drop."],
    ["10:30", "The adventure begins", "Opening ceremony and the weekend briefing."],
    ["11:15", "Find your party", "Team formation. Arrive solo or bring your crew."],
    ["12:30", "Unlock new skills", "Workshops begin, with a track for first-time hackers."],
    ["18:30", "Refill your hunger bar", "Dinner, a stretch, and a little fresh perspective."],
    ["00:00", "One more block…", "Midnight activity. Details to be announced."],
  ] },
  { id: "sunday", label: "Day 02 / Sunday", date: "January 17", rows: [
    ["08:30", "A new day dawns", "Breakfast and the final push."],
    ["11:00", "Save your world", "Project submissions close."],
    ["11:30", "Show what you crafted", "Judging expo and live demos."],
    ["15:00", "Achievement unlocked", "Closing ceremony and awards."],
    ["16:00", "Until the next adventure", "Pack up, say your goodbyes, and keep building."],
  ] },
];

const questions = [
  ["Do I need experience to join?", "Nope. Any current student, any major, any experience level is welcome. We’ll have beginner workshops and mentors to help you find your footing."],
  ["Does it cost anything?", "DataHacks is free to attend. Meals and swag are included. Bring your curiosity; we’ll take care of the essentials."],
  ["Can I come without a team?", "Absolutely. Teams can have up to four people, and we’ll help solo hackers meet teammates at team formation."],
  ["What should I put in my inventory?", "Bring a laptop, charger, and student ID. A water bottle and anything that helps you stay comfortable are good additions."],
  ["Do we have to build something in Minecraft?", "No. Minecraft is the theme of this website concept. DataHacks is a data science and machine learning hackathon; your project doesn’t have to involve Minecraft."],
  ["Is travel reimbursement available?", "Travel reimbursement details are still to be confirmed. We’ll share the policy when applications open."],
];

export function About() {
  return <section className="mc-section mc-about mc-about-numbers" id="about" aria-label="Event at a glance"><div className="mc-container"><dl className="mc-number-grid">{[["XX", "HOURS"], ["$XX", "IN PRIZES"], ["XX", "ATTENDEES"], ["XX", "SCHOOLS"]].map(([value,label])=><div key={label}><dd>{value}</dd><dt>{label}</dt></div>)}</dl></div></section>;
}

export function Tracks() {
  const items = ["code", "compass", "diamond", "torch"] as const;
  return <section className="mc-section mc-tracks" id="tracks"><div className="mc-container"><div className="mc-section-head"><div><p className="mc-eyebrow">02 / CHOOSE YOUR BIOME</p><h2>Different paths.<br /><em>Endless discoveries.</em></h2></div><p className="mc-body">Four tracks. A whole world of problems to solve.<br />Prompts, datasets, and judging criteria are coming soon.</p></div><div className="mc-track-grid">{["One", "Two", "Three", "Four"].map((name, i) => <article className={`mc-track mc-track-${i}`} key={name}><div className="mc-track-top"><span>0{i + 1}</span><LockKeyhole size={17} aria-hidden="true" /></div><div className="mc-track-symbol" aria-hidden="true"><PixelItem item={items[i]} /></div><p className="mc-eyebrow">UNEXPLORED TERRITORY</p><h3>Track {name}</h3><p>Every great adventure starts<br />with a little unknown.</p><div className="mc-track-status"><span /> REVEALING SOON</div></article>)}</div><p className="mc-section-note">Pick your path when the tracks are announced. All experience levels welcome.</p></div></section>;
}

export function Prizes() {
  const prizes = [{ rank: "2nd", material: "IRON", amount: "$X,XXX", cls: "silver", item: "trophy" as const }, { rank: "1st", material: "DIAMOND", amount: "$XX,XXX", cls: "diamond", item: "diamond" as const }, { rank: "3rd", material: "GOLD", amount: "$X,XXX", cls: "gold", item: "gold" as const }];
  return <section className="mc-section mc-prizes" id="prizes"><div className="mc-container"><div className="mc-section-head"><div><p className="mc-eyebrow">05 / THE LOOT CHEST</p><h2>Good things<br />come to <em>builders.</em></h2></div><div className="mc-prize-pool"><span>TOTAL PRIZE POOL</span><strong>$XX,XXX</strong><small>Final prizes to be announced</small></div></div><div className="mc-podium">{prizes.map(item => <div className={`mc-podium-place mc-podium-${item.cls}`} key={item.rank}><span className="mc-prize-icon" aria-hidden="true"><PixelItem item={item.item} /></span><div className="mc-podium-block"><span className="mc-material">{item.material} TIER</span><strong>{item.rank}</strong><span className="mc-prize-amount">{item.amount}</span><small>TO BE ANNOUNCED</small></div></div>)}</div><p className="mc-section-note">Plus awards across all four tracks. Prize amounts are placeholders until confirmed.</p></div></section>;
}

export function Schedule() {
  return <section className="mc-section mc-schedule" id="schedule"><div className="mc-container mc-schedule-grid"><div><p className="mc-eyebrow">04 / YOUR QUEST LOG</p><h2>Two days.<br /><em>One epic<br />adventure.</em></h2><p className="mc-body">From your first hello to your final demo. Here’s how the weekend unfolds.</p><div className="mc-schedule-note"><Compass size={25} aria-hidden="true" /><p>January 16–17, 2027<br /><span>Times are provisional · Pacific time</span></p></div></div><Tabs defaultValue="saturday" className="mc-quest-log"><TabsList className="mc-day-tabs" aria-label="Choose schedule day">{days.map(day => <TabsTrigger key={day.id} value={day.id}>{day.label}</TabsTrigger>)}</TabsList>{days.map(day => <TabsContent key={day.id} value={day.id} className="mc-day-content"><div className="mc-log-heading"><span>{day.date}</span><span>QUEST / DESCRIPTION</span></div><ol>{day.rows.map(([time, title, description], i) => <li key={title}><time>{time}</time><span className="mc-quest-marker" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span><div><h3>{title}</h3><p>{description}</p></div></li>)}</ol></TabsContent>)}</Tabs></div></section>;
}

export function Sponsors() {
  return <section className="mc-section mc-sponsors" id="sponsors"><div className="mc-container"><div className="mc-section-head"><div><p className="mc-eyebrow">03 / BUILDING THIS WORLD TOGETHER</p><h2>Every adventure<br />needs <em>a little support.</em></h2></div><div><p className="mc-body">Help a new generation of builders get started. Sponsor a weekend of learning, experimenting, and making things happen.</p><a className="mc-text-link" href="mailto:sponsorship@ds3ucsd.com">Become a sponsor <ArrowUpRight size={18} /></a></div></div><div className="mc-sponsor-tiers">{[{ tier: "Diamond", slots: 2 }, { tier: "Gold", slots: 3 }, { tier: "Silver", slots: 4 }].map(({ tier, slots }) => <div className="mc-sponsor-tier" key={tier}><span className={`mc-tier-label mc-tier-${tier.toLowerCase()}`}><Gem size={17} aria-hidden="true" />{tier}</span><div className="mc-sponsor-slots">{Array.from({ length: slots }, (_, i) => <a href="mailto:sponsorship@ds3ucsd.com" className="mc-sponsor-slot" key={i} aria-label={`Ask about ${tier.toLowerCase()} sponsorship slot ${i + 1}`}><span aria-hidden="true">+</span><small>Your logo here</small></a>)}</div></div>)}</div><p className="mc-section-note">Sponsorship spaces for 2027 are open. Let’s build something together.</p></div></section>;
}

export function Faq() {
  return <section className="mc-section mc-faq" id="faq"><div className="mc-container mc-faq-grid"><div><p className="mc-eyebrow">06 / THE SURVIVAL GUIDE</p><h2>A little help<br />before you<br /><em>spawn in.</em></h2><p className="mc-body">Still have a question?<br /><a className="mc-text-link" href="mailto:hello@ds3ucsd.com">Talk to the organizers <ArrowUpRight size={17} /></a></p></div><Accordion type="single" collapsible defaultValue="question-0" className="mc-faq-list">{questions.map(([question, answer], i) => <AccordionItem value={`question-${i}`} key={question} className="mc-faq-item"><AccordionTrigger className="mc-faq-trigger"><span><b>{String(i + 1).padStart(2, "0")}</b>{question}</span></AccordionTrigger><AccordionContent className="mc-faq-answer">{answer}</AccordionContent></AccordionItem>)}</Accordion></div></section>;
}

export function Apply() {
  return <section className="mc-apply" id="apply"><div className="mc-container"><p className="mc-eyebrow">YOUR NEXT CHAPTER</p><h2>The world is yours.<br /><em>What will you create?</em></h2><p>January 16–17, 2027. Bring your curiosity. Find your people.</p><div className="mc-application-status"><span /> APPLICATIONS OPENING SOON</div><p className="mc-application-note">Registration isn’t open yet. Check back closer to the event.</p><a href="mailto:hello@ds3ucsd.com" className="mc-button">Get in touch <ArrowUpRight size={18} /></a></div></section>;
}
