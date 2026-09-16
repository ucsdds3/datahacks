import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { EncounterLink, ExplorationJourney } from "./Exploration";

vi.mock("framer-motion", async importOriginal => {
  const original = await importOriginal<typeof import("framer-motion")>();
  return { ...original, animate: (_from: number, _to: number, options: { onUpdate: (v: number) => void; onComplete: () => void }) => {
    const timer = setTimeout(() => { options.onUpdate(1); options.onComplete(); }, 2000);
    return { stop: () => clearTimeout(timer) };
  } };
});
function Position() { return <output aria-label="Location">{useLocation().hash}</output>; }
function renderJourney() {
  return render(<MemoryRouter initialEntries={["/minecraft"]}><ExplorationJourney>
    <EncounterLink kind="skeleton" target="iron-layer" label="Clear the path" destination="Tracks" />
    <section id="iron-layer" tabIndex={-1} aria-label="Tracks">Choose a track</section><Position />
  </ExplorationJourney></MemoryRouter>);
}
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
const trigger = () => screen.getByRole("link", { name: "Clear the path — explore Tracks" });

describe("continuous exploration", () => {
  it("goes directly to the destination for reduced motion", () => {
    const media = window.matchMedia;
    vi.spyOn(window, "matchMedia").mockImplementation(query => ({ ...media(query), matches: query.includes("prefers-reduced-motion") }));
    renderJourney(); fireEvent.click(trigger());
    expect(screen.queryByRole("button", { name: "Skip descent" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Location")).toHaveTextContent("#iron-layer");
    expect(screen.getByRole("region", { name: "Tracks" })).toHaveFocus();
  });
  it("lets Escape cancel the movement without changing the destination", () => {
    vi.useFakeTimers(); renderJourney(); trigger().focus(); fireEvent.click(trigger());
    expect(document.querySelector("[inert]")).toBeNull();
    expect(document.body.style.overflow).not.toBe("hidden");
    fireEvent.keyDown(window, { key: "Escape" });
    act(() => vi.advanceTimersByTime(2500));
    expect(screen.getByLabelText("Location")).toBeEmptyDOMElement();
    expect(trigger()).toHaveFocus();
  });
  it("hands control back to the wheel without a delayed jump", () => {
    vi.useFakeTimers(); renderJourney(); fireEvent.click(trigger());
    fireEvent.wheel(window); act(() => vi.advanceTimersByTime(2500));
    expect(screen.getByLabelText("Location")).toBeEmptyDOMElement();
    expect(document.documentElement.style.scrollBehavior).not.toBe("auto");
  });
  it("finishes the camera movement and focuses the next layer", () => {
    vi.useFakeTimers(); renderJourney(); fireEvent.click(trigger());
    act(() => vi.advanceTimersByTime(2100));
    expect(screen.getByLabelText("Location")).toHaveTextContent("#iron-layer");
    expect(screen.getByRole("region", { name: "Tracks" })).toHaveFocus();
  });
  it("allows skipping to the destination immediately", () => {
    renderJourney(); fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("button", { name: "Skip descent" }));
    expect(screen.getByLabelText("Location")).toHaveTextContent("#iron-layer");
  });
});
