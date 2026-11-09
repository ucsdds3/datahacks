import { describe, expect, it, vi } from "vitest";

// Records what stageDecision asks the database for.
const calls: { fn: string; args: Record<string, unknown> }[] = [];
vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return {
        data: {
          updated: [{ id: "a", version: 3 }],
          conflicts: [{ id: "b", decision: "rejected", decided_by: "ansh@ds3.club", decided_at: "2026-12-04T23:04:00Z", version: 5 }],
          drafts: [],
          missing: [],
        },
        error: null,
      };
    },
  },
}));
vi.mock("@/portal/event", () => ({ currentEventId: async () => "this-event" }));

import { stageDecision, stageProblems } from "./data";

describe("stageDecision", () => {
  it("only touches applications at the current event, with the versions this page loaded", async () => {
    await stageDecision([{ id: "a", decision_version: 2 }, { id: "b", decision_version: 4 }], "accepted");
    expect(calls).toEqual([{
      fn: "stage_decisions",
      args: { p_event_id: "this-event", p_ids: ["a", "b"], p_decision: "accepted", p_versions: [2, 4] },
    }]);
  });

  it("says who changed a row in the meantime instead of overwriting them", async () => {
    const outcome = await stageDecision([{ id: "a", decision_version: 2 }, { id: "b", decision_version: 4 }], "accepted");
    const text = stageProblems(outcome, id => (id === "b" ? "Ben Ortiz" : "Ava"));
    expect(text).toMatch(/Someone else changed this application since your page loaded/);
    expect(text).toMatch(/Ben Ortiz \(now Rejected by ansh@ds3\.club at /);
    expect(stageProblems({ updated: [{ id: "a", version: 1 }], conflicts: [], drafts: [], missing: [] }, () => "x")).toBeNull();
  });

  it("explains drafts that can't be decided", () => {
    expect(stageProblems({ updated: [], conflicts: [], drafts: ["d1", "d2"], missing: [] }, () => "x"))
      .toBe("2 haven't submitted yet (Draft), so can't get a decision.");
  });
});
