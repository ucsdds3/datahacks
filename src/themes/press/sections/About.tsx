import Reveal from "../Reveal";

const META = [
  ["Format", "36 hours, in person"],
  ["Teams", "Up to four people"],
  ["Cost", "Free to attend"],
  ["Host", "DS3 — Data Science Student Society"],
];

export default function About() {
  return (
    <Reveal className="press-about" id="about">
      <div className="press-rubric">
        <span className="press-rubric__num">§ 01</span>
        <span className="press-rubric__name">About the weekend</span>
        <span className="press-rubric__rule" aria-hidden="true" />
        <span className="press-rubric__note">Est. 2026</span>
      </div>

      <div className="press-about__grid">
        <div className="press-about__head">
          <h2 className="press-serif-head">
            A weekend-long hackathon,
            <em> run entirely by students.</em>
          </h2>
          <dl className="press-meta">
            {META.map(([k, v]) => (
              <div className="press-meta__row" key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="press-about__body">
          <p className="press-dropcap">
            DataHacks is a weekend-long data science and machine learning hackathon built and run by
            students, for students. Over thirty-six hours you form a team of up to four, pick a
            problem worth solving, and take it from a blank notebook to something you can actually
            demo on Sunday afternoon.
          </p>
          <p>
            Every skill level belongs here. Bring a half-finished idea or nothing at all — there are
            workshops, mentors on the floor all night, and a team formation session for anyone
            arriving solo. First-time hackers have won this thing before.
          </p>
          <p className="press-about__pull">
            <em>Two days. One room. Whatever you can build before the clock runs out.</em>
          </p>
        </div>
      </div>
    </Reveal>
  );
}
