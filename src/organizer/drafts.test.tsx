import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

// Records what the table asks to stage.
const staged = vi.hoisted(() => [] as { ids: string[]; decision: string | null }[]);
vi.mock("./data", () => ({
  stageDecision: async (items: { id: string }[], decision: string | null) => {
    staged.push({ ids: items.map(i => i.id), decision });
    return { updated: items.map(i => ({ id: i.id, version: 1 })), conflicts: [], drafts: [], missing: [] };
  },
  stageProblems: () => null,
  useEventId: () => ({ data: "event-1" }),
  useApplication: () => ({ data: undefined, isPending: false, isError: false }),
}));

import ApplicationsTable from "./ApplicationsTable";
import { isStaged, type Row } from "./types";

const row = (id: string, status: string, decision: string | null = null) =>
  ({
    id, status, decision, decision_version: 0, decided_by: null, decided_at: null, code: null, passSentAt: null,
    first_name: id, last_name: null, email: `${id}@example.com`, applicant_type: "hacker", checkedIn: false,
    submitted_at: status === "draft" ? null : "2026-11-20T00:00:00Z", school: null, phone: null,
  }) as unknown as Row;

const rows = [row("ana", "submitted"), row("ben", "submitted"), row("gus", "draft"), row("old", "draft", "accepted")];

describe("drafts in the console", () => {
  it("aren't in Applied: they have their own Drafts tab, labelled Draft", () => {
    render(<ApplicationsTable kind="hacker" rows={rows} onChanged={() => {}} />);
    expect(screen.getByRole("tab", { name: /^Applied 2/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^Accepted 0/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /^Drafts 2/ }));
    const table = screen.getByRole("table");
    expect(within(table).getAllByText("Draft").length).toBeGreaterThanOrEqual(2);
    // No checkboxes: they can't be decided.
    expect(within(table).queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("are never picked by select all or a bulk decision", async () => {
    render(<ApplicationsTable kind="hacker" rows={rows} onChanged={() => {}} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    await vi.waitFor(() => expect(staged).toHaveLength(1));
    expect(staged[0]).toEqual({ ids: ["ana", "ben"], decision: "rejected" });
  });

  it("never count as staged, so a release can't include them", () => {
    expect(rows.filter(isStaged)).toEqual([]);
  });
});
