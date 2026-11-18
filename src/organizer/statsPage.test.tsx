import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { previewStats } from "./statsPreview";

// The page's data: the preview's made-up season, as the query hook would hand it over.
vi.mock("./data", () => ({
  STATS_REFRESH_MS: 60_000,
  useStats: () => ({
    isPending: false, isError: false, isFetching: false, error: null,
    data: previewStats(), dataUpdatedAt: Date.parse("2026-12-15T20:00:00Z"), refetch: vi.fn(),
  }),
}));

import StatsPage from "./StatsPage";

describe("organizer stats tabs", () => {
  it("opens on hackers, with mentors & judges in a tab of their own", () => {
    render(<StatsPage eventId="preview-event" />);
    const tabs = screen.getByRole("tablist", { name: "Stats for" });
    const hackers = within(tabs).getByRole("tab", { name: /^Hackers \d/ });
    const staff = within(tabs).getByRole("tab", { name: /^Mentors & judges \d/ });
    expect(hackers).toHaveAttribute("aria-selected", "true");
    expect(staff).toHaveAttribute("aria-selected", "false");

    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("aria-labelledby", hackers.id);
    expect(within(panel).getByRole("list", { name: "Hacker overview" })).toBeInTheDocument();
    expect(within(panel).getByRole("heading", { name: "Suggested food" })).toBeInTheDocument();
    expect(within(panel).getByRole("heading", { name: "Gender" })).toBeInTheDocument();
    expect(within(panel).queryByRole("heading", { name: "Judging tracks" })).not.toBeInTheDocument();
    // The mentors & judges count lives on its tab now, not in the hacker tiles.
    expect(within(panel).queryByText("Mentors & judges")).not.toBeInTheDocument();

    fireEvent.click(staff);
    expect(staff).toHaveAttribute("aria-selected", "true");
    const staffPanel = screen.getByRole("tabpanel");
    expect(staffPanel).toHaveAttribute("aria-labelledby", staff.id);
    const tiles = within(staffPanel).getByRole("list", { name: "Mentor and judge overview" });
    expect(within(tiles).getAllByRole("listitem").map(li => li.querySelector(".og-ci-tile-label")?.textContent)).toEqual([
      "Applications", "Mentors", "Judges", "Mentor & judge", "Organizations",
    ]);
    expect(within(staffPanel).getByRole("heading", { name: "Judging tracks" })).toBeInTheDocument();
    expect(within(staffPanel).getByRole("heading", { name: "Decisions" })).toBeInTheDocument();
    expect(within(staffPanel).queryByRole("heading", { name: "Suggested food" })).not.toBeInTheDocument();
  });

  it("arrow keys, Home and End move between the tabs", () => {
    render(<StatsPage eventId="preview-event" />);
    const hackers = screen.getByRole("tab", { name: /^Hackers/ });
    const staff = screen.getByRole("tab", { name: /^Mentors & judges/ });
    expect(hackers).toHaveAttribute("tabindex", "0");
    expect(staff).toHaveAttribute("tabindex", "-1");

    hackers.focus();
    fireEvent.keyDown(hackers, { key: "ArrowRight" });
    expect(staff).toHaveAttribute("aria-selected", "true");
    expect(staff).toHaveFocus();
    expect(staff).toHaveAttribute("tabindex", "0");

    fireEvent.keyDown(staff, { key: "ArrowRight" }); // wraps around
    expect(hackers).toHaveAttribute("aria-selected", "true");
    expect(hackers).toHaveFocus();

    fireEvent.keyDown(hackers, { key: "End" });
    expect(staff).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(staff, { key: "Home" });
    expect(hackers).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(hackers, { key: "ArrowLeft" });
    expect(staff).toHaveAttribute("aria-selected", "true");
  });
});
