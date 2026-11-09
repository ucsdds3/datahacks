import { usePortalTheme } from "@/portal/portalTheme";
import type { HackerGuideSlug } from "./config";
import { HACKER_GUIDE } from "./handbookContent";
import { NetherGuidePage } from "./nether/NetherGuide";

const DEMO_NOTE = "Demo content: this is from the DataHacks 2026 Hacker Handbook, shown while the 2027 details are written.";

/** One of the hacker portal's handbook pages (Resources, Food, Devpost, …). */
export default function HackerGuide({ page }: { page: HackerGuideSlug }) {
  const nether = usePortalTheme() === "nether";
  const { title, intro, sections } = HACKER_GUIDE[page];
  const demo = sections.some(s => !s.draft);
  if (nether) {
    // Keyed by page, so each page opens on its first tab.
    return <NetherGuidePage key={page} title={title} intro={intro} note={demo && DEMO_NOTE} sections={sections} toc={sections.length > 2} current={page} />;
  }
  return (
    <div className="sp-page">
      <header className="sp-page-header">
        <h1>{title}</h1>
        <p>{intro}</p>
      </header>
      {demo && (
        <p className="sp-demo-note" role="note">{DEMO_NOTE}</p>
      )}
      <div className={sections.length > 2 ? "sp-handbook" : undefined}>
        {sections.length > 2 && (
          <nav className="sp-toc" aria-label={`${title} sections`}>
            <span>On this page</span>
            {sections.map(s => <a key={s.id} href={`#${s.id}`}>{s.title}</a>)}
          </nav>
        )}
        <article className="sp-card sp-prose">
          {sections.map(s => (
            <section key={s.id} id={s.id}>
              <h2>{s.title}</h2>
              {s.draft && <p className="sp-demo-note sp-draft-note" role="note">Draft — details coming soon</p>}
              {s.content}
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
