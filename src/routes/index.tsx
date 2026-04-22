import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Calendar, ArrowUpRight, Mail, Github, Twitter, Instagram, Shield, Radio, Compass, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ParallaxCastle } from "@/components/ParallaxCastle";
import { Countdown } from "@/components/Countdown";
import { SiteNav } from "@/components/SiteNav";
import { SectionHeading } from "@/components/SectionHeading";
import { TBACard } from "@/components/TBACard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DataHacks 2027 — UC San Diego × Major League Hacking" },
      {
        name: "description",
        content:
          "DataHacks 2027 at UC San Diego, presented with Major League Hacking. Build, defend, and shape the frontier across a weekend of strategy and code.",
      },
      { property: "og:title", content: "DataHacks 2027 — UC San Diego" },
      {
        property: "og:description",
        content:
          "Join DataHacks 2027 at UC San Diego with MLH. Tracks, prizes, mentors, and a frontier-themed weekend of building.",
      },
    ],
  }),
  component: Index,
});

// ============================================================
// EDIT THESE CONSTANTS to update site content easily.
// ============================================================
const EVENT = {
  name: "DataHacks 2027",
  presenter: "Presented with Major League Hacking",
  location: "UC San Diego",
  dates: "Spring 2027 · Dates TBA",
  // Edit this to set your countdown target (ISO 8601, local time):
  targetDate: "2027-04-17T09:00:00",
  registerUrl: "https://example.com/register",
  contactEmail: "team@datahacks.io",
  sponsorEmail: "sponsor@datahacks.io",
};

const STATS = [
  { value: "500+", label: "Hackers" },
  { value: "36", label: "Hours" },
  { value: "$25k+", label: "In Prizes" },
  { value: "20+", label: "Workshops" },
];

const TRACKS = [
  {
    name: "Sentinel",
    sublabel: "Track 01",
    description: "Systems that watch, predict, and warn.",
    icon: <Eye className="h-5 w-5" />,
  },
  {
    name: "Signal",
    sublabel: "Track 02",
    description: "Decoding noise into knowledge.",
    icon: <Radio className="h-5 w-5" />,
  },
  {
    name: "Stronghold",
    sublabel: "Track 03",
    description: "Resilient infrastructure under pressure.",
    icon: <Shield className="h-5 w-5" />,
  },
  {
    name: "Scout",
    sublabel: "Track 04",
    description: "Mapping the unknown frontier.",
    icon: <Compass className="h-5 w-5" />,
  },
];

const PRIZES = [
  { tier: "1st Place", label: "Grand Prize", note: "TBA" },
  { tier: "2nd Place", label: "Runner Up", note: "TBA" },
  { tier: "3rd Place", label: "Third Place", note: "TBA" },
];

const PRIZE_CATEGORIES = [
  "Best Use of AI",
  "Best Hardware Hack",
  "Best Beginner Project",
  "Best Design",
  "Most Creative",
  "MLH Domain Prize",
];

const FAQ = [
  {
    q: "Who can attend DataHacks 2027?",
    a: "Any current undergraduate or graduate student is welcome to apply. You do not need to attend UC San Diego to participate.",
  },
  {
    q: "How much does it cost?",
    a: "DataHacks is completely free. Meals, swag, and workshops are provided to all accepted hackers.",
  },
  {
    q: "Is travel reimbursement available?",
    a: "We are working on travel reimbursements for select attendees. Details will be announced closer to the event.",
  },
  {
    q: "What should I bring?",
    a: "Your laptop and charger, a student ID, comfortable clothes, and any hardware you'd like to build with. We'll handle food and a place to crash.",
  },
  {
    q: "How big can my team be?",
    a: "Teams can have up to 4 members. You can also come solo and form a team at the opening ceremony.",
  },
  {
    q: "Is this beginner-friendly?",
    a: "Absolutely. We run beginner workshops and pair first-timers with mentors throughout the weekend.",
  },
  {
    q: "What is the code of conduct?",
    a: "All attendees, sponsors, and partners follow the MLH Code of Conduct. Be respectful, inclusive, and curious.",
  },
  {
    q: "How is MLH involved?",
    a: "DataHacks 2027 is officially part of the Major League Hacking 2027 season. MLH staff are on-site to help with logistics and run their domain workshop.",
  },
];

function Index() {
  return (
    <div id="top" className="relative min-h-screen text-foreground">
      <SiteNav registerUrl={EVENT.registerUrl} />

      {/* ===================== HERO ===================== */}
      <section className="relative flex min-h-screen items-center overflow-hidden">
        <ParallaxCastle />

        <div className="relative z-10 mx-auto w-full max-w-5xl px-6 pb-16 pt-32 text-center sm:pt-40">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.28em] text-accent">
            {EVENT.presenter}
          </p>
          <h1 className="font-serif text-6xl font-medium leading-[1.05] tracking-tight text-foreground sm:text-7xl md:text-8xl">
            DataHacks
            <span className="ml-3 text-accent">2027</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            A weekend of building at the frontier — held at UC San Diego.
          </p>

          {/* Meta row */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-foreground/80">
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4 text-accent" />
              {EVENT.location}
            </span>
            <span className="hidden h-4 w-px bg-border sm:inline-block" />
            <span className="inline-flex items-center gap-2">
              <Calendar className="h-4 w-4 text-accent" />
              {EVENT.dates}
            </span>
          </div>

          {/* Countdown */}
          <div className="mx-auto mt-10 max-w-xl">
            <Countdown targetDate={EVENT.targetDate} />
          </div>

          {/* CTA */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="rounded-full px-7">
              <a href={EVENT.registerUrl} target="_blank" rel="noopener noreferrer">
                Register
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-7">
              <a href="#about">Learn more</a>
            </Button>
          </div>
        </div>
      </section>

      {/* ===================== ABOUT ===================== */}
      <section id="about" className="relative border-t border-border/40 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl px-6">
          <SectionHeading
            eyebrow="The Gathering"
            title="Build at the frontier."
            description="For one weekend, hundreds of students gather to build, defend, and outmaneuver — turning raw ideas into working systems. It is part workshop, part strategy, part celebration of what's possible when curious people sharpen their craft together."
          />

          <div className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border/60 bg-border/60 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="bg-card/80 px-6 py-8 text-center backdrop-blur-sm">
                <div className="font-serif text-4xl font-medium text-foreground sm:text-5xl">
                  {s.value}
                </div>
                <div className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== TRACKS ===================== */}
      <section id="tracks" className="relative border-t border-border/40 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            eyebrow="Tracks"
            title="Four paths forward."
            description="Pick the terrain that fits your team. Each track comes with its own prizes and mentors."
          />

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {TRACKS.map((t) => (
              <div
                key={t.name}
                className="group rounded-lg border border-border/60 bg-card/60 p-6 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-accent/40"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/10 text-accent">
                  {t.icon}
                </div>
                <p className="mt-5 text-xs font-medium uppercase tracking-[0.18em] text-accent">
                  {t.sublabel}
                </p>
                <h3 className="mt-1 font-serif text-2xl text-foreground">{t.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== PRIZES ===================== */}
      <section id="prizes" className="relative border-t border-border/40 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            eyebrow="Prizes"
            title="Spoils for the bold."
            description="Top finishers, category winners, and surprise drops throughout the weekend."
          />

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {PRIZES.map((p, i) => (
              <div
                key={p.tier}
                className={`relative overflow-hidden rounded-lg border bg-card/70 p-8 text-center backdrop-blur-sm transition-all hover:-translate-y-1 ${
                  i === 0
                    ? "border-accent/50 md:scale-105"
                    : "border-border/60"
                }`}
              >
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-accent">
                  {p.tier}
                </p>
                <p className="mt-3 font-serif text-3xl text-foreground">{p.label}</p>
                <p className="mt-6 text-sm uppercase tracking-[0.18em] text-muted-foreground">
                  {p.note}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10">
            <p className="mb-4 text-center text-xs font-medium uppercase tracking-[0.22em] text-accent">
              Category Prizes
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PRIZE_CATEGORIES.map((c) => (
                <div
                  key={c}
                  className="flex items-center justify-between rounded-md border border-border/60 bg-card/50 px-5 py-4 text-sm backdrop-blur-sm"
                >
                  <span className="text-foreground">{c}</span>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    TBA
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===================== CHALLENGES ===================== */}
      <section id="challenges" className="relative border-t border-border/40 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            eyebrow="Challenges"
            title="Sponsor missions."
            description="Specialized prompts from our partner companies — solve theirs and pick up extra prizes."
          />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <TBACard
                key={i}
                sublabel={`Challenge 0${i + 1}`}
                label="To Be Announced"
              />
            ))}
          </div>
        </div>
      </section>

      {/* ===================== SPONSORS ===================== */}
      <section id="sponsors" className="relative border-t border-border/40 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            eyebrow="Sponsors"
            title="Backed by builders."
          />

          <div className="mt-14 space-y-12">
            {[
              { tier: "Platinum", count: 2 },
              { tier: "Gold", count: 3 },
              { tier: "Silver", count: 4 },
            ].map((row) => (
              <div key={row.tier}>
                <p className="mb-4 text-center text-xs font-medium uppercase tracking-[0.22em] text-accent">
                  {row.tier}
                </p>
                <div
                  className={`grid gap-4 ${
                    row.count === 2
                      ? "sm:grid-cols-2"
                      : row.count === 3
                        ? "sm:grid-cols-3"
                        : "sm:grid-cols-2 lg:grid-cols-4"
                  }`}
                >
                  {Array.from({ length: row.count }).map((_, i) => (
                    <TBACard key={i} variant="logo" label="Your logo here" />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-14 rounded-lg border border-accent/40 bg-accent/5 p-8 text-center backdrop-blur-sm">
            <h3 className="font-serif text-2xl text-foreground">Become a sponsor</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              Reach 500+ builders, run a workshop, and put your tools in the hands of the next wave of engineers.
            </p>
            <Button asChild className="mt-5 rounded-full" variant="default">
              <a href={`mailto:${EVENT.sponsorEmail}`}>
                <Mail className="h-4 w-4" />
                {EVENT.sponsorEmail}
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* ===================== JUDGES ===================== */}
      <section id="judges" className="relative border-t border-border/40 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            eyebrow="Judges"
            title="The council."
            description="Industry leaders, researchers, and founders evaluating each project."
          />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <TBACard key={i} variant="person" sublabel="Judge" />
            ))}
          </div>
        </div>
      </section>

      {/* ===================== MENTORS ===================== */}
      <section id="mentors" className="relative border-t border-border/40 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            eyebrow="Mentors"
            title="Guides on the trail."
            description="Engineers and grad students roaming the venue to unblock your team."
          />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <TBACard key={i} variant="person" sublabel="Mentor" />
            ))}
          </div>
        </div>
      </section>

      {/* ===================== FAQ ===================== */}
      <section id="faq" className="relative border-t border-border/40 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-6">
          <SectionHeading eyebrow="FAQ" title="Questions, answered." />
          <Accordion type="single" collapsible className="mt-12 w-full">
            {FAQ.map((item, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="border-border/60"
              >
                <AccordionTrigger className="py-5 text-left font-serif text-lg text-foreground hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ===================== CONTACT ===================== */}
      <section id="contact" className="relative border-t border-border/40 py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <SectionHeading
            eyebrow="Contact"
            title="Send word."
            description="Questions, partnerships, or press — we'd love to hear from you."
          />

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" variant="default" className="rounded-full">
              <a href={`mailto:${EVENT.contactEmail}`}>
                <Mail className="h-4 w-4" />
                {EVENT.contactEmail}
              </a>
            </Button>
          </div>

          <div className="mt-8 flex items-center justify-center gap-5 text-muted-foreground">
            <a
              href="#"
              aria-label="Instagram"
              className="transition-colors hover:text-accent"
            >
              <Instagram className="h-5 w-5" />
            </a>
            <a
              href="#"
              aria-label="Twitter"
              className="transition-colors hover:text-accent"
            >
              <Twitter className="h-5 w-5" />
            </a>
            <a
              href="#"
              aria-label="GitHub"
              className="transition-colors hover:text-accent"
            >
              <Github className="h-5 w-5" />
            </a>
          </div>

          <p className="mt-10 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 text-accent" />
            UC San Diego · La Jolla, California
          </p>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} DataHacks. All rights reserved.</p>
          <p className="font-serif">
            Presented with{" "}
            <span className="text-foreground">Major League Hacking</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
