import HeroLandscape from "../art/HeroLandscape";

export default function Hero() {
  return (
    <header className="press-hero" id="top">
      <div className="press-hero__art" aria-hidden="true">
        <HeroLandscape className="press-hero__svg" />
      </div>

      <div className="press-hero__inner">
        <p className="press-hero__kicker">
          <span>January 16–17, 2027</span>
          <span className="press-hero__kicker-rule" aria-hidden="true" />
          <span>36 hours, in person</span>
        </p>

        <h1 className="press-hero__title">
          <span>Thirty-six hours to build</span>
          <em>something worth shipping.</em>
        </h1>

        <p className="press-hero__lede">
          A student-run data science and machine learning hackathon, hosted by DS3.
        </p>

        <div className="press-hero__cta">
          <a className="press-pill press-pill--solid" href="#apply">
            Apply to hack
          </a>
          <a className="press-pill" href="#sponsors">
            Become a sponsor
          </a>
        </div>
      </div>

      <div className="press-hero__masthead">
        <span>DS3 · Data Science Student Society</span>
        <span className="press-hero__masthead-mid">Vol. II · No. 1</span>
        <span>Saturday &amp; Sunday</span>
      </div>
    </header>
  );
}
