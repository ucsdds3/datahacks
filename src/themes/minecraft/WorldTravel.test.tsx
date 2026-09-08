import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorldLink, WorldTravel } from "./WorldTravel";

function renderJourney() {
  return render(<MemoryRouter initialEntries={["/minecraft"]}>
    <WorldTravel><main id="mc-main"><Routes>
      <Route path="/minecraft" element={<WorldLink to="/minecraft/mentors" kind="trial">Enter chamber</WorldLink>} />
      <Route path="/minecraft/mentors" element={<h1 tabIndex={-1}>Mentor interest</h1>} />
    </Routes></main></WorldTravel>
  </MemoryRouter>);
}

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("dimension navigation", () => {
  it("goes directly to the form when reduced motion is requested", () => {
    const media = window.matchMedia;
    vi.spyOn(window, "matchMedia").mockImplementation(query => ({ ...media(query), matches: query.includes("prefers-reduced-motion") }));
    renderJourney();
    fireEvent.click(screen.getByRole("link", { name: "Enter chamber" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mentor interest" })).toHaveFocus();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("lets keyboard users skip the transition and restores page interaction", () => {
    renderJourney();
    fireEvent.click(screen.getByRole("link", { name: "Enter chamber" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Opening the Trial Chambers");
    expect(screen.getByRole("button", { name: "Skip animation →" })).toHaveFocus();
    expect(document.querySelector("[inert]")).not.toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.querySelector("[inert]")).toBeNull();
    expect(screen.getByRole("heading", { name: "Mentor interest" })).toHaveFocus();
  });

  it("finishes the animated trip without another click", () => {
    vi.useFakeTimers();
    renderJourney();
    fireEvent.click(screen.getByRole("link", { name: "Enter chamber" }));
    act(() => vi.advanceTimersByTime(1900));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mentor interest" })).toBeInTheDocument();
  });
});
