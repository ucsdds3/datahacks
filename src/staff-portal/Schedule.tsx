import { useState } from "react";
import { MapPin } from "lucide-react";
import { useStaffPortal } from "./StaffPortalContext";
import { SCHEDULE, SCHEDULE_VENUE, hasJudgeAccess, hasMentorAccess, type ScheduleEvent } from "./config";

const AUDIENCE_LABEL = { mentor: "Mentors", judge: "Judges" } as const;

function EventLocation({ event }: { event: ScheduleEvent }) {
  if (!event.location) return null;
  const content = <><MapPin size={14} aria-hidden /> {event.location}</>;
  return event.locationUrl
    ? <a className="sp-location" href={event.locationUrl} target="_blank" rel="noreferrer">{content}</a>
    : <span className="sp-location">{content}</span>;
}

/** The run of show. Hackers see the public events; tagged events show for that role. */
export default function Schedule() {
  const { portal } = useStaffPortal();
  const [dayIndex, setDayIndex] = useState(0);
  const day = SCHEDULE[dayIndex];
  const events = day.events.filter(event =>
    !event.audience || (event.audience === "mentor" ? hasMentorAccess(portal) : hasJudgeAccess(portal)));

  return (
    <div className="sp-page">
      <header className="sp-page-header">
        <h1>Run of show</h1>
        <p>Times may shift a little on the day. Changes are announced in the opening ceremony.</p>
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
              <div className="sp-event">
                <div className="sp-event-title">
                  {event.title}
                  {event.required && <span className="sp-tag required">Required</span>}
                  {event.audience && <span className={`sp-tag ${event.audience}`}>{AUDIENCE_LABEL[event.audience]}</span>}
                </div>
                {event.description && <p>{event.description}</p>}
                <EventLocation event={event} />
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
