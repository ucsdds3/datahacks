import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { EncounterLink, ExplorationJourney } from "./Exploration";

function Position() { return <output aria-label="Location">{useLocation().hash}</output>; }
function renderJourney() {
  return render(<MemoryRouter initialEntries={["/minecraft"]}>
    <ExplorationJourney>
      <EncounterLink kind="skeleton" target="iron-layer" label="Clear the path" destination="Tracks" />
      <section id="iron-layer" tabIndex={-1} aria-label="Tracks">Choose a track</section>
      <Position />
    </ExplorationJourney>
  </MemoryRouter>);
}
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("exploration encounters", () => {
  it("skips motion and focuses the destination when reduced motion is requested", () => {
    const media = window.matchMedia;
    vi.spyOn(window, "matchMedia").mockImplementation(query => ({ ...media(query), matches: query.includes("prefers-reduced-motion") }));
    renderJourney();
    fireEvent.click(screen.getByRole("link", { name: "Clear the path — explore Tracks" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Location")).toHaveTextContent("#iron-layer");
    expect(screen.getByRole("region", { name: "Tracks" })).toHaveFocus();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("keeps keyboard focus in the transition and lets Escape complete it", () => {
    renderJourney();
    fireEvent.click(screen.getByRole("link", { name: "Clear the path — explore Tracks" }));
    const skip = screen.getByRole("button", { name: "Continue now →" });
    expect(skip).toHaveFocus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(skip).toHaveFocus();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.querySelector("[inert]")).toBeNull();
    expect(screen.getByRole("region", { name: "Tracks" })).toHaveFocus();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("finishes the journey automatically and restores scrolling", () => {
    vi.useFakeTimers();
    renderJourney();
    fireEvent.click(screen.getByRole("link", { name: "Clear the path — explore Tracks" }));
    act(() => vi.advanceTimersByTime(1200));
    expect(screen.getByLabelText("Location")).toHaveTextContent("#iron-layer");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.querySelector("[inert]")).toBeNull();
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});
