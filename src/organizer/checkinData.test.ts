import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake Supabase client: a select naming a column the table doesn't have fails like PostgREST's 42703.
const fake = vi.hoisted(() => ({ columns: [] as string[], rows: [] as Record<string, unknown>[], selects: [] as string[] }));

vi.mock("@/lib/supabaseClient", () => {
  const chain = () => {
    let select = "";
    let range: [number, number] = [0, 999];
    const builder = {
      select: (columns: string) => { select = columns; return builder; },
      eq: () => builder,
      order: () => builder,
      range: (from: number, to: number) => { range = [from, to]; return builder; },
      then: (resolve: (value: unknown) => unknown) => {
        fake.selects.push(select);
        const missing = select.split(",").map(c => c.trim()).find(c => !fake.columns.includes(c));
        return Promise.resolve(missing
          ? { data: null, error: { code: "42703", message: `column attendees.${missing} does not exist` } }
          : { data: fake.rows.slice(range[0], range[1] + 1), error: null }).then(resolve);
      },
    };
    return builder;
  };
  return { supabase: { from: chain } };
});

import { fetchCheckinRoster } from "./checkinData";

const BASE = ["id", "application_id", "code", "name", "email", "roles", "checked_in_at", "checked_in_by"];

beforeEach(() => {
  fake.selects.length = 0;
  fake.rows = [{ id: "a", application_id: null, code: "DH-1", name: "A", email: null, roles: ["hacker"], checked_in_at: null, checked_in_by: null }];
});

describe("fetchCheckinRoster", () => {
  it("loads waivers when the column exists", async () => {
    fake.columns = [...BASE, "waiver_signed_at"];
    const roster = await fetchCheckinRoster("event-1");
    expect(roster.hasWaiver).toBe(true);
    expect(fake.selects).toHaveLength(1);
  });

  it("falls back to the roster without waivers before the waivers migration", async () => {
    fake.columns = BASE;
    const roster = await fetchCheckinRoster("event-1");
    expect(roster).toMatchObject({ hasWaiver: false, entries: [{ id: "a" }] });
    expect(fake.selects[0]).toMatch(/waiver_signed_at/);
    expect(fake.selects[1]).not.toMatch(/waiver/);
  });
});
