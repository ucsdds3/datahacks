import Reveal from "../Reveal";

const STATS = [
  { i: "01", n: "450", l: "Attendees" },
  { i: "02", n: "36", l: "Hours" },
  { i: "03", n: "$50,000", l: "In prizes" },
  { i: "04", n: "100", l: "Schools" },
];

export default function Stats() {
  return (
    <Reveal className="press-stats">
      <div className="press-stats__head">
        <h2 className="press-serif-head press-serif-head--sm">
          DataHacks, <em>in numbers.</em>
        </h2>
        <p className="press-stats__note">
          36 hours of building with students from 100 schools.
        </p>
      </div>

      <ol className="press-stats__grid">
        {STATS.map((s) => (
          <li className="press-stat" key={s.i}>
            <span className="press-stat__i">{s.i}</span>
            <span className="press-stat__n">{s.n}</span>
            <span className="press-stat__l">{s.l}</span>
          </li>
        ))}
      </ol>
    </Reveal>
  );
}
