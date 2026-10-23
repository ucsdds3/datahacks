import { Link, useLocation } from "react-router-dom";
import { Check } from "lucide-react";
import { useStaffPortal } from "./StaffPortalContext";
import { TIMELINE, applicationBatch, type ApplicationStatus } from "./config";

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending: "Under review",
  accepted: "Accepted",
  waitlisted: "Waitlisted",
  rejected: "Not accepted",
};

const formatDate = (value: Date | string) =>
  new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

const DECISION_TEXT: Record<ApplicationStatus, string> = {
  pending: "We'll email you when your decision is out.",
  accepted: "You're in! The handbook, run of show and liability waiver are now open in the sidebar.",
  waitlisted: "You're on the waitlist. We'll email you if a spot opens up.",
  rejected: "We couldn't offer you a spot this year. Thank you for applying, and we hope to see you next time.",
};

type Step = { title: string; detail: string; done: boolean };

/** The portal's home page: where the application stands and what happens next. */
export default function Dashboard() {
  const { basePath, fullName, status, submittedAt, portal, waiverSubmitted } = useStaffPortal();
  const { search } = useLocation();
  const decided = status !== "pending";
  const batch = applicationBatch(submittedAt);

  const steps: Step[] = [
    { title: "Application submitted", detail: submittedAt ? formatDate(submittedAt) : "Received", done: true },
    {
      title: "Under review",
      detail: portal === "hacker"
        ? batch === "priority"
          ? `Priority batch (applied by ${formatDate(TIMELINE.priorityDeadline)}): decisions by ${TIMELINE.priorityDecisions}.`
          : `Regular batch: applications close ${formatDate(TIMELINE.regularDeadline)}, decisions by ${TIMELINE.regularDecisions}.`
        : "Our mentor and judge coordinators review every application.",
      done: decided,
    },
    { title: "Decision", detail: DECISION_TEXT[status], done: decided },
    { title: "DataHacks", detail: TIMELINE.eventDates[portal], done: false },
  ];

  return (
    <div className="sp-page">
      <header className="sp-greeting">
        <div className="sp-greeting-row">
          <h1>Hello, {fullName}!</h1>
          <span className={`sp-status ${status}`}>
            <span className="sp-dot" aria-hidden /> {STATUS_LABEL[status]}
          </span>
        </div>
        {status === "accepted" && (
          <p className="sp-waiver-line">
            Liability waiver:{" "}
            <span className={waiverSubmitted ? "sp-complete" : "sp-incomplete"}>{waiverSubmitted ? "Completed" : "Incomplete"}</span>
            {!waiverSubmitted && <> · <Link to={{ pathname: `${basePath}/waiver`, search }}>Sign it now</Link></>}
          </p>
        )}
      </header>

      <section className="sp-card" aria-labelledby="sp-status-heading">
        <div className="sp-card-header">
          <h2 id="sp-status-heading">Your application</h2>
        </div>
        <ol className="sp-progress">
          {steps.map((step, i) => (
            <li key={step.title} className={step.done ? "done" : i === steps.findIndex(s => !s.done) ? "current" : ""}>
              <span className="sp-step-marker" aria-hidden>{step.done ? <Check size={14} /> : i + 1}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
