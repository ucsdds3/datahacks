import Reveal from "../Reveal";
import { Manicule } from "../art/Specimens";

const TIERS = [
  { name: "Diamond", slots: 2, size: "lg" },
  { name: "Gold", slots: 3, size: "md" },
  { name: "Silver", slots: 4, size: "sm" },
];

export default function Sponsors() {
  return (
    <Reveal className="press-sponsors" id="sponsors">
      <div className="press-rubric press-rubric--invert">
        <span className="press-rubric__num">§ 04</span>
        <span className="press-rubric__name">Sponsors</span>
        <span className="press-rubric__rule" aria-hidden="true" />
        <span className="press-rubric__note">Plates held open</span>
      </div>

      <div className="press-sponsors__head">
        <h2 className="press-serif-head press-serif-head--invert">
          Every slot on this page
          <em> is still available.</em>
        </h2>
        <p className="press-sponsors__inquiry">
          <Manicule className="press-manicule" />
          <span>
            Sponsor inquiries →{" "}
            <a href="mailto:sponsorship@ds3ucsd.com">sponsorship@ds3ucsd.com</a>
          </span>
        </p>
      </div>

      {TIERS.map((t) => (
        <div className={`press-tierrow press-tierrow--${t.size}`} key={t.name}>
          <h3 className="press-tierrow__label">
            {t.name}
            <span className="press-tierrow__count">
              {t.slots} slot{t.slots > 1 ? "s" : ""}
            </span>
          </h3>
          <ul className="press-tierrow__slots">
            {Array.from({ length: t.slots }).map((_, i) => (
              <li className="press-slotframe" key={i}>
                <span className="press-slotframe__mark" aria-hidden="true" />
                <span className="press-slotframe__label">Open</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Reveal>
  );
}
