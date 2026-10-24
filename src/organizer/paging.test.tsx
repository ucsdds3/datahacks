import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// A fake Supabase client: every query chain is recorded, and `tables` answers
// it the way PostgREST would, including slicing by .range() like max_rows.
type Call = {
  table: string;
  select?: string;
  eq: [string, unknown][];
  order: string[];
  range?: [number, number];
  in?: [string, unknown[]];
  update?: unknown;
  single?: boolean;
};
const fake = vi.hoisted(() => ({
  calls: [] as Call[],
  tables: {} as Record<string, unknown[]>,
  rpc: { data: [] as unknown[], error: null as unknown },
}));

vi.mock("@/lib/supabaseClient", () => {
  const MAX_ROWS = 1000;
  const answer = (call: Call) => {
    const rows = (fake.tables[call.table] ?? []).filter(row =>
      call.eq.every(([column, value]) => (row as Record<string, unknown>)[column] === value));
    if (call.update !== undefined) return { data: null, error: null };
    if (call.single) return { data: rows[0] ?? null, error: null };
    const [from, to] = call.range ?? [0, rows.length - 1];
    return { data: rows.slice(from, Math.min(to + 1, from + MAX_ROWS)), error: null };
  };
  const chain = (table: string) => {
    const call: Call = { table, eq: [], order: [] };
    const builder = {
      select: (columns: string) => { call.select = columns; return builder; },
      update: (value: unknown) => { call.update = value; return builder; },
      eq: (column: string, value: unknown) => { call.eq.push([column, value]); return builder; },
      in: (column: string, values: unknown[]) => { call.in = [column, values]; return builder; },
      order: (column: string) => { call.order.push(column); return builder; },
      range: (from: number, to: number) => { call.range = [from, to]; return builder; },
      maybeSingle: () => { call.single = true; return builder; },
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
        fake.calls.push(call);
        return Promise.resolve(answer(call)).then(resolve, reject);
      },
    };
    return builder;
  };
  return { supabase: { from: chain, rpc: async () => fake.rpc } };
});
vi.mock("@/portal/event", () => ({ currentEventId: async () => "event-1" }));

import ApplicationDetail from "./ApplicationDetail";
import { PAGE_SIZE, STAGE_CHUNK, fetchAllPages, fetchApplicationRows, releaseDecisions, stageDecision } from "./data";
import { LIST_FIELDS, type Row } from "./types";

const id = (n: number) => `app-${String(n).padStart(5, "0")}`;
const application = (n: number, extra: Record<string, unknown> = {}) => ({
  id: id(n), event_id: "event-1", applicant_type: "hacker", status: "submitted",
  submitted_at: new Date(Date.UTC(2026, 10, 1) + n * 60_000).toISOString(),
  first_name: `Person${n}`, last_name: "Test", email: `p${n}@example.edu`, phone: null,
  school: "UC San Diego", level_of_study: null, organization: null,
  decision: null, decision_released_at: null, decision_emailed_at: null,
  essay_proudest_project: "A long essay. ".repeat(50), ...extra,
});

beforeEach(() => {
  fake.calls.length = 0;
  fake.tables = {};
  fake.rpc = { data: [], error: null };
});

describe("fetchAllPages", () => {
  it("keeps asking until a short page: 1,000 + 1,000 + 237 rows", async () => {
    const all = Array.from({ length: 2237 }, (_, i) => i);
    const asked: [number, number][] = [];
    const rows = await fetchAllPages(async (from, to) => {
      asked.push([from, to]);
      return { data: all.slice(from, Math.min(to + 1, from + 1000)), error: null };
    });
    expect(rows).toHaveLength(2237);
    expect(rows).toEqual(all);
    expect(asked).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("asks once more after an exactly full page, and stops on the empty one", async () => {
    const asked: number[] = [];
    const rows = await fetchAllPages(async from => {
      asked.push(from);
      return { data: from === 0 ? Array.from({ length: PAGE_SIZE }, (_, i) => i) : [], error: null };
    });
    expect(rows).toHaveLength(PAGE_SIZE);
    expect(asked).toEqual([0, 1000]);
  });

  it("fails instead of returning part of the list", async () => {
    let page = 0;
    const error = { message: "boom" };
    await expect(fetchAllPages(async () => (page++ === 0
      ? { data: Array.from({ length: PAGE_SIZE }, (_, i) => i), error: null }
      : { data: null, error }))).rejects.toBe(error);
  });
});

describe("fetchApplicationRows", () => {
  it("loads all 2,237 applications at the event, without essays, with roster codes", async () => {
    fake.tables.applications = [
      ...Array.from({ length: 2237 }, (_, i) => application(i)),
      application(9999, { id: "other-event", event_id: "event-2" }),
    ];
    fake.tables.attendees = Array.from({ length: 1200 }, (_, i) => ({
      event_id: "event-1", application_id: id(i), code: `DH-${i}`, checked_in_at: i === 5 ? "2026-11-20T00:00:00Z" : null, emailed_at: null,
    }));

    const rows = await fetchApplicationRows("event-1");

    expect(rows).toHaveLength(2237);
    expect(new Set(rows.map(r => r.id)).size).toBe(2237);
    expect(rows.some(r => r.id === "other-event")).toBe(false);
    expect(rows[5]).toMatchObject({ id: id(5), code: "DH-5", checkedIn: true });
    expect(rows[1500]).toMatchObject({ code: null, checkedIn: false });

    const appCalls = fake.calls.filter(c => c.table === "applications");
    expect(appCalls.map(c => c.range)).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    expect(appCalls[0].order).toEqual(["created_at", "id"]);
    expect(appCalls[0].select).not.toMatch(/essay|bio|gender/);
    expect(fake.calls.filter(c => c.table === "attendees").map(c => c.range)).toEqual([[0, 999], [1000, 1999]]);
  });

  it("puts the earliest submissions first and drafts last", async () => {
    fake.tables.applications = [
      application(1, { submitted_at: null }),
      application(2, { submitted_at: "2026-11-03T00:00:00Z" }),
      application(3, { submitted_at: "2026-11-01T00:00:00Z" }),
    ];
    expect((await fetchApplicationRows("event-1")).map(r => r.id)).toEqual([id(3), id(2), id(1)]);
  });
});

describe("stageDecision", () => {
  it("splits a big selection so no request URL gets too long", async () => {
    const ids = Array.from({ length: 250 }, (_, i) => id(i));
    await stageDecision(ids, "accepted");
    const updates = fake.calls.filter(c => c.update !== undefined);
    expect(updates.map(c => c.in![1].length)).toEqual([STAGE_CHUNK, STAGE_CHUNK, 50]);
    expect(updates.flatMap(c => c.in![1])).toEqual(ids);
    expect(updates.every(c => c.eq.some(([column, value]) => column === "event_id" && value === "event-1"))).toBe(true);
  });
});

describe("releaseDecisions", () => {
  const released = (n: number) => ({ application_id: id(n), email: `p${n}@example.edu`, first_name: `Person${n}`, applicant_type: "hacker", status: "accepted" });

  it("finds everyone released when the reply is cut off at 1,000 rows", async () => {
    // 1,200 were released; the reply only lists the first 1,000. #1500 was already unsent before.
    fake.rpc = { data: Array.from({ length: 1000 }, (_, i) => released(i)), error: null };
    const releasedApp = (n: number) => application(n, { status: "accepted", decision: "accepted", decision_released_at: "2026-12-01T00:00:00Z" });
    fake.tables.applications = [...Array.from({ length: 1200 }, (_, i) => releasedApp(i)), releasedApp(1500), application(1600)];

    const result = await releaseDecisions("event-1", [id(1500)]);

    expect(result).toHaveLength(1200);
    expect(new Set(result.map(r => r.application_id)).size).toBe(1200);
    expect(result.some(r => r.application_id === id(1500) || r.application_id === id(1600))).toBe(false);
  });

  it("trusts a reply under 1,000 rows without reloading", async () => {
    fake.rpc = { data: [released(1), released(2)], error: null };
    expect(await releaseDecisions("event-1")).toHaveLength(2);
    expect(fake.calls).toEqual([]);
  });
});

describe("ApplicationDetail", () => {
  it("loads the whole application by id when it's opened", async () => {
    const full = application(7, {
      major: "Cognitive Science", essay_proudest_project: "A model that predicts shuttle delays.",
      essay_goal: "Ship something end to end.", heard_about: ["Instagram"],
    });
    fake.tables.applications = [full, application(8)];
    // What the table hands the drawer: the list columns only.
    const listOnly = Object.fromEntries(LIST_FIELDS.map(f => [f, (full as Record<string, unknown>)[f] ?? null]));
    const row = { ...listOnly, code: null, checkedIn: false, passSentAt: null } as unknown as Row;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <ApplicationDetail row={row} onClose={() => {}} onChanged={() => {}} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("A model that predicts shuttle delays.")).toBeInTheDocument();
    expect(screen.getByText("Cognitive Science")).toBeInTheDocument();
    expect(screen.getByText("Ship something end to end.")).toBeInTheDocument();
    const detail = fake.calls.find(c => c.table === "applications" && c.single)!;
    expect(detail.eq).toEqual([["id", id(7)], ["event_id", "event-1"]]);
    expect(detail.select).toMatch(/essay_proudest_project/);
    await waitFor(() => expect(screen.queryByText(/Loading the application/)).not.toBeInTheDocument());
  });
});
