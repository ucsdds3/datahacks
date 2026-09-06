import Reveal from "../Reveal";

const DAYS = [
  {
    day: "Saturday",
    date: "January 16",
    rows: [
      ["9:00", "Check-in opens", "Doors, badges, coffee"],
      ["10:30", "Opening ceremony", "Rules, judging criteria, tracks revealed"],
      ["11:30", "Team formation", "Come solo, leave with three teammates"],
      ["13:00", "Workshops", "Beginner track runs in parallel all afternoon"],
      ["18:30", "Dinner", "Served on the floor"],
      ["00:00", "Midnight event", "TBD — historically the loudest hour"],
    ],
  },
  {
    day: "Sunday",
    date: "January 17",
    rows: [
      ["8:00", "Breakfast", "And a great deal more coffee"],
      ["11:00", "Submissions close", "Hard stop. Push your repo."],
      ["12:00", "Judging", "Expo format, judges circulate"],
      ["15:00", "Closing + awards", "Winners announced on stage"],
      ["TBD", "Afterparty", "Details announced with applications"],
    ],
  },
];

export default function Schedule() {
  return (
    <Reveal className="press-schedule" id="schedule">
      <div className="press-rubric">
        <span className="press-rubric__num">§ 03</span>
        <span className="press-rubric__name">Order of events</span>
        <span className="press-rubric__rule" aria-hidden="true" />
        <span className="press-rubric__note">Times subject to change</span>
      </div>

      <div className="press-schedule__grid">
        {DAYS.map((d) => (
          <div className="press-day" key={d.day}>
            <h3 className="press-day__head">
              <span className="press-day__name">{d.day}</span>
              <em className="press-day__date">{d.date}, 2027</em>
            </h3>
            <ol className="press-day__list">
              {d.rows.map(([t, name, note]) => (
                <li className="press-slot" key={name}>
                  <span className={`press-slot__time${t === "TBD" ? " press-tbd" : ""}`}>{t}</span>
                  <span className="press-slot__body">
                    <span className="press-slot__name">{name}</span>
                    <span className="press-slot__note">{note}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </Reveal>
  );
}
