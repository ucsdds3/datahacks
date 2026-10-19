import { useStaffPortal } from "./StaffPortalContext";
import { HANDBOOK_TITLE } from "./config";
import { HANDBOOK } from "./handbookContent";

export default function Handbook() {
  const { portal } = useStaffPortal();
  return (
    <div className="sp-page">
      <header className="sp-page-header">
        <h1>{HANDBOOK_TITLE[portal]}</h1>
        <p>Everything you need to know before and during DataHacks.</p>
      </header>
      <p className="sp-demo-note" role="note">
        Demo content: this is the DataHacks 2026 Hacker Handbook, shown while the final handbook is written.
      </p>
      <div className="sp-handbook">
        <nav className="sp-toc" aria-label="Handbook sections">
          <span>On this page</span>
          {HANDBOOK.map(s => <a key={s.id} href={`#${s.id}`}>{s.title}</a>)}
        </nav>
        <article className="sp-card sp-prose">
          {HANDBOOK.map(s => (
            <section key={s.id} id={s.id}>
              <h2>{s.title}</h2>
              {s.content}
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
