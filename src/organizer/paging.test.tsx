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
  rpc: { data: [] as unknown, error: null as unknown },
  rpcByFn: {} as Record<string, { data: unknown; error: unknown } | ((args: Record<string, unknown>) => { data: unknown; error: unknown })>,
  rpcCalls: [] as { fn: string; args: Record<string, unknown> }[],
  /** Act like a database from before the waivers migration (no attendees.waiver_signed_at). */
  noWaiverColumn: false,
  /** Act like a database from before the MLH migration (no applications.mlh_* columns). */
  noMlhColumns: false,
}));

vi.mock("@/lib/supabaseClient", () => {
  const MAX_ROWS = 1000;
  const answer = (call: Call) => {
    const rows = (fake.tables[call.table] ?? []).filter(row =>
      call.eq.every(([column, value]) => (row as Record<string, unknown>)[column] === value));
    if (call.update !== undefined) return { data: null, error: null };
    if (fake.noWaiverColumn && call.select?.includes("waiver_signed_at")) {
      return { data: null, error: { code: "42703", message: "column attendees.waiver_signed_at does not exist" } };
    }
    if (fake.noMlhColumns && call.select?.includes("mlh_")) {
      return { data: null, error: { code: "42703", message: "column applications.mlh_data_sharing_at does not exist" } };
    }
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
      not: () => builder,
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
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    fake.rpcCalls.push({ fn, args });
    const answer = fake.rpcByFn[fn];
    return typeof answer === "function" ? answer(args) : answer ?? fake.rpc;
  };
  return { supabase: { from: chain, rpc } };
});
vi.mock("@/portal/event", () => ({ currentEventId: async () => "event-1" }));

import ApplicationDetail from "./ApplicationDetail";
import { PAGE_SIZE, RELEASE_CHUNK, ReleaseError, STAGE_CHUNK, fetchAllPages, fetchApplicationRows, fetchStats, releaseDecisions, stageDecision } from "./data";
import { STATS_FIELDS } from "./stats";
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
  fake.rpcByFn = {};
  fake.rpcCalls.length = 0;
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

    // The list (MLH consent is a read of its own, below).
    const appCalls = fake.calls.filter(c => c.table === "applications" && !c.select?.includes("mlh_"));
    expect(appCalls.map(c => c.range)).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    expect(appCalls[0].order).toEqual(["created_at", "id"]);
    expect(appCalls[0].select).not.toMatch(/essay|bio|gender/);
    expect(fake.calls.filter(c => c.table === "attendees").map(c => c.range)).toEqual([[0, 999], [1000, 1999]]);
  });

  it("adds hackers' MLH consent, and loads without it on a database from before MLH", async () => {
    fake.tables.applications = [
      application(1, { applicant_type: "hacker", mlh_code_of_conduct_at: "2027-01-02T00:00:00Z", mlh_data_sharing_at: "2027-01-02T00:00:00Z", mlh_emails_opt_in: true }),
      application(2, { applicant_type: "hacker", mlh_code_of_conduct_at: null, mlh_data_sharing_at: null, mlh_emails_opt_in: false }),
    ];
    fake.tables.attendees = [];
    const rows = await fetchApplicationRows("event-1");
    expect(rows.map(r => r.mlh)).toEqual([
      { codeOfConductAt: "2027-01-02T00:00:00Z", dataSharingAt: "2027-01-02T00:00:00Z", emailsOptIn: true },
      { codeOfConductAt: null, dataSharingAt: null, emailsOptIn: false },
    ]);
    const mlhCall = fake.calls.find(c => c.table === "applications" && c.select?.includes("mlh_"))!;
    expect(mlhCall.eq).toEqual([["event_id", "event-1"], ["applicant_type", "hacker"]]);

    fake.noMlhColumns = true;
    try {
      const older = await fetchApplicationRows("event-1");
      expect(older).toHaveLength(2);
      expect(older.map(r => r.mlh)).toEqual([undefined, undefined]);
    } finally {
      fake.noMlhColumns = false;
    }
  });

  it("shows who has a waiver on file, and still loads the roster on a database without the column", async () => {
    fake.tables.applications = [application(1), application(2)];
    fake.tables.attendees = [
      { event_id: "event-1", application_id: id(1), code: "DH-1", checked_in_at: null, emailed_at: null, waiver_signed_at: "2026-11-04T18:00:00Z" },
      { event_id: "event-1", application_id: id(2), code: "DH-2", checked_in_at: null, emailed_at: null, waiver_signed_at: null },
    ];
    const rows = await fetchApplicationRows("event-1");
    expect(rows.map(r => r.waiverSignedAt)).toEqual(["2026-11-04T18:00:00Z", null]);

    fake.noWaiverColumn = true;
    fake.tables.attendees = fake.tables.attendees.map(a => { const { waiver_signed_at: _, ...rest } = a as Record<string, unknown>; return rest; });
    fake.calls.length = 0;
    try {
      const older = await fetchApplicationRows("event-1");
      expect(older.map(r => [r.code, r.waiverSignedAt])).toEqual([["DH-1", null], ["DH-2", null]]);
      expect(fake.calls.filter(c => c.table === "attendees").map(c => c.select?.includes("waiver_signed_at"))).toEqual([true, false]);
    } finally {
      fake.noWaiverColumn = false;
    }
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

describe("fetchApplicationRows decisions", () => {
  it("merges in the review columns from staged_decisions (applicants can't read them from the row)", async () => {
    fake.tables.applications = [application(1), application(2)];
    fake.rpcByFn.staged_decisions = {
      data: [{ id: id(2), decision: "accepted", version: 3, decided_by: "tijil@ds3.club", decided_at: "2026-12-04T23:04:00Z" }],
      error: null,
    };
    const rows = await fetchApplicationRows("event-1");
    expect(rows.find(r => r.id === id(1))).toMatchObject({ decision: null, decision_version: 0, decided_by: null });
    expect(rows.find(r => r.id === id(2))).toMatchObject({ decision: "accepted", decision_version: 3, decided_by: "tijil@ds3.club" });
    expect(fake.calls.find(c => c.table === "applications")!.select).not.toMatch(/\bdecision\b,|\bdecision$/);
  });

  it("still loads decisions from a database without staged_decisions yet", async () => {
    fake.tables.applications = [application(1, { decision: "rejected" })];
    fake.rpcByFn.staged_decisions = { data: null, error: { code: "PGRST202", message: "Could not find the function public.staged_decisions" } };
    const rows = await fetchApplicationRows("event-1");
    expect(rows[0]).toMatchObject({ decision: "rejected", decision_version: 0 });
  });
});

describe("stageDecision", () => {
  it("sends big selections in chunks, each with the versions this page loaded", async () => {
    const items = Array.from({ length: 1200 }, (_, i) => ({ id: id(i), decision_version: i % 3 }));
    fake.rpcByFn.stage_decisions = args => ({
      data: { updated: (args.p_ids as string[]).map(x => ({ id: x, version: 1 })), conflicts: [], drafts: [], missing: [] }, error: null,
    });
    const outcome = await stageDecision(items, "accepted");
    const calls = fake.rpcCalls.filter(c => c.fn === "stage_decisions");
    expect(calls.map(c => (c.args.p_ids as string[]).length)).toEqual([STAGE_CHUNK, STAGE_CHUNK, 200]);
    expect(calls.flatMap(c => c.args.p_ids as string[])).toEqual(items.map(i => i.id));
    expect(calls.flatMap(c => c.args.p_versions as number[])).toEqual(items.map(i => i.decision_version));
    expect(calls.every(c => c.args.p_event_id === "event-1" && c.args.p_decision === "accepted")).toBe(true);
    expect(outcome.updated).toHaveLength(1200);
  });
});

describe("releaseDecisions", () => {
  const released = (n: number) => ({ application_id: id(n), email: `p${n}@example.edu`, first_name: `Person${n}`, applicant_type: "hacker", status: "accepted" });

  it("releases exactly the rows shown, by id and version, in chunks under the 1,000-row reply cap", async () => {
    const targets = Array.from({ length: 1200 }, (_, i) => ({ id: id(i), decision_version: 1 }));
    // Someone changed #7 since the dialog opened, so the database leaves it staged.
    fake.rpcByFn.release_decisions = args => ({
      data: (args.p_ids as string[]).filter(x => x !== id(7)).map(x => released(Number(x.slice(4)))), error: null,
    });
    const result = await releaseDecisions("event-1", targets);
    const calls = fake.rpcCalls.filter(c => c.fn === "release_decisions");
    expect(calls.map(c => (c.args.p_ids as string[]).length)).toEqual([RELEASE_CHUNK, RELEASE_CHUNK, 200]);
    expect(calls[0].args.p_versions).toEqual(Array(RELEASE_CHUNK).fill(1));
    expect(result.released).toHaveLength(1199);
    expect(result.notReleased).toEqual([id(7)]);
  });

  it("keeps what was released when a later chunk fails", async () => {
    let n = 0;
    fake.rpcByFn.release_decisions = args => (n++ === 0
      ? { data: (args.p_ids as string[]).map(x => released(Number(x.slice(4)))), error: null }
      : { data: null, error: { message: "canceling statement due to statement timeout", code: "57014" } });
    const targets = Array.from({ length: 600 }, (_, i) => ({ id: id(i), decision_version: 0 }));
    const error = await releaseDecisions("event-1", targets).catch(e => e);
    expect(error).toBeInstanceOf(ReleaseError);
    expect(error.message).toBe("canceling statement due to statement timeout (57014)");
    expect(error.released).toHaveLength(RELEASE_CHUNK);
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

describe("fetchStats", () => {
  it("loads every application at the event a page at a time, only the answers it counts, with decisions and check-ins", async () => {
    fake.tables.applications = [
      ...Array.from({ length: 2237 }, (_, i) => application(i, { major: "Data Science" })),
      application(9999, { id: "other-event", event_id: "event-2" }),
    ];
    fake.tables.attendees = [
      { event_id: "event-1", application_id: id(3), code: "DH-3", checked_in_at: "2027-01-16T12:05:00-08:00", emailed_at: null },
      { event_id: "event-1", application_id: id(4), code: "DH-4", checked_in_at: null, emailed_at: null },
    ];
    fake.rpcByFn.staged_decisions = { data: [{ id: id(3), decision: "accepted", version: 2, decided_at: null, decided_by: null }], error: null };

    const { rows, hasRoster } = await fetchStats("event-1");

    expect(rows).toHaveLength(2237);
    expect(rows.some(r => r.id === "other-event")).toBe(false);
    expect(hasRoster).toBe(true);
    expect(rows[3]).toMatchObject({ id: id(3), decision: "accepted", checkedIn: true });
    expect(rows[4]).toMatchObject({ decision: null, checkedIn: false });

    const appCalls = fake.calls.filter(c => c.table === "applications");
    expect(appCalls.map(c => c.range)).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    expect(appCalls[0].order).toEqual(["created_at", "id"]);
    expect(appCalls[0].eq).toEqual([["event_id", "event-1"]]);
    expect(appCalls[0].select?.split(", ")).toEqual([...STATS_FIELDS]);
    expect(appCalls[0].select).not.toMatch(/email|first_name|last_name|phone|essay|decision/);
  });
});
