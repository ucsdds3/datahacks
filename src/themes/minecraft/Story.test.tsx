import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Story, useStory } from "./Story";
import type { Chapter } from "./chapters";

const fixture: Chapter[] = [
  { id: "one", path: "/minecraft", name: "Surface", y: "+80", color: "#fff", art: null, title: "Chapter one",
    exit: { kind: "dig", label: "Dig down", caption: "BELOW" } },
  { id: "two", path: "/minecraft/two", name: "Stone", y: "+48", color: "#eee", art: null, title: "Chapter two",
    exit: null },
];

/** Exposes the story controls so a test can drive them without the real affordance. */
function Controls() {
  const { next, previous, index } = useStory();
  return <>
    <button onClick={next}>go next</button>
    <button onClick={previous}>go back</button>
    <output aria-label="Index">{index}</output>
  </>;
}

function renderStory(path = "/minecraft") {
  return render(<MemoryRouter initialEntries={[path]}>
    <Story chapters={fixture}>{chapter => <><p>Body of {chapter.id}</p><Controls /></>}</Story>
  </MemoryRouter>);
}
const clickNext = () => fireEvent.click(screen.getByRole("button", { name: "go next" }));
const clickBack = () => fireEvent.click(screen.getByRole("button", { name: "go back" }));

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
const preferReducedMotion = () => {
  const media = window.matchMedia;
  vi.spyOn(window, "matchMedia").mockImplementation(query => ({ ...media(query), matches: query.includes("prefers-reduced-motion") }));
};

describe("Story shell", () => {
  it("renders only the current chapter", () => {
    renderStory();
    expect(screen.getByText("Body of one")).toBeInTheDocument();
    expect(screen.queryByText("Body of two")).not.toBeInTheDocument();
  });

  it("opens directly on a deep-linked chapter", () => {
    renderStory("/minecraft/two");
    expect(screen.getByText("Body of two")).toBeInTheDocument();
    expect(screen.queryByText("Body of one")).not.toBeInTheDocument();
  });

  it("falls back to the first chapter for an unknown path", () => {
    renderStory("/minecraft/nowhere");
    expect(screen.getByText("Body of one")).toBeInTheDocument();
  });

  it("labels the chapter as a region and gives it focus", () => {
    renderStory();
    expect(screen.getByRole("region", { name: "Chapter one" })).toHaveFocus();
  });

  it("locks the page so nothing can scroll", () => {
    renderStory();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("releases the lock on unmount", () => {
    renderStory().unmount();
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});

describe("moving through the story", () => {
  it("advances exactly one chapter", () => {
    vi.useFakeTimers();
    renderStory();
    clickNext();
    act(() => vi.advanceTimersByTime(900));
    expect(screen.getByText("Body of two")).toBeInTheDocument();
    expect(screen.queryByText("Body of one")).not.toBeInTheDocument();
  });

  it("goes back one chapter", () => {
    renderStory("/minecraft/two");
    clickBack();
    expect(screen.getByText("Body of one")).toBeInTheDocument();
  });

  it("stops at the first chapter", () => {
    renderStory();
    clickBack();
    expect(screen.getByLabelText("Index")).toHaveTextContent("0");
    expect(screen.getByText("Body of one")).toBeInTheDocument();
  });

  it("stops at the last chapter", () => {
    renderStory("/minecraft/two");
    clickNext();
    expect(screen.getByLabelText("Index")).toHaveTextContent("1");
    expect(screen.getByText("Body of two")).toBeInTheDocument();
  });

  it("moves the URL so browser history follows the story", () => {
    renderStory();
    clickNext();
    expect(screen.getByRole("region", { name: "Chapter two" })).toBeInTheDocument();
  });
});

describe("story controls", () => {
  it.each(["ArrowDown", "ArrowRight", "PageDown", " "])("advances on %s", key => {
    renderStory();
    fireEvent.keyDown(window, { key });
    expect(screen.getByText("Body of two")).toBeInTheDocument();
  });

  it.each(["ArrowUp", "ArrowLeft", "PageUp"])("goes back on %s", key => {
    renderStory("/minecraft/two");
    fireEvent.keyDown(window, { key });
    expect(screen.getByText("Body of one")).toBeInTheDocument();
  });

  it("returns to the first chapter on Home", () => {
    renderStory("/minecraft/two");
    fireEvent.keyDown(window, { key: "Home" });
    expect(screen.getByText("Body of one")).toBeInTheDocument();
  });

  it("jumps to the last chapter on End", () => {
    renderStory();
    fireEvent.keyDown(window, { key: "End" });
    expect(screen.getByText("Body of two")).toBeInTheDocument();
  });

  it("ignores the wheel, because a trackpad flick overshoots", () => {
    renderStory();
    fireEvent.wheel(window, { deltaY: 400 });
    expect(screen.getByText("Body of one")).toBeInTheDocument();
  });

  it("leaves a browser shortcut alone", () => {
    renderStory();
    fireEvent.keyDown(window, { key: "ArrowDown", metaKey: true });
    expect(screen.getByText("Body of one")).toBeInTheDocument();
  });

  it("leaves typing in a field alone", () => {
    renderStory();
    const field = document.createElement("input");
    document.body.append(field);
    field.focus();
    fireEvent.keyDown(field, { key: " ", bubbles: true });
    expect(screen.getByText("Body of one")).toBeInTheDocument();
    field.remove();
  });

  it("advances on an upward swipe", () => {
    renderStory();
    fireEvent.touchStart(window, { touches: [{ clientX: 100, clientY: 400 }] });
    fireEvent.touchEnd(window, { changedTouches: [{ clientX: 104, clientY: 250 }] });
    expect(screen.getByText("Body of two")).toBeInTheDocument();
  });

  it("goes back on a downward swipe", () => {
    renderStory("/minecraft/two");
    fireEvent.touchStart(window, { touches: [{ clientX: 100, clientY: 250 }] });
    fireEvent.touchEnd(window, { changedTouches: [{ clientX: 104, clientY: 400 }] });
    expect(screen.getByText("Body of one")).toBeInTheDocument();
  });

  it("ignores a sideways swipe", () => {
    renderStory();
    fireEvent.touchStart(window, { touches: [{ clientX: 100, clientY: 400 }] });
    fireEvent.touchEnd(window, { changedTouches: [{ clientX: 400, clientY: 330 }] });
    expect(screen.getByText("Body of one")).toBeInTheDocument();
  });

  it("ignores a short swipe", () => {
    renderStory();
    fireEvent.touchStart(window, { touches: [{ clientX: 100, clientY: 400 }] });
    fireEvent.touchEnd(window, { changedTouches: [{ clientX: 100, clientY: 370 }] });
    expect(screen.getByText("Body of one")).toBeInTheDocument();
  });
});

describe("the camera descent", () => {
  it("holds both chapters while the camera moves, then drops the old one", () => {
    vi.useFakeTimers();
    renderStory();
    clickNext();
    expect(screen.getByText("Body of one")).toBeInTheDocument();
    expect(screen.getByText("Body of two")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(900));
    expect(screen.queryByText("Body of one")).not.toBeInTheDocument();
    expect(screen.getByText("Body of two")).toBeInTheDocument();
  });

  it("takes the leaving chapter out of reach while it is still on screen", () => {
    vi.useFakeTimers();
    renderStory();
    clickNext();
    expect(screen.getByText("Body of one").closest("section")).toHaveAttribute("inert");
    expect(screen.getByText("Body of two").closest("section")).not.toHaveAttribute("inert");
  });

  it("marks the direction so the camera can rise instead of fall", () => {
    vi.useFakeTimers();
    renderStory("/minecraft/two");
    clickBack();
    expect(screen.getByText("Body of one").closest("section")).toHaveAttribute("data-back");
  });

  it("ignores a second advance while the camera is moving", () => {
    vi.useFakeTimers();
    renderStory();
    clickNext();
    fireEvent.keyDown(window, { key: "ArrowDown" });
    act(() => vi.advanceTimersByTime(900));
    expect(screen.getAllByLabelText("Index")[0]).toHaveTextContent("1");
  });

  it("arrives instantly when the visitor prefers reduced motion", () => {
    preferReducedMotion();
    renderStory();
    clickNext();
    expect(screen.getByText("Body of two")).toBeInTheDocument();
    expect(screen.queryByText("Body of one")).not.toBeInTheDocument();
  });
});
