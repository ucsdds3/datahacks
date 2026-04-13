import { motion, useInView } from "framer-motion";
import { CalendarDays, ChevronDown, ChevronUp, Clock3, Croissant, Laptop2, MapPin, Sparkles, Users } from "lucide-react";
import { useRef, useState } from "react";

// ─── Track definitions ──────────────────────────────────────────────────────
const TRACKS: Record<string, { label: string; color: string; bg: string }> = {
  "ml":        { label: "AI & ML",         color: "#93c5fd", bg: "rgba(59,130,246,0.18)" },
  "analytics": { label: "Data Analytics",      color: "#6ee7b7", bg: "rgba(16,185,129,0.18)" },
  "hardware":      { label: "Hardware & IoT",       color: "#86efac", bg: "rgba(34,197,94,0.18)"  },
  "cloud":         { label: "Cloud Development",    color: "#7dd3fc", bg: "rgba(14,165,233,0.18)" },
  "biotech":       { label: "Biotechnology",        color: "#a5f3fc", bg: "rgba(6,182,212,0.18)"  },
  "economics":     { label: "Economics",            color: "#fcd34d", bg: "rgba(234,179,8,0.18)"  },
  "uiux":          { label: "UI/UX & Web Dev",      color: "#c4b5fd", bg: "rgba(139,92,246,0.18)" },
  "product":       { label: "Product & Entrepreneurship",    color: "#f9a8d4", bg: "rgba(236,72,153,0.18)" },
  "general":       { label: "General",              color: "#e2e8f0", bg: "rgba(255,255,255,0.12)"},
};

const preHackathonTimeline = [
  {
    date: "April 13, 2026",
    time: "3:30 PM - 5:00 PM",
    title: "Qualcomm Workshop (Arduino UnoQ Platform)",
    description:
      "",
    location: "HDSI MPR",
    deadline: false,
    tracks: [],
  },
  {
    date: "April 13, 2026",
    time: "5:00 PM - 7:00 PM",
    title: "Google ADK Workshop",
    description:
      "",
    location: "Center 220",
    deadline: false,
    tracks: [],
  },
  {
    date: "April 14, 2026",
    time: "3:00 PM - 4:00 PM",
    title: "Marimo Workshop (Virtual)",
    description:
      "",
    location: "Zoom",
    deadline: false,
    tracks: [],
  },
  {
    date: "April 15, 2026",
    time: "5:00 PM - 6:00 PM",
    title: "Sphinx Workshop (Virtual)",
    description:
      "",
    location: "Zoom",
    deadline: false,
    tracks: [],
  },
  {
    date: "April 15, 2026",
    time: "6:00 PM - 7:30 PM",
    title: "AWS SageMaker Workshop",
    description:
      "",
    location: "Center 220",
    deadline: false,
    tracks: [],
  },
  {
    date: "April 15, 2026",
    time: "8:00 PM - 9:00 PM",
    title: "Claude Builders Club Workshop",
    description:
      "",
    location: "Zoom",
    deadline: false,
    tracks: [],
  },
  {
    date: "April 16, 2026",
    time: "2:30 PM - 5:30 PM",
    title: "Databricks Workshop",
    description:
      "",
    location: "HDSI MPR",
    deadline: false,
    tracks: [],
  },
  {
    date: "April 17, 2026",
    time: "5:30 PM - 7:30 PM",
    title: "Team Formation Mixer",
    description:
      "",
    location: "TBD",
    deadline: false,
    tracks: [],
  }
];

const mainEventTimeline = [
  {
    date: "Apr 18",
    time: "8:00 AM - 9:30 AM",
    title: "Check-In + Breakfast",
    description: "Get your badge, settle in, and fuel up.",
    location: "Rec Gym",
    deadline: false,
    tracks: ["general"],
  },
  {
    date: "Apr 18",
    time: "9:30 AM - 10:00 AM",
    title: "Opening Ceremony: Keynote",
    description: "Keynote from Ali Arsanjani, Director of Applied AI Engineering @ Google.",
    location: "Rec Gym",
    deadline: false,
    tracks: ["general"],
  },
  {
    date: "Apr 18",
    time: "10:00 AM - 10:30 AM",
    title: "Opening Ceremony: Introduction",
    description: "Rules, logistics, and kickoff.",
    location: "Rec Gym",
    deadline: false,
    tracks: ["general"],
  },
    {
    date: "Apr 18",
    time: "10:30 AM",
    title: "Hacking Begins!",
    description: "",
    location: "Rec Gym",
    deadline: true,
    tracks: ["general"],
  },
  {
    date: "Apr 18",
    time: "1:00 PM - 2:00 PM",
    title: "Lunch",
    description: "Midday food break.",
    location: "Rec Gym",
    deadline: false,
    tracks: ["general"],
  },
  {
    date: "Apr 18",
    time: "2:00 PM - 5:00 PM",
    title: "Career Fair",
    description: "Meet recruiters and mentors.",
    location: "Auxiliary + Patio",
    deadline: false,
    tracks: ["general"],
  },
  {
    date: "Apr 18",
    time: "6:00 PM - 7:00 PM",
    title: "Dinner",
    description: "Evening meal.",
    location: "Rec Gym",
    deadline: false,
    tracks: ["general"],
  },
  {
    date: "Apr 19",
    time: "8:00 AM - 9:00 AM",
    title: "Breakfast",
    description: "Morning fuel.",
    location: "Rec Gym",
    deadline: false,
    tracks: ["general"],
  },
  {
    date: "Apr 19",
    time: "12:00 PM",
    title: "SOFT DEADLINE (Initial Submission)",
    description: "Submit early version for feedback.",
    location: "Rec Gym",
    deadline: true,
    tracks: ["general"],
  },
  {
    date: "Apr 19",
    time: "1:00 PM",
    title: "HARD DEADLINE (Final Submission)",
    description: "Final project submission.",
    location: "Rec Gym",
    deadline: true,
    tracks: ["general"],
  },
  {
    date: "Apr 19",
    time: "1:00 PM - 2:00 PM",
    title: "Lunch",
    description: "Final meal before judging.",
    location: "Rec Gym",
    deadline: false,
    tracks: ["general"],
  },
  {
    date: "Apr 19",
    time: "2:00 PM - 4:30 PM",
    title: "Judging",
    description: "Present your project to judges.",
    location: "Rec Gym",
    deadline: false,
    tracks: ["general"],
  },
  {
    date: "Apr 19",
    time: "4:30 PM - 5:15 PM",
    title: "Closing Ceremony: Keynote",
    description: "Closing keynote from Sharad Agarwal, Head of Global Partnerships at Google.",
    location: "Rec Gym",
    deadline: false,
    tracks: ["general"],
  },
  {
    date: "Apr 19",
    time: "5:15 PM - 5:30 PM",
    title: "Closing Ceremony: Keynote",
    description: "Closing keynote from Ian Kerman, Senior Developer Relations Manager @ NVIDIA.",
    location: "Rec Gym",
    deadline: false,
    tracks: ["general"],
  },
  {
    date: "Apr 19",
    time: "5:30 PM - 7:00 PM",
    title: "Awards Ceremony",
    description: "Winners announced.",
    location: "Rec Gym",
    deadline: false,
    tracks: ["general"],
  },
  {
    date: "Apr 19",
    time: "7:00 PM",
    title: "End",
    description: "Event concludes.",
    location: "Rec Gym",
    deadline: true,
    tracks: ["general"],
  },
];

const sideEventTimeline = [
  {
    date: "Apr 18",
    time: "10:30 AM - 12:00 PM",
    title: "Intro to Arduino",
    description: "Workshop/Activity 1-1",
    location: "Auxiliary Room",
    deadline: false,
    tracks: ["hardware"],
  },
  {
    date: "Apr 18",
    time: "10:30 AM - 12:00 PM",
    title: "Working with Data + ML",
    description: "Workshop/Activity 2-1",
    location: "Price Theater",
    deadline: false,
    tracks: ["ml", "analytics"],
  },
  {
    date: "Apr 18",
    time: "12:00 PM - 1:00 PM",
    title: "Intro to CAD",
    description: "Workshop/Activity 1-2",
    location: "Auxiliary Room",
    tracks: ["hardware"],
  },
  {
    date: "Apr 18",
    time: "12:00 PM - 1:00 PM",
    title: "Impulse Labs: Data → Deployment",
    description: "Workshop/Activity 2-2",
    location: "Price Theater",
    tracks: ["ml"],
  },
  {
    date: "Apr 18",
    time: "2:00 PM - 3:00 PM",
    title: "Intro to AWS",
    description: "Workshop/Activity 2-3",
    location: "Price Theater",
    tracks: ["cloud"],
  },
  {
    date: "Apr 18",
    time: "3:00 PM - 4:00 PM",
    title: "Build with AI",
    description: "Workshop/Activity 2-4",
    location: "Price Theater",
    tracks: ["ml"],
  },
  {
    date: "Apr 18",
    time: "4:00 PM - 5:00 PM",
    title: "Quantitative Intuition Behind Polymarket",
    description: "Workshop/Activity 1-4",
    location: "Price Theater",
    tracks: ["analytics", "economics"],
  },
  {
    date: "Apr 18",
    time: "5:00 PM - 6:00 PM",
    title: "SageMaker Deep Dive",
    description: "Workshop/Activity 1-3",
    location: "Auxiliary Room",
    tracks: ["cloud", "ml"],
  },
  {
    date: "Apr 18",
    time: "5:00 PM - 6:00 PM",
    title: "IoT with Arduino Uno Q",
    description: "Workshop/Activity 2-6",
    location: "Price Theater",
    tracks: ["iot"],
  },
  {
    date: "Apr 18",
    time: "7:00 PM - 8:00 PM",
    title: "Product Market Fit",
    description: "Workshop/Activity 2-5",
    location: "Auxiliary Room",
    tracks: ["product"],
  },
  {
    date: "Apr 18",
    time: "7:00 PM - 8:00 PM",
    title: "Where is the Alpha? (Prediction Markets)",
    description: "Workshop/Activity 2-7",
    location: "Price Theater",
    tracks: ["economics"],
  },
  {
    date: "Apr 18",
    time: "8:00 PM - 9:00 PM",
    title: "Pitching a Product",
    description: "Workshop/Activity 1-5",
    location: "Auxiliary Room",
    tracks: ["product"],
  },
  {
    date: "Apr 18",
    time: "8:00 PM - 9:00 PM",
    title: "Web Development",
    description: "Workshop/Activity 2-8",
    location: "Price Theater",
    tracks: ["uiux"],
  },
  {
    date: "Apr 18",
    time: "9:00 PM - 10:00 PM",
    title: "Feature Prioritization",
    description: "Workshop/Activity 2-9",
    location: "Price Theater",
    tracks: ["product"],
  },
  {
    date: "Apr 19",
    time: "9:00 AM - 12:00 PM",
    title: "Pitching Practice",
    description: "Workshop/Activity 2-10",
    location: "Auxiliary Room",
    tracks: ["product"],
  },
];

// ─── Types ──────────────────────────────────────────────────────────────────
type TimelineItem = {
  date: string;
  time: string;
  title: string;
  description: string;
  location: string;
  deadline?: boolean;
  tracks: string[];
};

// ─── Track Tags ─────────────────────────────────────────────────────────────
const TrackTags = ({ tracks }: { tracks: string[] }) => {
  if (!tracks || tracks.length === 0) return null;
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {tracks.map((key) => {
        const t = TRACKS[key];
        if (!t) return null;
        return (
          <span
            key={key}
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ color: t.color, backgroundColor: t.bg, border: `1px solid ${t.color}40` }}
          >
            {t.label}
          </span>
        );
      })}
    </div>
  );
};

// ─── Meta Tags ──────────────────────────────────────────────────────────────
const MetaTags = ({ item }: { item: TimelineItem }) => (
  <div className="mb-2.5 flex flex-wrap items-center gap-1.5 text-xs text-white/70">
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1">
      <CalendarDays className="h-3.5 w-3.5" />
      {item.date}
    </span>
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1">
      <Clock3 className="h-3.5 w-3.5" />
      {item.time}
    </span>
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1">
      <MapPin className="h-3.5 w-3.5" />
      {item.location}
    </span>
  </div>
);

// ─── Day Divider ─────────────────────────────────────────────────────────────
const DayDivider = ({ label }: { label: string }) => (
  <div className="relative flex items-center gap-2.5 py-1 pl-8">
    <div
      className="absolute left-[2px] h-[9px] w-[9px] rounded-full border-2"
      style={{ borderColor: "rgba(255,255,255,0.4)", backgroundColor: "transparent" }}
    />
    <div className="flex-1 border-t-2" style={{ borderColor: "rgba(255,255,255,0.2)", borderStyle: "dashed" }} />
    <span
      className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]"
      style={{ color: "rgba(255,255,255,0.5)", backgroundColor: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)" }}
    >
      {label}
    </span>
    <div className="flex-1 border-t-2" style={{ borderColor: "rgba(255,255,255,0.2)", borderStyle: "dashed" }} />
  </div>
);

// ─── Single Timeline Card ─────────────────────────────────────────────────────
const TimelineCard = ({
  item,
  index,
  isInView,
  showDot = true,
}: {
  item: TimelineItem;
  index: number;
  isInView: boolean;
  showDot?: boolean;
}) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={isInView ? { opacity: 1, x: 0 } : {}}
    transition={{ duration: 0.45, delay: index * 0.08 }}
    className={showDot ? "relative pl-8" : "relative w-full"}
  >
    {showDot && (
      <div
        className="absolute left-0 top-2 h-3.5 w-3.5 rounded-full border-[3px]"
        style={
          item.deadline
            ? { borderColor: "rgba(239,68,68,0.6)", backgroundColor: "rgb(239,68,68)", boxShadow: "0 0 20px rgba(239,68,68,0.45)" }
            : { borderColor: "rgba(255,255,255,0.25)", backgroundColor: "var(--color-accent, #38bdf8)", boxShadow: "0 0 20px rgba(255,255,255,0.2)" }
        }
      />
    )}
    <div
      className="h-full rounded-xl border p-4"
      style={
        item.deadline
          ? { borderColor: "rgba(239,68,68,0.3)", backgroundColor: "rgba(239,68,68,0.08)" }
          : { borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(10, 36, 99, 0.2)" }
      }
    >
      <MetaTags item={item} />
      <h4
        className="font-display text-lg font-bold leading-snug"
        style={{ color: item.deadline ? "rgb(252,165,165)" : "white" }}
      >
        {item.title}
      </h4>
      <p className="mt-1.5 text-sm leading-relaxed text-white/75">{item.description}</p>
      {/* Track tags BELOW description for main timeline cards */}
      <TrackTags tracks={item.tracks} />
    </div>
  </motion.div>
);

// ─── Group side events by time slot ──────────────────────────────────────────
function groupByTimeSlot(items: TimelineItem[]): Array<TimelineItem | TimelineItem[]> {
  const result: Array<TimelineItem | TimelineItem[]> = [];
  let i = 0;
  while (i < items.length) {
    const current = items[i];
    const group: TimelineItem[] = [current];
    let j = i + 1;
    while (j < items.length && items[j].date === current.date && items[j].time === current.time) {
      group.push(items[j]);
      j++;
    }
    if (group.length > 1) {
      result.push(group);
    } else {
      result.push(current);
    }
    i = j;
  }
  return result;
}

// ─── Side Events Column (with concurrent slots side-by-side) ─────────────────
const SideEventsColumn = ({
  items,
  isInView,
  animationDelay = 0,
}: {
  items: TimelineItem[];
  isInView: boolean;
  animationDelay?: number;
}) => {
  const grouped = groupByTimeSlot(items);
  let flatIndex = 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: animationDelay }}
      className="relative rounded-[1.5rem] border border-white/15 bg-white/10 p-5 md:p-6 backdrop-blur-md shadow-2xl"
    >
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 border border-white/20">
          <Laptop2 className="h-6 w-6 text-white" />
        </div>
        <div>
          <h3 className="font-display text-xl md:text-2xl font-bold text-white">Workshops + Side Events</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-white/75">
            Optional sessions and mini-events running around the main hackathon flow.
          </p>
        </div>
      </div>

      <div className="relative space-y-5">
        <div className="absolute bottom-0 left-[0.95rem] top-2 w-px bg-gradient-to-b from-white/0 via-white/40 to-white/0" />

        {grouped.map((entry, groupIdx) => {
          const isGroup = Array.isArray(entry);
          const firstItem = isGroup ? entry[0] : entry;

          const prevEntry = grouped[groupIdx - 1];
          const prevFirstItem = prevEntry
            ? Array.isArray(prevEntry)
              ? prevEntry[0]
              : prevEntry
            : null;
          const showDayDivider = prevFirstItem && prevFirstItem.date !== firstItem.date;

          if (isGroup) {
            const startIndex = flatIndex;
            flatIndex += entry.length;
            return (
              <div key={`group-${firstItem.date}-${firstItem.time}`}>
                {showDayDivider && (
                  <DayDivider label={firstItem.date === "Apr 19" ? "Sunday, Apr 19" : firstItem.date} />
                )}
                <div className="relative mb-2 pl-8">
                  <div
                    className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-[3px]"
                    style={{ borderColor: "rgba(255,255,255,0.25)", backgroundColor: "var(--color-accent, #38bdf8)", boxShadow: "0 0 20px rgba(255,255,255,0.2)" }}
                  />
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-white/60">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      {firstItem.time} · {firstItem.date}
                    </span>
                    <span
                      className="rounded-full px-2 py-1 text-[11px] font-semibold"
                      style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.15)" }}
                    >
                      {entry.length} concurrent sessions
                    </span>
                  </div>
                </div>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.45, delay: startIndex * 0.08 }}
                  className="grid gap-3 pl-8"
                  style={{ gridTemplateColumns: `repeat(${entry.length}, 1fr)` }}
                >
                  {entry.map((item) => (
                    <div
                      key={`${item.date}-${item.time}-${item.title}`}
                      className="flex h-full flex-col rounded-xl border p-3.5"
                      style={{ borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(10, 36, 99, 0.2)" }}
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-white/60">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5">
                          <MapPin className="h-3 w-3" />
                          {item.location}
                        </span>
                      </div>
                      <h4 className="font-display text-[15px] font-bold leading-snug text-white">{item.title}</h4>
                      <p className="mt-1.5 flex-1 text-xs leading-relaxed text-white/70">{item.description}</p>
                      {/* Track tags BELOW description */}
                      <TrackTags tracks={item.tracks} />
                    </div>
                  ))}
                </motion.div>
              </div>
            );
          } else {
            const currentIndex = flatIndex;
            flatIndex += 1;
            return (
              <div key={`${entry.date}-${entry.time}-${entry.title}`}>
                {showDayDivider && (
                  <DayDivider label={entry.date === "Apr 19" ? "Sunday, Apr 19" : entry.date} />
                )}
                <TimelineCard item={entry} index={currentIndex} isInView={isInView} />
              </div>
            );
          }
        })}
      </div>
    </motion.div>
  );
};

// ─── Main Event Column ────────────────────────────────────────────────────────
const TimelineColumn = ({
  title,
  subtitle,
  icon: Icon,
  items,
  isInView,
  animationDelay = 0,
}: {
  title: string;
  subtitle: string;
  icon: typeof Clock3;
  items: TimelineItem[];
  isInView: boolean;
  animationDelay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    animate={isInView ? { opacity: 1, y: 0 } : {}}
    transition={{ duration: 0.6, delay: animationDelay }}
    className="relative rounded-[1.5rem] border border-white/15 bg-white/10 p-5 md:p-6 backdrop-blur-md shadow-2xl"
  >
    <div className="mb-6 flex items-start gap-3">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 border border-white/20">
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div>
        <h3 className="font-display text-xl md:text-2xl font-bold text-white">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-white/75">{subtitle}</p>
      </div>
    </div>

    <div className="relative space-y-5">
      <div className="absolute bottom-0 left-[0.95rem] top-2 w-px bg-gradient-to-b from-white/0 via-white/40 to-white/0" />
      {items.map((item, index) => {
        const prevItem = items[index - 1];
        const showDayDivider = prevItem && prevItem.date !== item.date;
        return (
          <div key={`${item.date}-${item.time}-${item.title}`}>
            {showDayDivider && (
              <DayDivider label={item.date === "Apr 19" ? "Sunday, Apr 19" : item.date} />
            )}
            <TimelineCard item={item} index={index} isInView={isInView} />
          </div>
        );
      })}
    </div>
  </motion.div>
);

// ─── Pre-Hackathon Row ────────────────────────────────────────────────────────
const PreHackathonRow = ({
  items,
  isInView,
}: {
  items: TimelineItem[];
  isInView: boolean;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    animate={isInView ? { opacity: 1, y: 0 } : {}}
    transition={{ duration: 0.6 }}
    className="relative mb-6 rounded-[1.5rem] border border-white/15 bg-white/10 p-5 md:p-6 backdrop-blur-md shadow-2xl"
  >
    <div className="mb-6 flex items-start gap-3">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 border border-white/20">
        <Users className="h-6 w-6 text-white" />
      </div>
      <div>
        <h3 className="font-display text-xl md:text-2xl font-bold text-white">Pre-Hackathon Events</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-white/75">
          Get a head start — form your team, sharpen your skills, and walk in ready to build.
        </p>
      </div>
    </div>

    {/* Mobile: vertical stacked list */}
    <div className="relative space-y-5 xl:hidden">
      <div className="absolute bottom-0 left-[0.95rem] top-2 w-px bg-gradient-to-b from-white/0 via-white/40 to-white/0" />
      {items.map((item, index) => (
        <TimelineCard key={`${item.date}-${item.time}-${item.title}`} item={item} index={index} isInView={isInView} />
      ))}
    </div>

    {/* Desktop: 4-column grid with horizontal connector */}
    <div className="hidden xl:block">
      <div className="relative mb-3 flex items-center px-2">
        {items.map((_, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div
              className="h-2.5 w-2.5 shrink-0 rounded-full border-[3px]"
              style={{
                borderColor: "rgba(255,255,255,0.25)",
                backgroundColor: "var(--color-accent, #38bdf8)",
                boxShadow: "0 0 14px rgba(255,255,255,0.18)",
              }}
            />
            {i < items.length - 1 && (
              <div className="flex-1 h-px bg-gradient-to-r from-white/40 to-white/10 mx-1" />
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-4">
        {items.map((item, index) => (
          <motion.div
            key={`${item.date}-${item.time}-${item.title}`}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45, delay: index * 0.1 }}
          >
            <div
              className="flex h-full flex-col rounded-xl border p-4"
              style={{
                borderColor: "rgba(255,255,255,0.1)",
                backgroundColor: "rgba(10, 36, 99, 0.2)",
              }}
            >
              <MetaTags item={item} />
              <h4 className="font-display text-base font-bold text-white">{item.title}</h4>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-white/75">{item.description}</p>
              {/* Track tags BELOW description */}
              <TrackTags tracks={item.tracks} />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </motion.div>
);

// ─── Collapsible wrapper ──────────────────────────────────────────────────────
// Shows ~30% of the content height, then fades out with a "See more" button.
const CollapsibleTimeline = ({ children }: { children: React.ReactNode }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative">
      {/* Content container — clipped when collapsed */}
      <div
        className="overflow-hidden transition-all duration-700 ease-in-out"
        style={{ maxHeight: expanded ? "none" : "1050px" }}
      >
        {children}
      </div>

      {/* Fade-out gradient + button — only visible when collapsed */}
      {!expanded && (
        <div
          className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end pb-6"
          style={{
            height: "260px",
            background:
              "linear-gradient(to bottom, transparent 0%, hsl(210 88% 30% / 0.7) 45%, hsl(210 88% 30%) 100%)",
            pointerEvents: "none",
          }}
        >
          <div style={{ pointerEvents: "auto" }}>
            <button
              onClick={() => setExpanded(true)}
              className="group inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition-all duration-200 hover:bg-white/25 hover:border-white/40 hover:scale-105 active:scale-100"
              style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}
            >
              <ChevronDown className="h-4 w-4 transition-transform duration-200 group-hover:translate-y-0.5" />
              See full schedule
            </button>
          </div>
        </div>
      )}

      {/* Collapse button — only visible when expanded */}
      {expanded && (
        <div className="flex justify-center mt-8">
          <button
            onClick={() => {
              setExpanded(false);
              // Scroll back to top of section after collapsing
              document.getElementById("timeline")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="group inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition-all duration-200 hover:bg-white/25 hover:border-white/40 hover:scale-105 active:scale-100"
            style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}
          >
            <ChevronUp className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5" />
            Collapse schedule
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Main Section ─────────────────────────────────────────────────────────────
const TimelineSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      id="timeline"
      ref={ref}
      className="relative overflow-hidden py-20 md:py-24"
      style={{
        background:
          "linear-gradient(180deg, hsl(205 85% 38%) 0%, hsl(208 87% 34%) 45%, hsl(210 88% 30%) 100%)",
      }}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute left-[-8rem] top-16 h-72 w-72 rounded-full bg-white/8 blur-3xl" />
        <div className="absolute right-[-6rem] top-1/3 h-80 w-80 rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-1/3 h-72 w-72 rounded-full bg-sky/20 blur-3xl" />
      </div>

      <div className="container relative z-10 mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-12 max-w-3xl text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs uppercase tracking-[0.22em] text-white/80">
            <Sparkles className="h-3.5 w-3.5" />
            Event Timeline
          </div>
          <h2 className="mb-4 font-display text-3xl md:text-4xl font-bold text-white">
            What Happens And When
          </h2>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-white/80 md:text-lg">
            From pre-event workshops to the final closing ceremony — everything you need to know, in order.
          </p>
        </motion.div>

        <div className="max-w-7xl mx-auto">
          <CollapsibleTimeline>
            <PreHackathonRow items={preHackathonTimeline} isInView={isInView} />

            <div className="grid gap-6 xl:grid-cols-2">
              <TimelineColumn
                title="Main Event + Food"
                subtitle="The core schedule: check-in, ceremony, meals, and the big judging moments."
                icon={Croissant}
                items={mainEventTimeline}
                isInView={isInView}
                animationDelay={0.1}
              />
              <SideEventsColumn
                items={sideEventTimeline}
                isInView={isInView}
                animationDelay={0.2}
              />
            </div>
          </CollapsibleTimeline>
        </div>
      </div>
    </section>
  );
};

export default TimelineSection;
