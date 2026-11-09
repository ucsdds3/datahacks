import { useId, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { usePortalTheme } from "@/portal/portalTheme";
import { useStaffPortal } from "./StaffPortalContext";
import { SCHEDULE, SCHEDULE_VENUE, hasJudgeAccess, hasMentorAccess, type PortalRole, type ScheduleDay, type ScheduleEvent } from "./config";
import { GuideEyebrow, GuidePager, GuideTabs } from "./nether/NetherGuide";
import { overflows, tabPanel, useFitStep } from "./nether/guideFit";

const AUDIENCE_LABEL = { mentor: "Mentors", judge: "Judges" } as const;
const INTRO = "Times may shift a little on the day. Changes are announced in the opening ceremony.";

function EventLocation({ event }: { event: ScheduleEvent }) {
  if (!event.location) return null;
  const content = <><MapPin size={14} aria-hidden /> {event.location}</>;
  return event.locationUrl
    ? <a className="sp-location" href={event.locationUrl} target="_blank" rel="noreferrer">{content}</a>
    : <span className="sp-location">{content}</span>;
}

const eventsFor = (day: ScheduleDay, portal: PortalRole) => day.events.filter(event =>
  !event.audience || (event.audience === "mentor" ? hasMentorAccess(portal) : hasJudgeAccess(portal)));

function EventDetails({ event }: { event: ScheduleEvent }) {
  return (
    <div className="sp-event">
      <div className="sp-event-title">
        {event.title}
        {event.required && <span className="sp-tag required">Required</span>}
        {event.audience && <span className={`sp-tag ${event.audience}`}>{AUDIENCE_LABEL[event.audience]}</span>}
      </div>
      {event.description && <p>{event.description}</p>}
      <EventLocation event={event} />
    </div>
  );
}

const EventRows = ({ day, portal }: { day: ScheduleDay; portal: PortalRole }) => <>
  {eventsFor(day, portal).map(event => (
    <li key={`${event.start}-${event.title}`}>
      <div className="sp-time">
        {event.start}
        {event.end && <span>{event.end}</span>}
      </div>
      <EventDetails event={event} />
    </li>
  ))}
</>;

/*
 * The layouts the Nether run of show tries on desktop, roomiest first (see useFitStep):
 * both days side by side, then one day at a time behind day tabs with its events in two
 * columns; each as drawn, then a little tighter; and last, letting the view scroll.
 */
const STEPS = [
  { days: "both", dense: false },
  { days: "both", dense: true },
  { days: "one", dense: false },
  { days: "one", dense: true },
  { days: "one", dense: true, scroll: true },
] as const;
const FIRST_DAY_STEP = STEPS.findIndex(s => s.days === "one");

/** The Nether look (Figma "Handbook – Run of show"): both days side by side, one panel each. */
function NetherSchedule({ portal }: { portal: PortalRole }) {
  const [dayIndex, setDayIndex] = useState(0);
  const view = useRef<HTMLDivElement>(null);
  const id = useId();
  const { fit, step, restart } = useFitStep(STEPS.length - 1, s => !("scroll" in STEPS[s]) && overflows(view.current));
  const header = (
    <header className="sp-page-header">
      <GuideEyebrow />
      <h1>Run of show</h1>
      <p>{INTRO}</p>
    </header>
  );
  const venue = <p className="sp-schedule-venue"><MapPin size={16} aria-hidden /> {SCHEDULE_VENUE}</p>;
  const bothDays = (
    <div className="sp-guide-grid sp-ros">
      {SCHEDULE.map((day, i) => (
        <section key={day.label} className="sp-guide-panel" aria-labelledby={`sp-ros-day-${i}`}>
          <h2 id={`sp-ros-day-${i}`}>{day.date}</h2>
          <ol className="sp-ros-list"><EventRows day={day} portal={portal} /></ol>
        </section>
      ))}
    </div>
  );

  if (!fit) {
    return (
      <div className="sp-page sp-guide-page">
        {header}
        {venue}
        <div className="sp-guide">{bothDays}</div>
        <GuidePager current="schedule" />
      </div>
    );
  }

  const { days, dense } = STEPS[step];
  const scroll = "scroll" in STEPS[step];
  const day = SCHEDULE[dayIndex];
  const openDay = (i: number) => {
    setDayIndex(i);
    restart(FIRST_DAY_STEP);
  };
  return (
    <div className={`sp-page sp-guide-page sp-guide-fit${dense ? " dense" : ""}${scroll ? " scroll" : ""}`}>
      <div className="sp-guide-top">
        {header}
        <div className="sp-ros-aside">
          {venue}
          {days === "one" && <GuideTabs id={id} label="Days" items={SCHEDULE.map(d => d.date)} selected={dayIndex} onSelect={openDay} className="sp-guide-options" />}
        </div>
      </div>
      <div className="sp-guide-body">
        <div ref={view} className="sp-guide-view">
          <div className="sp-guide">
            {days === "both" ? bothDays : (
              <section className="sp-guide-panel sp-ros sp-ros-day" {...tabPanel(id, dayIndex)}>
                <h2 className="sp-guide-sr">{day.date}</h2>
                <ol className="sp-ros-list sp-ros-split"><EventRows day={day} portal={portal} /></ol>
              </section>
            )}
          </div>
        </div>
      </div>
      <GuidePager current="schedule" />
    </div>
  );
}

/** The run of show. Hackers see the public events; tagged events show for that role. */
export default function Schedule() {
  const { portal } = useStaffPortal();
  const [dayIndex, setDayIndex] = useState(0);
  const nether = usePortalTheme() === "nether";
  if (nether) return <NetherSchedule portal={portal} />;
  const day = SCHEDULE[dayIndex];
  const events = eventsFor(day, portal);

  return (
    <div className="sp-page">
      <header className="sp-page-header">
        <h1>Run of show</h1>
        <p>{INTRO}</p>
      </header>
      <section className="sp-card" aria-labelledby="sp-schedule-heading">
        <div className="sp-card-header">
          <h2 id="sp-schedule-heading">{day.date}</h2>
          <div className="sp-tabs" role="tablist">
            {SCHEDULE.map((d, i) => (
              <button key={d.label} role="tab" aria-selected={i === dayIndex} className={i === dayIndex ? "active" : ""} onClick={() => setDayIndex(i)}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <p className="sp-schedule-venue"><MapPin size={16} aria-hidden /> {SCHEDULE_VENUE}</p>
        <ol className="sp-timeline">
          {events.map(event => (
            <li key={`${event.start}-${event.title}`}>
              <div className="sp-time">
                {event.start}
                {event.end && <span>{event.end}</span>}
              </div>
              <EventDetails event={event} />
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
