import Reveal from "../Reveal";
import { Rosette } from "../art/Specimens";

const TIERS = [
  { rank: "I", name: "Grand prize", note: "Best overall project" },
  { rank: "II", name: "Runner-up", note: "Second overall" },
  { rank: "III", name: "Third place", note: "Third overall" },
  { rank: "IV", name: "Track prizes", note: "One per track, four in total" },
];

export default function Prizes() {
  return (
    <Reveal className="press-prizes" id="prizes">
      <div className="press-prizes__lead">
        <figure className="press-prizes__art">
          <Rosette className="press-prizes__rosette" />
          <figcaption className="press-plate__cap">
            Fig. 6 — <em>Prima palma</em>
          </figcaption>
        </figure>

        <div className="press-prizes__pool">
          <span className="press-prizes__label">Total prize pool</span>
          <span className="press-prizes__amount">$50,000</span>
          <span className="press-prizes__sub">
            A $50,000 prize pool across the event. Individual award amounts will be announced soon.
          </span>
        </div>
      </div>

      <ol className="press-prizes__tiers">
        {TIERS.map((t) => (
          <li className="press-tier" key={t.rank}>
            <span className="press-tier__rank">{t.rank}</span>
            <span className="press-tier__name">{t.name}</span>
            <span className="press-tier__note">{t.note}</span>
            <span className="press-tier__val press-tbd">TBD</span>
          </li>
        ))}
      </ol>
    </Reveal>
  );
}
