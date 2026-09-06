import Reveal from "../Reveal";

const QA = [
  [
    "Who can apply?",
    "Any current student, any major, any experience level. First-time hackers welcome.",
  ],
  ["How much does it cost?", "Nothing. Free to attend, with meals and swag included."],
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
  return (
    <Reveal className="press-faq" id="faq">
      <div className="press-rubric">
        <span className="press-rubric__num">§ 05</span>
        <span className="press-rubric__name">Questions, answered</span>
        <span className="press-rubric__rule" aria-hidden="true" />
        <span className="press-rubric__note">Five of them</span>
      </div>

      <dl className="press-faq__list">
        {QA.map(([q, a], i) => (
          <div className="press-qa" key={q}>
            <dt className="press-qa__q">
              <span className="press-qa__n">{String(i + 1).padStart(2, "0")}</span>
              {q}
            </dt>
            <dd className="press-qa__a">{a}</dd>
          </div>
        ))}
      </dl>
    </Reveal>
  );
}
