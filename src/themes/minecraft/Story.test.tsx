import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Link, MemoryRouter } from "react-router-dom";
import { Story, useStory } from "./Story";
import type { Chapter } from "./chapters";

const fixture: Chapter[] = [
  { id: "one", path: "/minecraft", name: "Surface", y: "+80", color: "#fff", art: null, title: "Chapter one" },
  { id: "two", path: "/minecraft/two", name: "Stone", y: "+48", color: "#eee", art: null, title: "Chapter two" },
  { id: "three", path: "/minecraft/three", name: "Deepslate", y: "−28", color: "#ddd", art: null, title: "Chapter three" },
];

function Controls() {
  const { go, active, total } = useStory();
  return <>
    <button onClick={() => go(active + 1)}>go next</button>
    <button onClick={() => go(2)}>go last</button>
    <Link to="/minecraft/two">Open second chapter</Link>
    <Link to="/minecraft">Return home</Link>
    <button onClick={() => go(99)}>go past the end</button>
    <output aria-label="Active">{active}</output>
    <output aria-label="Total">{total}</output>
  </>;
}

function renderStory(path = "/minecraft") {
  return render(<MemoryRouter initialEntries={[path]}>
    <Story chapters={fixture}>{(chapter, index) => <>
      <p>Body of {chapter.id} at {index}</p>
      {index === 0 && <Controls />}
    </>}</Story>
  </MemoryRouter>);
}

let scrolled: { target: Element; behavior?: string }[] = [];

beforeEach(() => {
  scrolled = [];
  Element.prototype.scrollIntoView = vi.fn(function (this: Element, options?: boolean | ScrollIntoViewOptions) {
    scrolled.push({ target: this, behavior: typeof options === "object" ? options.behavior : undefined });
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const sectionFor = (id: string) => screen.getByText(new RegExp(`Body of ${id}`)).closest("section");

describe("Story scroller", () => {
  it("renders every chapter so the story is one scrollable document", () => {
    renderStory();
    expect(screen.getByText(/Body of one/)).toBeInTheDocument();
    expect(screen.getByText(/Body of two/)).toBeInTheDocument();
    expect(screen.getByText(/Body of three/)).toBeInTheDocument();
  });

  it("labels each chapter as its own region", () => {
    renderStory();
    expect(screen.getByRole("region", { name: "Chapter two" })).toBeInTheDocument();
  });

  it("gives each chapter a snap point to land on", () => {
    renderStory();
    expect(sectionFor("two")).toHaveClass("mc-chapter");
    expect(sectionFor("two")).toHaveAttribute("data-index", "1");
  });

  it("scrolls to the next chapter rather than swapping it in", () => {
    renderStory();
    fireEvent.click(screen.getByRole("button", { name: "go next" }));
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0].target).toBe(sectionFor("two"));
    expect(scrolled[0].behavior).toBe("smooth");
  });

  it("follows navigation links after the initial page has loaded", () => {
    renderStory();
    fireEvent.click(screen.getByRole("link", { name: "Open second chapter" }));
    expect(scrolled.at(-1)?.target).toBe(sectionFor("two"));
    fireEvent.click(screen.getByRole("link", { name: "Return home" }));
    expect(scrolled.at(-1)?.target).toBe(sectionFor("one"));
  });

  it("scrolls to an arbitrary chapter", () => {
    renderStory();
    fireEvent.click(screen.getByRole("button", { name: "go last" }));
    expect(scrolled[0].target).toBe(sectionFor("three"));
  });

  it("clamps past the end instead of scrolling nowhere", () => {
    renderStory();
    fireEvent.click(screen.getByRole("button", { name: "go past the end" }));
    expect(scrolled[0].target).toBe(sectionFor("three"));
  });

  it("jumps straight to a deep-linked chapter without animating from the top", () => {
    renderStory("/minecraft/three");
    expect(scrolled[0].target).toBe(sectionFor("three"));
    expect(scrolled[0].behavior).toBe("auto");
  });

  it("does not jump when the story opens at its first chapter", () => {
    renderStory();
    expect(scrolled).toHaveLength(0);
  });

  it("reports the chapter count", () => {
    renderStory();
    expect(screen.getByLabelText("Total")).toHaveTextContent("3");
  });

  it("honours a preference for reduced motion", () => {
    const media = window.matchMedia;
    vi.spyOn(window, "matchMedia").mockImplementation(query => ({ ...media(query), matches: query.includes("prefers-reduced-motion") }));
    renderStory();
    fireEvent.click(screen.getByRole("button", { name: "go next" }));
    expect(scrolled[0].behavior).toBe("auto");
  });
});
