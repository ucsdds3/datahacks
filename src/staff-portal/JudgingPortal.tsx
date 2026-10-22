import { Gavel } from "lucide-react";

// Placeholder until the judging tool is hooked up.
export default function JudgingPortal() {
  return (
    <div className="sp-page">
      <header className="sp-page-header">
        <h1>Judging Portal</h1>
        <p>Scoring, assignments and submissions for judges.</p>
      </header>
      <section className="sp-card sp-coming-soon">
        <Gavel size={36} aria-hidden />
        <h2>Coming soon</h2>
        <p>The judging portal will open closer to the event. Check back here before judging begins.</p>
      </section>
    </div>
  );
}
