import { BeatValve, DataPipeline } from "../art/Pipeline";
import { MARIGOLD, MINT, PINK, SKY, TOMATO } from "../art/palette";
import { Reveal } from "../motion";

type Beat = { time: string; name: string; detail?: string; colour: string };

const SATURDAY: Beat[] = [
  { time: "08:30", name: "Check-in + breakfast", detail: "Badges, wifi, coffee", colour: TOMATO },
  { time: "10:00", name: "Opening ceremony", detail: "Rules, tracks, judging", colour: MARIGOLD },
  { time: "11:00", name: "Team formation", detail: "Come solo, leave with three", colour: MINT },
  { time: "13:00", name: "Workshops", detail: "TBD", colour: SKY },
  { time: "19:00", name: "Dinner", colour: PINK },
  { time: "00:00", name: "Midnight event", detail: "TBD", colour: TOMATO },
];

const SUNDAY: Beat[] = [
  { time: "09:00", name: "Breakfast", colour: MARIGOLD },
  { time: "11:00", name: "Submissions close", detail: "Hard stop, no extensions", colour: TOMATO },
  { time: "12:00", name: "Judging expo", detail: "Table by table", colour: SKY },
  { time: "15:00", name: "Closing + awards", detail: "Then go and sleep", colour: MINT },
];

function Day({ label, date, beats, delay }: { label: string; date: string; beats: Beat[]; delay: number }) {
  return (
    <div className="g-day">
      <Reveal delay={delay}>
        <header className="g-day__head">
          <h3 className="g-day__title">{label}</h3>
          <p className="g-label">{date}</p>
        </header>
      </Reveal>

      <ol className="g-day__list">
        {beats.map((b, i) => (
          <Reveal as="li" key={b.time + b.name} delay={delay + 0.06 * i} className="g-beat">
            <BeatValve className="g-beat__valve" colour={b.colour} />
            <span className="g-beat__time">{b.time}</span>
            <span className="g-beat__body">
              <span className="g-beat__name">{b.name}</span>
              {b.detail ? (
                <span className={`g-beat__detail${b.detail === "TBD" ? " g-beat__detail--tbd" : ""}`}>
                  {b.detail}
                </span>
              ) : null}
            </span>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}

export function Schedule() {
  return (
    <section className="g-schedule" id="schedule">
      <div className="g-wrap">
        <Reveal>
          <p className="g-label g-schedule__eyebrow">The weekend</p>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="g-schedule__title">
            Raw data in on Saturday.
            <br />
            Something shipped by Sunday.
          </h2>
        </Reveal>
      </div>

      <div className="g-schedule__machine" role="presentation">
        <div className="g-schedule__machinescroll">
          <DataPipeline className="g-schedule__pipeline" />
        </div>
        <p className="g-schedule__machinecap">
          Hopper to trophy in thirty-six hours. Times below are provisional.
        </p>
      </div>

      <div className="g-wrap g-schedule__days">
        <Day label="Saturday" date="Jan 16 · Day one" beats={SATURDAY} delay={0} />
        <Day label="Sunday" date="Jan 17 · Day two" beats={SUNDAY} delay={0.08} />
      </div>
    </section>
  );
}
