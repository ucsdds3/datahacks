import { StarGlyph } from "../art/Doodles";
import { MARIGOLD, MINT, PINK, SKY, TOMATO } from "../art/palette";

const ITEMS = [
  "DATAHACKS 2.0",
  "JAN 16–17",
  "36 HOURS",
  "BUILD SOMETHING",
  "APPLICATIONS OPEN SOON",
];

const DOT_COLOURS = [TOMATO, MARIGOLD, MINT, SKY, PINK];

function Run({ idPrefix }: { idPrefix: string }) {
  return (
    <div className="g-marquee__run" aria-hidden={idPrefix === "b"}>
      {ITEMS.map((item, i) => (
        <span className="g-marquee__item" key={`${idPrefix}-${item}`}>
          <span>{item}</span>
          <StarGlyph className="g-marquee__star" colour={DOT_COLOURS[i % DOT_COLOURS.length]} />
        </span>
      ))}
    </div>
  );
}

export function MarqueeStrip({
  tone = "cream",
  speed = 34,
  className = "",
}: {
  tone?: "cream" | "ink";
  speed?: number;
  className?: string;
}) {
  return (
    <div
      className={`g-marquee g-marquee--${tone} ${className}`}
      style={{ ["--g-marquee-speed" as string]: `${speed}s` }}
    >
      <div className="g-marquee__track">
        <Run idPrefix="a" />
        <Run idPrefix="b" />
      </div>
    </div>
  );
}
