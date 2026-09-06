import React, { useState } from "react";
import { IconToggle } from "../art/Icons";
import { Rise } from "../motion";

const QA: Array<[string, string]> = [
  [
    "Who can apply?",
    "Any current student, any major, any experience level. First-time hackers are welcome and there is a beginner workshop track running all Saturday afternoon.",
  ],
  [
    "How much does it cost?",
    "Nothing. Free to attend, with meals and swag included.",
  ],
  [
    "Can I bring a team?",
    "Teams of up to 4. Come solo and we'll help you find one at team formation.",
  ],
  [
    "What should I bring?",
    "Laptop, charger, student ID. We'll handle food, caffeine and floor space.",
  ],
  [
    "Is travel covered?",
    "Travel reimbursement details are TBD and will be announced with applications.",
  ],
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="pop-band pop-band--cream pop-faq" id="faq">
      <div className="pop-wrap pop-faq-grid">
        <div className="pop-faq-side" id="apply">
          <Rise>
            <p className="pop-eyebrow">Questions</p>
          </Rise>
          <Rise i={1}>
            <h2 className="pop-h2">before you apply</h2>
          </Rise>
          <Rise i={2}>
            <p className="pop-note">
              Applications open closer to the date. Anything still unanswered goes to{" "}
              <a href="mailto:hello@ds3ucsd.com">hello@ds3ucsd.com</a>.
            </p>
          </Rise>
          <Rise i={3}>
            <a className="pop-btn" href="#top">
              Apply to hack
            </a>
          </Rise>
        </div>

        <Rise i={1} className="pop-faq-listwrap">
          <ul className="pop-faq-list">
            {QA.map(([q, a], i) => {
              const isOpen = open === i;
              return (
                <li className="pop-faq-row" key={q}>
                  <button
                    className="pop-faq-q"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : i)}
                  >
                    <span>{q}</span>
                    <IconToggle open={isOpen} className="pop-faq-icon" />
                  </button>
                  <div className={"pop-faq-a" + (isOpen ? " is-open" : "")}>
                    <p>{a}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Rise>
      </div>
    </section>
  );
}
