import {
  Children, Fragment, isValidElement, useId, useMemo, useRef, useState,
  type KeyboardEvent, type MouseEvent, type ReactElement, type ReactNode,
} from "react";
import { Link, useLocation } from "react-router-dom";
import { useStaffPortal } from "../StaffPortalContext";
import { HACKER_GUIDE_PAGES, HANDBOOK_TITLE } from "../config";
import type { GuideSection } from "../handbookContent";
import { overflows, tabPanel, useFitStep } from "./guideFit";

/*
 * The handbook pages in the Nether theme (Figma "Handbook – …" frames): the same content
 * as the End's single stone card, laid out as titled sub-panels on the board, with a
 * glowstone callout for notes and a link on to the next page. Styles: nether-guide.css.
 * Only rendered when the Nether theme is on, so the End's markup is untouched.
 *
 * On desktop the board is a fixed box and these pages never scroll it. Each page tries its
 * layouts from roomiest to most compact and keeps the first that fits (guideFit.ts): every
 * section at once, then one section at a time behind tabs ("On this page"), then one topic
 * of that section at a time, each of those a little denser if need be. Phones keep the
 * stacked layout and scroll as usual.
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

/**
 * A row (or column) of tabs: arrow keys move between them (and open them), Home and End
 * jump to the ends, and only the open one is in the tab order. The panel it controls has
 * the id `${id}-panel` and is labelled by the open tab, `${id}-tab-${selected}`.
 */
export function GuideTabs({ id, label, items, selected, onSelect, vertical = false, className }: {
  id: string;
  label: string;
  items: ReactNode[];
  selected: number;
  onSelect: (index: number) => void;
  vertical?: boolean;
  className?: string;
}) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: KeyboardEvent) => {
    const last = items.length - 1;
    const moves: Record<string, number> = {
      [vertical ? "ArrowDown" : "ArrowRight"]: selected === last ? 0 : selected + 1,
      [vertical ? "ArrowUp" : "ArrowLeft"]: selected === 0 ? last : selected - 1,
      Home: 0,
      End: last,
    };
    const next = moves[e.key];
    if (next === undefined) return;
    e.preventDefault();
    tabs.current[next]?.focus();
    onSelect(next);
  };
  return (
    <div role="tablist" aria-label={label} aria-orientation={vertical ? "vertical" : "horizontal"} className={className} onKeyDown={onKeyDown}>
      {items.map((item, i) => (
        <button
          key={i}
          ref={el => { tabs.current[i] = el; }}
          type="button"
          role="tab"
          id={`${id}-tab-${i}`}
          aria-selected={i === selected}
          aria-controls={`${id}-panel`}
          tabIndex={i === selected ? 0 : -1}
          onClick={() => onSelect(i)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}


// ---------------------------------------------------------------------------
// Sections and panels
// ---------------------------------------------------------------------------

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

/** A section's topics, for showing one at a time: its lead-in (under the section's title), then each sub-panel. */
type Part = { label: ReactNode; heading?: Panel["heading"]; body: ReactNode[] };
const partsOf = ({ section, lead, panels }: SectionLayout): Part[] => [
  ...(lead.length ? [{ label: section.title, body: lead }] : []),
  ...panels.map(panel => ({ label: panel.heading.props.children, heading: panel.heading, body: panel.body })),
];

const Nodes = ({ nodes }: { nodes: ReactNode[] }) => <>{nodes.map((node, i) => <Fragment key={i}>{node}</Fragment>)}</>;

const Draft = ({ section }: { section: GuideSection }) =>
  section.draft ? <p className="sp-guide-draft" role="note">Draft — details coming soon</p> : null;

function GuideSectionView({ layout: { section, lead, panels, wide } }: { layout: SectionLayout }) {
  if (!panels.length) {
    return (
      <section id={section.id} className={`sp-guide-section sp-guide-panel${wide ? " wide" : ""}`}>
        <h2>{section.title}</h2>
        <Draft section={section} />
        <Nodes nodes={lead} />
      </section>
    );
  }
  return (
    <section id={section.id} className="sp-guide-section sp-guide-group wide">
      <h2 className="sp-guide-heading">{section.title}</h2>
      <Draft section={section} />
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

/** Long text across a whole-width panel runs in two columns rather than very long lines; short text stays in one. */
const Prose = ({ nodes }: { nodes: ReactNode[] }) => (
  <div className={weight(nodes) > LONG_PROSE ? "sp-guide-cols" : "sp-guide-prose"}><Nodes nodes={nodes} /></div>
);
const LONG_PROSE = 700;

/**
 * One section on its own: its panels flow down two or three columns, like a masonry wall.
 * Its title is already on the open tab (or is the page's own), so it's kept for screen readers only.
 */
function SectionFlow({ layout: { section, lead, panels } }: { layout: SectionLayout }) {
  if (!panels.length) {
    return (
      <section className="sp-guide-section sp-guide-panel sp-guide-solo">
        <h2>{section.title}</h2>
        <Draft section={section} />
        <Prose nodes={lead} />
      </section>
    );
  }
  return (
    <section className="sp-guide-section sp-guide-group">
      <h2 className="sp-guide-heading sp-guide-sr">{section.title}</h2>
      <Draft section={section} />
      {lead.length > 0 && <div className="sp-guide-lead"><Prose nodes={lead} /></div>}
      <div className="sp-guide-flow">
        {panels.map((panel, i) => (
          <div key={i} className="sp-guide-panel">
            {panel.heading}
            <Nodes nodes={panel.body} />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * One topic of a section at a time. The topics are tabs: a row of options over the topic
 * (`chips`), or a second list under "On this page" (rendered by the page) otherwise.
 */
function SectionPart({ layout, part, onPart, id, chips }: { layout: SectionLayout; part: number; onPart: (i: number) => void; id: string; chips: boolean }) {
  const parts = partsOf(layout);
  const shown = parts[Math.min(part, parts.length - 1)];
  return (
    <section className="sp-guide-section sp-guide-group sp-guide-parts">
      <h2 className="sp-guide-heading sp-guide-sr">{layout.section.title}</h2>
      {chips && <GuideTabs id={id} label={`${layout.section.title} topics`} items={parts.map(p => p.label)} selected={part} onSelect={onPart} className="sp-guide-options" />}
      <div className="sp-guide-panel sp-guide-solo" {...tabPanel(id, part)}>
        <h3 className="sp-guide-sr">{shown.heading ? shown.heading.props.children : layout.section.title}</h3>
        <Prose nodes={shown.body} />
      </div>
    </section>
  );
}

/*
 * The layouts a handbook page tries, roomiest first: every section; one section; one topic
 * of it. Each as drawn, then a little denser (15px text, tighter panels); one section's
 * panels may also run on from one column into the next, to even the columns out. A section's
 * topics are listed under "On this page" (aside), after the sections if there are several,
 * and move to a row of options over the topic only if that list gets too long for the window. A view that still
 * overflows scrolls on its own, as a last resort (a long topic in a very short window).
 */
type Step = { scope: "all" | "section" | "part"; dense?: boolean; aside?: boolean; scroll?: boolean; even?: boolean };
const STEPS: Step[] = [
  { scope: "all" },
  { scope: "all", dense: true },
  { scope: "section" },
  { scope: "section", dense: true },
  { scope: "section", dense: true, even: true },
  { scope: "part", aside: true },
  { scope: "part", aside: true, dense: true },
  { scope: "part", aside: true, dense: true, scroll: true },
  { scope: "part" },
  { scope: "part", dense: true },
  { scope: "part", dense: true, scroll: true },
];
const FIRST_SECTION_STEP = STEPS.findIndex(s => s.scope === "section");
const FIRST_ASIDE_STEP = STEPS.findIndex(s => s.scope === "part" && s.aside);
const FIRST_CHIPS_STEP = STEPS.findIndex(s => s.scope === "part" && !s.aside);

/** A whole handbook page: title, note, contents list for long pages, the panels, and the page links. */
export function NetherGuidePage({ title, intro, note, sections, toc, current }: {
  title: string;
  intro: string;
  note?: ReactNode;
  sections: GuideSection[];
  toc: boolean;
  current: string;
}) {
  const layouts = useMemo(() => layoutSections(sections), [sections]);
  const [active, setActive] = useState(0);
  const [part, setPart] = useState(0);
  const view = useRef<HTMLDivElement>(null);
  const contents = useRef<HTMLDivElement>(null);
  const id = useId();
  const layout = layouts[Math.min(active, layouts.length - 1)];
  const parts = partsOf(layout);
  const many = layouts.length > 1;
  const usable = (s: number) => {
    const { scope, aside } = STEPS[s];
    if (scope === "section") return many || layout.panels.length > 1 && (!STEPS[s].even || layout.panels.length > 2);
    if (scope === "part") return parts.length > 1;
    return true;
  };
  const tooBig = (s: number) => (!STEPS[s].scroll && overflows(view.current)) || (!!STEPS[s].aside && overflows(contents.current));
  const { fit, step, restart } = useFitStep(STEPS.length - 1, tooBig, usable);

  const header = (
    <header className="sp-page-header">
      <GuideEyebrow />
      <h1>{title}</h1>
      <p>{intro}</p>
    </header>
  );

  if (!fit) {
    return (
      <div className="sp-page sp-guide-page">
        {header}
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
              {layouts.map(l => <GuideSectionView key={l.section.id} layout={l} />)}
            </div>
          </article>
        </div>
        <GuidePager current={current} />
      </div>
    );
  }

  const { scope, dense, aside, scroll, even } = STEPS[step];
  const tabs = scope !== "all" && many;
  const split = scope === "part" && parts.length > 1;
  const openSection = (i: number) => {
    setActive(i);
    setPart(0);
    restart(FIRST_SECTION_STEP);
  };
  // Another topic of the same section: its list stays where it is (beside or above), so focus stays on it.
  const openPart = (i: number) => {
    setPart(i);
    restart(aside ? FIRST_ASIDE_STEP : FIRST_CHIPS_STEP);
  };

  return (
    <div className={`sp-page sp-guide-page sp-guide-fit${dense ? " dense" : ""}${even ? " even" : ""}${scroll ? " scroll" : ""}`}>
      <div className="sp-guide-top">
        {header}
        {note && <GuideNote>{note}</GuideNote>}
      </div>
      <div className="sp-guide-body">
        {(tabs || (split && aside)) && (
          <div ref={contents} className="sp-guide-toc">
            <span aria-hidden>On this page</span>
            {tabs && <GuideTabs id={`${id}s`} label={`${title} sections`} items={sections.map(s => s.title)} selected={active} onSelect={openSection} vertical />}
            {split && aside && <>
              {tabs && <span aria-hidden>In this section</span>}
              <GuideTabs id={`${id}p`} label={`${layout.section.title} topics`} items={parts.map(p => p.label)} selected={part} onSelect={openPart} vertical />
            </>}
          </div>
        )}
        <div ref={view} className="sp-guide-view" {...(tabs ? tabPanel(`${id}s`, active, !split) : {})}>
          <article className="sp-guide">
            {scope === "all"
              ? <div className="sp-guide-grid">{layouts.map(l => <GuideSectionView key={l.section.id} layout={l} />)}</div>
              : split
                ? <SectionPart key={layout.section.id} layout={layout} part={part} onPart={openPart} id={`${id}p`} chips={!aside} />
                : <SectionFlow key={layout.section.id} layout={layout} />}
          </article>
        </div>
      </div>
      <GuidePager current={current} />
    </div>
  );
}
