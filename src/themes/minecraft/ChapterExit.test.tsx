import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Story } from "./Story";
import { ChapterExit } from "./ChapterExit";
import type { Chapter } from "./chapters";

const fixture: Chapter[] = [
  { id: "one", path: "/minecraft", name: "Surface", y: "+80", color: "#fff", art: null, title: "Chapter one",
    exit: { kind: "dig", label: "Dig down", caption: "SOMETHING LIES BELOW" } },
  { id: "two", path: "/minecraft/two", name: "Stone", y: "+48", color: "#eee", art: null, title: "Chapter two",
    exit: null },
];

function renderExit(path = "/minecraft") {
  return render(<MemoryRouter initialEntries={[path]}>
    <Story chapters={fixture}>{chapter => <><p>Body of {chapter.id}</p><ChapterExit /></>}</Story>
  </MemoryRouter>);
}

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("chapter exit", () => {
  it("plays the break, then advances the story", () => {
    vi.useFakeTimers();
    renderExit();
    fireEvent.click(screen.getByRole("button", { name: /Dig down/ }));
    expect(screen.getByText("Body of one"), "block should finish breaking first").toBeInTheDocument();
    act(() => vi.advanceTimersByTime(700));
    expect(screen.getByText("Body of two")).toBeInTheDocument();
  });

  it("does not double-fire when clicked twice", () => {
    vi.useFakeTimers();
    renderExit();
    const button = screen.getByRole("button", { name: /Dig down/ });
    fireEvent.click(button);
    fireEvent.click(button);
    act(() => vi.advanceTimersByTime(700));
    expect(screen.getByText("Body of two")).toBeInTheDocument();
  });

  it("skips the break for reduced motion", () => {
    const media = window.matchMedia;
    vi.spyOn(window, "matchMedia").mockImplementation(query => ({ ...media(query), matches: query.includes("prefers-reduced-motion") }));
    renderExit();
    fireEvent.click(screen.getByRole("button", { name: /Dig down/ }));
    expect(screen.getByText("Body of two")).toBeInTheDocument();
  });

  it("names the destination for screen readers", () => {
    renderExit();
    expect(screen.getByRole("button", { name: "Dig down — continue to Stone" })).toBeInTheDocument();
  });

  it("shows the caption and the destination", () => {
    renderExit();
    expect(screen.getByText("SOMETHING LIES BELOW")).toBeInTheDocument();
    expect(screen.getByText("Stone")).toBeInTheDocument();
  });

  it("renders nothing on the final chapter", () => {
    renderExit("/minecraft/two");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("carries the kind on the class so the art styling applies", () => {
    renderExit();
    expect(screen.getByRole("button", { name: /Dig down/ })).toHaveClass("mc-encounter-dig");
  });
});
