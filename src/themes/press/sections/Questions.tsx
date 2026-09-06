import Reveal from "../Reveal";
import Datasaur from "../art/Datasaur";

const ROWS = [
  { tone: "brick", label: "Have you ever...", statement: "Built something in 36 hours?" },
  { tone: "mustard", label: "Do you want to...", statement: "Ship a model that actually works?" },
  { tone: "forest", label: "Are you ready for...", statement: "Data, caffeine, and no sleep?" },
];

export default function Questions() {
  return (
    <section className="press-questions" aria-label="Why DataHacks">
      {ROWS.map((r) => (
        <Reveal as="div" key={r.tone} className={`press-qrow press-qrow--${r.tone}`}>
          <p className="press-qrow__label">{r.label}</p>
          <p className="press-qrow__statement">{r.statement}</p>
        </Reveal>
      ))}

      <Reveal as="div" className="press-qrow press-qrow--brick press-qrow--final">
        <div className="press-qrow__answer">
          <span className="press-qrow__marker">Well.. you&rsquo;re in the right place!</span>
          <span className="press-qrow__answer-foot">
            Applications open soon — January 16–17, 2027
          </span>
        </div>

        <figure className="press-plate press-plate--hero">
          <div className="press-plate__frame">
            <Datasaur className="press-plate__svg" />
          </div>
          <figcaption className="press-plate__cap">
            Fig. 1 — <em>Datasaurus scientiae</em>
          </figcaption>
        </figure>
      </Reveal>
    </section>
  );
}
