import { Children, Fragment, isValidElement, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useStaffPortal } from "../StaffPortalContext";
import { HACKER_GUIDE_PAGES, HANDBOOK_TITLE } from "../config";
import type { GuideSection } from "../handbookContent";

/*
 * The handbook pages in the Nether theme (Figma "Handbook – …" frames): the same content
 * as the End's single stone card, laid out as titled sub-panels on the board, with a
 * glowstone callout for notes and a link on to the next page. Styles: nether-guide.css.
 * Only rendered when the Nether theme is on, so the End's markup is untouched.
 */

/** The small line over the page title. */
export const GuideEyebrow = () => <p className="sp-guide-eyebrow">Event info · Handbook</p>;

/** The glowstone-outlined "Good to know" callout. */
export function GuideNote({ children }: { children: ReactNode }) {
  return (
    <div className="sp-guide-note" role="note">
      <span className="sp-guide-note-mark" aria-hidden />
      <div>
        <p className="sp-guide-note-title">Good to know</p>
        <p>{children}</p>
      </div>
    </div>
  );
}

/** Back and on through the handbook, in sidebar order: "← Resources", "Reimbursement →". */
export function GuidePager({ current }: { current: string }) {
  const { portal, basePath } = useStaffPortal();
  const { search } = useLocation();
  const pages: { slug: string; label: string }[] = portal === "hacker"
    ? [...HACKER_GUIDE_PAGES]
    : [{ slug: "handbook", label: HANDBOOK_TITLE[portal] }, { slug: "schedule", label: "Run of show" }];
  const index = pages.findIndex(p => p.slug === current);
  const prev = index > 0 ? pages[index - 1] : undefined;
  const next = index >= 0 ? pages[index + 1] : undefined;
  if (!prev && !next) return null;
  const to = (slug: string) => ({ pathname: `${basePath}/${slug}`, search });
  // The links sit at the bottom of the page: open the next one at its top (unless it's opening in a new tab).
  const toTop = (e: MouseEvent) => {
    if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) window.scrollTo({ top: 0, behavior: "instant" });
  };
  return (
    <nav className="sp-guide-pager" aria-label="Handbook pages">
      {prev && <Link className="sp-guide-prev" rel="prev" to={to(prev.slug)} onClick={toTop}><span aria-hidden>←</span> {prev.label}</Link>}
      {next && <Link className="sp-guide-next" rel="next" to={to(next.slug)} onClick={toTop}>{next.label} <span aria-hidden>→</span></Link>}
    </nav>
  );
}

// A section's content is a run of h3 / p / ul / table elements (see handbookContent.tsx).
// Each h3 and what follows it becomes a sub-panel; anything before the first h3 is the lead.
// A section without sub-headings is a single panel under its own title. The design's panels
// sit two to a row with matching heights, so neighbours share a row only when they're about
// the same length; the rest take the whole row.

type Panel = { heading: ReactElement<{ children?: ReactNode }>; body: ReactNode[]; wide: boolean };
type SectionLayout = { section: GuideSection; lead: ReactNode[]; panels: Panel[]; wide: boolean };

const flatten = (node: ReactNode): ReactNode[] =>
  Children.toArray(node).flatMap(child =>
    isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment ? flatten(child.props.children) : [child]);

/** Roughly how tall a node renders: its text, plus a line's worth per paragraph or list item. A table always takes a full row. */
const weight = (node: ReactNode): number => {
  if (typeof node === "string" || typeof node === "number") return String(node).length;
  if (Array.isArray(node)) return node.reduce((sum: number, child) => sum + weight(child), 0);
  if (isValidElement<{ children?: ReactNode; rows?: unknown }>(node)) {
    if (node.props.rows) return Infinity;
    return weight(node.props.children) + (node.type === "p" || node.type === "li" ? 40 : 0);
  }
  return 0;
};

const MAX_HALF = 650;
const fits = (a: number, b: number) => Math.max(a, b) <= MAX_HALF && Math.max(a, b) <= 2 * Math.min(a, b) + 100;

/** Marks neighbours that can share a row (wide: false), two by two, in order. */
function pairUp<T extends { wide: boolean }>(items: T[], weightOf: (item: T) => number, pairable: (item: T) => boolean = () => true) {
  for (let i = 0; i < items.length - 1; i++) {
    const [a, b] = [items[i], items[i + 1]];
    if (pairable(a) && pairable(b) && fits(weightOf(a), weightOf(b))) {
      a.wide = b.wide = false;
      i++;
    }
  }
}

const sameText = (node: ReactNode, text: string) => typeof node === "string" && node.trim().toLowerCase() === text.trim().toLowerCase();

function layoutSections(sections: GuideSection[]): SectionLayout[] {
  const layouts = sections.map(section => {
    let lead: ReactNode[] = [];
    let panels: Panel[] = [];
    for (const node of flatten(section.content)) {
      if (isValidElement(node) && node.type === "h3") panels.push({ heading: node as Panel["heading"], body: [], wide: true });
      else (panels.length ? panels[panels.length - 1].body : lead).push(node);
    }
    // One sub-heading that only repeats the section's title ("Travel reimbursements"): one panel.
    if (!lead.length && panels.length === 1 && sameText(panels[0].heading.props.children, section.title)) {
      lead = panels[0].body;
      panels = [];
    }
    pairUp(panels, panel => weight(panel.body));
    return { section, lead, panels, wide: true };
  });
  // Single-panel sections next to each other can share a row too.
  pairUp(layouts, l => weight(l.lead), l => !l.panels.length);
  return layouts;
}

const Nodes = ({ nodes }: { nodes: ReactNode[] }) => <>{nodes.map((node, i) => <Fragment key={i}>{node}</Fragment>)}</>;

function GuideSectionView({ layout: { section, lead, panels, wide } }: { layout: SectionLayout }) {
  const draft = section.draft && <p className="sp-guide-draft" role="note">Draft — details coming soon</p>;
  if (!panels.length) {
    return (
      <section id={section.id} className={`sp-guide-section sp-guide-panel${wide ? " wide" : ""}`}>
        <h2>{section.title}</h2>
        {draft}
        <Nodes nodes={lead} />
      </section>
    );
  }
  return (
    <section id={section.id} className="sp-guide-section sp-guide-group wide">
      <h2 className="sp-guide-heading">{section.title}</h2>
      {draft}
      {lead.length > 0 && <div className="sp-guide-lead"><Nodes nodes={lead} /></div>}
      <div className="sp-guide-grid">
        {panels.map((panel, i) => (
          <div key={i} className={panel.wide ? "sp-guide-panel wide" : "sp-guide-panel"}>
            {panel.heading}
            <Nodes nodes={panel.body} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** A whole handbook page: title, note, contents list for long pages, the panels, and the page links. */
export function NetherGuidePage({ title, intro, note, sections, toc, current }: {
  title: string;
  intro: string;
  note?: ReactNode;
  sections: GuideSection[];
  toc: boolean;
  current: string;
}) {
  return (
    <div className="sp-page sp-guide-page">
      <header className="sp-page-header">
        <GuideEyebrow />
        <h1>{title}</h1>
        <p>{intro}</p>
      </header>
      {note && <GuideNote>{note}</GuideNote>}
      <div className={toc ? "sp-handbook" : undefined}>
        {toc && (
          <nav className="sp-toc" aria-label={`${title} sections`}>
            <span>On this page</span>
            {sections.map(s => <a key={s.id} href={`#${s.id}`}>{s.title}</a>)}
          </nav>
        )}
        <article className="sp-guide">
          <div className="sp-guide-grid">
            {layoutSections(sections).map(layout => <GuideSectionView key={layout.section.id} layout={layout} />)}
          </div>
        </article>
      </div>
      <GuidePager current={current} />
    </div>
  );
}
