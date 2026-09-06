import Reveal from "../Reveal";

const STATS = [
  { i: "01", n: "XXX", l: "Hackers" },
  { i: "02", n: "XXX", l: "Projects shipped" },
  { i: "03", n: "$XX,XXX", l: "Awarded" },
  { i: "04", n: "XX", l: "Schools" },
];

export default function Stats() {
  return (
    <Reveal className="press-stats">
      <div className="press-stats__head">
        <h2 className="press-serif-head press-serif-head--sm">
          Last year, <em>in numbers.</em>
        </h2>
        <p className="press-stats__note">
          Figures for the 2026 edition are being tallied. Set in place, awaiting the final count.
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
