import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Story } from "./Story";
import type { Chapter } from "./chapters";

const fixture: Chapter[] = [
  { id: "one", path: "/minecraft", name: "Surface", y: "+80", color: "#fff", art: null, title: "Chapter one",
    exit: { kind: "dig", label: "Dig down", caption: "BELOW" } },
  { id: "two", path: "/minecraft/two", name: "Stone", y: "+48", color: "#eee", art: null, title: "Chapter two",
    exit: null },
];

function renderStory(path = "/minecraft") {
  return render(<MemoryRouter initialEntries={[path]}>
    <Story chapters={fixture}>{chapter => <p>Body of {chapter.id}</p>}</Story>
  </MemoryRouter>);
}

afterEach(cleanup);

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
