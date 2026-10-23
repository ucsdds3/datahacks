import { describe, expect, it, vi } from "vitest";

// Records the filters stageDecision puts on its update.
const filters: [string, string, unknown][] = [];
vi.mock("@/lib/supabaseClient", () => {
  const chain = {
    update: () => chain,
    in: (column: string, value: unknown) => { filters.push(["in", column, value]); return chain; },
    eq: (column: string, value: unknown) => { filters.push(["eq", column, value]); return Promise.resolve({ error: null }); },
  };
  return { supabase: { from: () => chain } };
});
vi.mock("@/portal/event", () => ({ currentEventId: async () => "this-event" }));

import { stageDecision } from "./data";

describe("stageDecision", () => {
  it("only touches applications at the current event", async () => {
    await stageDecision(["a", "b"], "accepted");
    expect(filters).toEqual([["in", "id", ["a", "b"]], ["eq", "event_id", "this-event"]]);
  });
});
