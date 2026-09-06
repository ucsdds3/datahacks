import Reveal from "../Reveal";
import { TRACK_PLATES } from "../art/Specimens";

const TRACKS = [
  { fig: "Fig. 2", latin: "Instrumentum", name: "Track One" },
  { fig: "Fig. 3", latin: "Tabula perforata", name: "Track Two" },
  { fig: "Fig. 4", latin: "Crystallum", name: "Track Three" },
  { fig: "Fig. 5", latin: "Semen sub vitro", name: "Track Four" },
];

export default function Tracks() {
  return (
    <Reveal className="press-tracks" id="tracks">
      <div className="press-rubric">
        <span className="press-rubric__num">§ 02</span>
        <span className="press-rubric__name">The tracks</span>
        <span className="press-rubric__rule" aria-hidden="true" />
        <span className="press-rubric__note">Four plates, unlabelled</span>
      </div>

      <h2 className="press-serif-head press-tracks__head">
        Four tracks. <em>Announced closer to the date.</em>
      </h2>

      <ol className="press-tracks__grid">
        {TRACKS.map((t, i) => {
          const Plate = TRACK_PLATES[i];
          return (
            <li className="press-track" key={t.name}>
              <div className="press-track__art">
                <Plate className="press-track__svg" />
              </div>
              <p className="press-track__cap">
                {t.fig} — <em>{t.latin}</em>
              </p>
              <h3 className="press-track__name">{t.name}</h3>
              <p className="press-track__body">
                <span className="press-tbd">TBD</span>
              </p>
            </li>
          );
        })}
      </ol>
    </Reveal>
  );
}
