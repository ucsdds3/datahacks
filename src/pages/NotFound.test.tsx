import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NotFound from "./NotFound";

vi.spyOn(console, "error").mockImplementation(() => {});

describe("404 page", () => {
  it("is titled and labelled as a missing page, with a way on", () => {
    render(<MemoryRouter initialEntries={["/no-such-page"]}><NotFound /></MemoryRouter>);
    expect(document.title).toBe("Page not found · DataHacks");
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Apply to DataHacks" })).toHaveAttribute("href", "/apply");
    expect(screen.getByRole("link", { name: "DataHacks home page" })).toHaveAttribute("href", "/");
  });

  it("an unknown portal page offers the way back to the portal", () => {
    render(<MemoryRouter initialEntries={["/portal/hacker/nope"]}><NotFound /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Back to your portal" })).toHaveAttribute("href", "/portal");
  });
});
