import React from "react";

const LINKS = [
  ["about", "#about"],
  ["tracks", "#tracks"],
  ["prizes", "#prizes"],
  ["schedule", "#schedule"],
  ["sponsors", "#sponsors"],
  ["faq", "#faq"],
];

export default function TopBar() {
  return (
    <header className="pop-bar">
      <div className="pop-bar-in">
        <a className="pop-bar-mark" href="#top">
          DATAHACKS <span>2.0</span>
        </a>
        <nav className="pop-bar-nav" aria-label="Sections">
          {LINKS.map(([label, href]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
        <a className="pop-bar-cta" href="#apply">
          Apply
        </a>
      </div>
    </header>
  );
}
