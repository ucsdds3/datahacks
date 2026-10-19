import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Mail, MapPin, Phone } from "lucide-react";
import { useStaffPortal } from "./StaffPortalContext";
import { CONTACTS, GENERAL_CONTACT_EMAIL, SCHEDULE, hasJudgeAccess, hasMentorAccess, type ScheduleEvent } from "./config";

const STATUS_LABEL = { pending: "Application pending.", accepted: "Application accepted.", rejected: "Application rejected." } as const;
const AUDIENCE_LABEL = { mentor: "Mentors", judge: "Judges" } as const;

function EventLocation({ event }: { event: ScheduleEvent }) {
  const content = <><MapPin size={14} aria-hidden /> {event.location}</>;
  return event.locationUrl
    ? <a className="sp-location" href={event.locationUrl} target="_blank" rel="noreferrer">{content}</a>
    : <span className="sp-location">{content}</span>;
}

function Schedule() {
  const { portal } = useStaffPortal();
  const [dayIndex, setDayIndex] = useState(0);
  const day = SCHEDULE[dayIndex];
  const events = day.events.filter(event =>
    !event.audience || (event.audience === "mentor" ? hasMentorAccess(portal) : hasJudgeAccess(portal)));

  return (
    <section className="sp-card" aria-labelledby="sp-schedule-heading">
      <div className="sp-card-header">
        <h2 id="sp-schedule-heading">Run of show</h2>
        <div className="sp-tabs" role="tablist">
          {SCHEDULE.map((d, i) => (
            <button key={d.label} role="tab" aria-selected={i === dayIndex} className={i === dayIndex ? "active" : ""} onClick={() => setDayIndex(i)}>
              {d.label}
            </button>
          ))}
        </div>
      </div>
      <p className="sp-day-date">{day.date}</p>
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
  );
}

function Contacts() {
  return (
    <section className="sp-card" aria-labelledby="sp-contacts-heading">
      <div className="sp-card-header">
        <h2 id="sp-contacts-heading">Contacts</h2>
      </div>
      <ul className="sp-contacts">
        {CONTACTS.map(c => (
          <li key={c.email}>
            <span className="sp-avatar" aria-hidden>{c.initials}</span>
            <div className="sp-contact-body">
              <strong>{c.name}</strong>
              <span>{c.role}</span>
            </div>
            <div className="sp-contact-links">
              <a href={`mailto:${c.email}`}><Mail size={14} aria-hidden /> {c.email}</a>
              {c.phone && <a href={`tel:${c.phone.replace(/\D/g, "")}`}><Phone size={14} aria-hidden /> {c.phone}</a>}
            </div>
          </li>
        ))}
      </ul>
      <p className="sp-general-contact">
        General questions: <a href={`mailto:${GENERAL_CONTACT_EMAIL}`}>{GENERAL_CONTACT_EMAIL}</a>
      </p>
    </section>
  );
}

export default function Dashboard() {
  const { basePath, fullName, status, waiverSubmitted } = useStaffPortal();
  const { search } = useLocation();

  return (
    <div className="sp-page">
      <header className="sp-greeting">
        <h1>Hello, {fullName}!</h1>
        <span className={`sp-status ${status}`}>
          <span className="sp-dot" aria-hidden /> {STATUS_LABEL[status]}
        </span>
        <p className="sp-waiver-line">
          Waiver submission:{" "}
          <span className={waiverSubmitted ? "sp-complete" : "sp-incomplete"}>{waiverSubmitted ? "Completed" : "Incomplete"}</span>
          {!waiverSubmitted && status === "accepted" && <> · <Link to={{ pathname: `${basePath}/waiver`, search }}>Sign it now</Link></>}
        </p>
      </header>
      <Schedule />
      <Contacts />
    </div>
  );
}
