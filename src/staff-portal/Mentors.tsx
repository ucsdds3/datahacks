import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { currentEventId } from "@/portal/event";
import { useStaffPortal } from "./StaffPortalContext";
import { SCHEDULE } from "./config";

type Mentor = { first_name: string | null; last_name: string | null; bio: string | null; checked_in: boolean };

const PREVIEW_MENTORS: Mentor[] = [
  { first_name: "Jane", last_name: "Doe", bio: "ML engineer working on recommendation systems. Ask me about PyTorch, model evaluation and getting a demo working fast.", checked_in: true },
  { first_name: "Lorem", last_name: "Ipsum", bio: "Data scientist in health tech. Happy to help with pandas, SQL and making sense of messy datasets.", checked_in: true },
  { first_name: "Dolor", last_name: "Sit", bio: "Full-stack developer. I can help you ship a frontend for your model and deploy it.", checked_in: false },
];

/** The mentor office-hours block from the run of show, so times live in one place. */
const OFFICE_HOURS = SCHEDULE.flatMap(day => day.events).find(e => e.audience === "mentor" && /office hours/i.test(e.title));

/** Hackers, on the day: who's mentoring and whether they're here yet. Click a name for their blurb. */
export default function Mentors() {
  const { preview } = useStaffPortal();
  const [open, setOpen] = useState<number | null>(null);
  const query = useQuery({
    queryKey: ["mentor-roster"],
    queryFn: async () => {
      // See mentor_roster in supabase/migrations: accepted mentors only, to people at the event.
      const { data, error } = await supabase.rpc("mentor_roster", { p_event_id: await currentEventId() });
      if (error) throw error;
      return (data ?? []) as Mentor[];
    },
    enabled: !preview,
    refetchInterval: 60_000,
  });
  const mentors = preview ? PREVIEW_MENTORS : query.data ?? [];

  return (
    <div className="sp-page">
      <header className="sp-page-header">
        <h1>Mentors</h1>
        {OFFICE_HOURS && (
          <p>
            Office hours {OFFICE_HOURS.start}{OFFICE_HOURS.end && `–${OFFICE_HOURS.end}`}
            {OFFICE_HOURS.location && <> · <MapPin size={14} aria-hidden /> {OFFICE_HOURS.location}</>}
          </p>
        )}
      </header>
      <section className="sp-card">
        {!preview && query.isPending && <p>Loading mentors…</p>}
        {!preview && query.isError && <p>Couldn't load mentors: {query.error.message}</p>}
        {(preview || query.isSuccess) && mentors.length === 0 && <p>Mentors will appear here once they're confirmed.</p>}
        <ul className="sp-mentors">
          {mentors.map((m, i) => {
            const name = `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || "Mentor";
            return (
              <li key={`${name}-${i}`}>
                <button className="sp-mentor-row" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                  <span className="sp-avatar" aria-hidden>{name.split(" ").map(part => part[0]).join("").slice(0, 2)}</span>
                  <strong>{name}</strong>
                  <span className={`sp-checkin ${m.checked_in ? "in" : ""}`}>
                    <span className="sp-dot" aria-hidden /> {m.checked_in ? "Checked in" : "Not checked in"}
                  </span>
                </button>
                {open === i && <p className="sp-mentor-bio">{m.bio || "No blurb yet."}</p>}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
