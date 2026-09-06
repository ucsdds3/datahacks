const PHRASE = [
  "DATAHACKS 2.0",
  "JAN 16–17",
  "36 HOURS",
  "BUILD SOMETHING",
  "APPLICATIONS OPEN SOON",
];

function Group({ hidden }: { hidden?: boolean }) {
  return (
    <div className="press-marquee__group" aria-hidden={hidden || undefined}>
      {Array.from({ length: 3 }).flatMap((_, r) =>
        PHRASE.map((p) => (
          <span className="press-marquee__item" key={`${r}-${p}`}>
            {p}
            <i className="press-marquee__dot" aria-hidden="true">
              ·
            </i>
          </span>
        )),
      )}
    </div>
  );
}

/**
 * Motion #1 of two. Pure CSS translate, killed by prefers-reduced-motion
 * (see press.css), where it falls back to a static strip.
 */
export default function Marquee({
  tone = "forest",
  reverse = false,
}: {
  tone?: "forest" | "ink" | "brick";
  reverse?: boolean;
}) {
  return (
    <div className={`press-marquee press-marquee--${tone}${reverse ? " is-reverse" : ""}`}>
      <div className="press-marquee__track">
        <Group />
        <Group hidden />
      </div>
    </div>
  );
}
