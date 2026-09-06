export default function Nav() {
  return (
    <nav className="press-nav" aria-label="Primary">
      <div className="press-nav__side">
        <a className="press-pill" href="#tracks">
          Tracks
        </a>
        <a className="press-pill" href="#schedule">
          Schedule
        </a>
      </div>

      <a className="press-nav__mark" href="#top">
        DataHacks <span className="press-nav__mark-num">2.0</span>
      </a>

      <div className="press-nav__side press-nav__side--right">
        <a className="press-pill" href="#sponsors">
          Sponsors
        </a>
        <a className="press-pill" href="#faq">
          FAQ
        </a>
      </div>
    </nav>
  );
}
