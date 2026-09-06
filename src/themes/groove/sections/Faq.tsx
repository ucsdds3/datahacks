import { useState } from "react";
import { Daisy, Swirl } from "../art/Doodles";
import { MARIGOLD, PINK } from "../art/palette";
import { DriftingDoodle, Reveal } from "../motion";

const QA = [
  {
    q: "Who can apply?",
    a: "Any current student, any major, any experience level. First-time hackers welcome.",
  },
  {
    q: "How much does it cost?",
    a: "Nothing. Free to attend, with meals and swag included.",
  },
  {
    q: "Can I bring a team?",
    a: "Teams of up to 4. Come solo and we'll help you find one at team formation.",
  },
  {
    q: "What should I bring?",
    a: "Laptop, charger, student ID. We'll handle food, caffeine and floor space.",
  },
  {
    q: "Is travel covered?",
    a: "Travel reimbursement details are TBD and will be announced with applications.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="g-faq" id="faq">
      <div className="g-wrap g-faq__wrap">
        <div className="g-faq__aside">
          <Reveal>
            <p className="g-label">Questions</p>
            <h2 className="g-faq__title">
              Answers,
              <br />
              ahead of time
            </h2>
            <p className="g-faq__copy">
              Anything not covered here, ask us at{" "}
              <a href="mailto:hello@ds3ucsd.com">hello@ds3ucsd.com</a>.
            </p>
          </Reveal>
          <DriftingDoodle className="g-doodle g-doodle--faqdaisy" speed={22} spin={-10}>
            <Daisy accent={MARIGOLD} />
          </DriftingDoodle>
        </div>

        <ul className="g-faq__list">
          {QA.map((item, i) => {
            const isOpen = open === i;
            return (
              <Reveal as="li" key={item.q} delay={0.05 * i} className="g-faq__item">
                <button
                  type="button"
                  className="g-faq__q"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                >
                  <span className="g-faq__n">{String(i + 1).padStart(2, "0")}</span>
                  <span className="g-faq__qtext">{item.q}</span>
                  <span className={`g-faq__toggle${isOpen ? " is-open" : ""}`} aria-hidden="true">
                    <span />
                    <span />
                  </span>
                </button>
                <div className={`g-faq__a${isOpen ? " is-open" : ""}`}>
                  <p>{item.a}</p>
                </div>
              </Reveal>
            );
          })}
        </ul>
      </div>

      <DriftingDoodle className="g-doodle g-doodle--faqswirl" speed={-26} spin={8}>
        <Swirl colour={PINK} />
      </DriftingDoodle>
    </section>
  );
}
