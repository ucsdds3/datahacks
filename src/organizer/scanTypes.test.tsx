import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// A fake scan_types table: select answers from `fake.rows` (or `fake.selectError`),
// insert/update are recorded and applied, like PostgREST would.
const fake = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  selectError: null as null | { code: string; message: string },
  writeError: null as null | { code: string; message: string },
  inserts: [] as Record<string, unknown>[],
  updates: [] as { value: Record<string, unknown>; eq: [string, unknown][] }[],
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: () => {
      let mode: "select" | "insert" | "update" = "select";
      let value: Record<string, unknown> = {};
      const eq: [string, unknown][] = [];
      const builder = {
        select: () => builder,
        order: () => builder,
        eq: (c: string, v: unknown) => { eq.push([c, v]); return builder; },
        insert: (v: Record<string, unknown>) => { mode = "insert"; value = v; return builder; },
        update: (v: Record<string, unknown>) => { mode = "update"; value = v; return builder; },
        then: (resolve: (v: unknown) => unknown) => {
          if (mode === "select") {
            return Promise.resolve(fake.selectError ? { data: null, error: fake.selectError } : { data: fake.rows.map(r => ({ ...r })), error: null }).then(resolve);
          }
          if (fake.writeError) return Promise.resolve({ data: null, error: fake.writeError }).then(resolve);
          if (mode === "insert") {
            fake.inserts.push(value);
            fake.rows.push({ id: `new-${fake.rows.length}`, opens_at: null, closes_at: null, ...value });
          } else {
            fake.updates.push({ value, eq });
            const id = eq.find(([c]) => c === "id")?.[1];
            const row = fake.rows.find(r => r.id === id);
            if (row) Object.assign(row, value);
          }
          return Promise.resolve({ data: null, error: null }).then(resolve);
        },
      };
      return builder;
    },
  },
}));

import ScanTypesCard from "./ScanTypesCard";
import { fetchScanTypes, isMissingTable, labelProblem, nextSort, reorder, windowProblem, type ScanType } from "./scanTypes";

const type = (id: string, label: string, sort: number, extra: Partial<ScanType> = {}): ScanType => ({
  id, event_id: "event-1", label, kind: "meal", active: true, sort, opens_at: null, closes_at: null, ...extra,
});

beforeEach(() => {
  fake.rows = [];
  fake.selectError = null;
  fake.writeError = null;
  fake.inserts.length = 0;
  fake.updates.length = 0;
});

describe("scan type rules", () => {
  it("needs a name that's unique in the event, ignoring case and outer spaces", () => {
    const types = [type("a", "Lunch · Sat", 10), type("b", "T-shirt", 20)];
    expect(labelProblem("   ", types)).toMatch(/Give it a name/);
    expect(labelProblem(" lunch · sat ", types)).toMatch(/already one/);
    expect(labelProblem("Lunch · Sat", types, "a")).toBeNull();
    expect(labelProblem("x".repeat(61), types)).toMatch(/under 60/);
    expect(labelProblem("Dinner\tSat", types)).toMatch(/One line/);
    expect(labelProblem("Dinner · Sat", types)).toBeNull();
  });

  it("wants a window that closes after it opens (either end optional)", () => {
    expect(windowProblem("2027-01-16T20:00:00Z", "2027-01-16T19:00:00Z")).toMatch(/close after/);
    expect(windowProblem("2027-01-16T20:00:00Z", "2027-01-16T20:00:00Z")).toMatch(/close after/);
    expect(windowProblem("2027-01-16T19:00:00Z", null)).toBeNull();
    expect(windowProblem(null, null)).toBeNull();
  });

  it("moves a type up or down by renumbering, even when sorts are equal", () => {
    const types = [type("a", "Breakfast", 0), type("b", "Lunch", 0), type("c", "Dinner", 0)];
    // Desk order is sort then label: Breakfast, Dinner, Lunch.
    expect(reorder(types, "b", -1)).toEqual([{ id: "a", sort: 10 }, { id: "b", sort: 20 }, { id: "c", sort: 30 }]);
    const spaced = [type("a", "A", 10), type("b", "B", 20), type("c", "C", 30)];
    expect(reorder(spaced, "c", -1)).toEqual([{ id: "c", sort: 20 }, { id: "b", sort: 30 }]);
    expect(reorder(spaced, "a", -1)).toEqual([]);
    expect(reorder(spaced, "c", 1)).toEqual([]);
    expect(nextSort(spaced)).toBe(40);
    expect(nextSort([])).toBe(10);
  });

  it("knows a database without scan types yet", async () => {
    expect(isMissingTable({ code: "PGRST205", message: "Could not find the table 'public.scan_types' in the schema cache" })).toBe(true);
    expect(isMissingTable({ code: "42P01", message: 'relation "scan_types" does not exist' })).toBe(true);
    expect(isMissingTable({ code: "42501", message: "permission denied" })).toBe(false);
    fake.selectError = { code: "PGRST205", message: "Could not find the table" };
    expect(await fetchScanTypes("event-1")).toBeNull();
    fake.selectError = { code: "42501", message: "permission denied" };
    await expect(fetchScanTypes("event-1")).rejects.toMatchObject({ code: "42501" });
  });
});

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ScanTypesCard eventId="event-1" /></QueryClientProvider>);
}

describe("Meals & swag card", () => {
  it("isn't shown on a database without scan types", async () => {
    fake.selectError = { code: "PGRST205", message: "Could not find the table" };
    const { container } = renderCard();
    await waitFor(() => expect(container.innerHTML).toBe(""));
  });

  it("adds a type after the last one", async () => {
    fake.rows = [type("a", "Lunch · Sat", 10)];
    renderCard();
    fireEvent.change(await screen.findByPlaceholderText("Lunch · Sat"), { target: { value: "  T-shirt " } });
    fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "swag" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await screen.findByText("Added T-shirt.");
    expect(fake.inserts).toEqual([{ event_id: "event-1", label: "T-shirt", kind: "swag", sort: 20, active: true }]);
    expect(await screen.findByRole("form", { name: "T-shirt" })).toBeTruthy();
  });

  it("refuses a duplicate name before sending it, and words the database's refusal", async () => {
    fake.rows = [type("a", "Lunch · Sat", 10)];
    renderCard();
    fireEvent.change(await screen.findByPlaceholderText("Lunch · Sat"), { target: { value: "LUNCH · SAT" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/already one/);
    expect(fake.inserts).toHaveLength(0);

    // Another organizer added it a moment ago: the unique index says no.
    fake.writeError = { code: "23505", message: "duplicate key value violates unique constraint" };
    fireEvent.change(screen.getByPlaceholderText("Lunch · Sat"), { target: { value: "Dinner · Sat" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect((await screen.findByRole("status")).textContent).toBe("There's already one with that name.");
  });

  it("renames and sets a window (Pacific), switches off, and reorders", async () => {
    fake.rows = [type("a", "Lunch · Sat", 10), type("b", "T-shirt", 20, { kind: "swag" })];
    renderCard();
    const lunch = await screen.findByRole("form", { name: "Lunch · Sat" });
    const save = within(lunch).getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(within(lunch).getByLabelText("Name of Lunch · Sat"), { target: { value: "Lunch · Saturday" } });
    fireEvent.change(within(lunch).getByLabelText(/Lunch · Sat opens/), { target: { value: "2027-01-16T11:30" } });
    fireEvent.change(within(lunch).getByLabelText(/Lunch · Sat closes/), { target: { value: "2027-01-16T11:00" } });
    expect(within(lunch).getByRole("alert").textContent).toMatch(/close after/);
    expect(save.disabled).toBe(true);
    fireEvent.change(within(lunch).getByLabelText(/Lunch · Sat closes/), { target: { value: "2027-01-16T13:30" } });
    fireEvent.click(save);
    await screen.findByText("Saved Lunch · Saturday.");
    expect(fake.updates[0]).toEqual({
      value: { label: "Lunch · Saturday", kind: "meal", opens_at: "2027-01-16T19:30:00.000Z", closes_at: "2027-01-16T21:30:00.000Z" },
      eq: [["id", "a"], ["event_id", "event-1"]],
    });

    const shirt = await screen.findByRole("form", { name: "T-shirt" });
    fireEvent.click(within(shirt).getByRole("checkbox"));
    await screen.findByText(/T-shirt is off at the desk/);
    expect(fake.updates[1].value).toEqual({ active: false });

    fireEvent.click(within(await screen.findByRole("form", { name: "T-shirt" })).getByRole("button", { name: "Move T-shirt up" }));
    await screen.findByText("Moved T-shirt up.");
    expect(fake.updates.slice(2).map(u => [u.eq[0][1], u.value.sort]).sort()).toEqual([["a", 20], ["b", 10]]);
    await waitFor(() => expect(screen.getAllByRole("form").map(f => f.getAttribute("aria-label"))).toEqual(["T-shirt", "Lunch · Saturday"]));
  });
});
