import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// The organizer console while MLH is on: the "MLH consent" column and filter,
// the agreements in the CSV, and the MLH export (docs/mlh.md).
const csv = vi.hoisted(() => ({ files: [] as { name: string; rows: unknown[][] }[] }));
const fetched = vi.hoisted(() => ({ eventIds: [] as string[], apps: [] as unknown[] }));
vi.mock("./csv", async importOriginal => ({
  ...(await importOriginal<object>()),
  downloadCsv: (name: string, rows: unknown[][]) => csv.files.push({ name, rows }),
}));
vi.mock("./data", async importOriginal => ({
  ...(await importOriginal<object>()),
  fetchMlhExport: async (eventId: string) => { fetched.eventIds.push(eventId); return fetched.apps; },
}));
vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }));
vi.mock("@/portal/event", () => ({ currentEventId: async () => "event-1" }));

import ApplicationsTable from "./ApplicationsTable";
import { MLH_EXPORT_HEADER, MLH_LEVEL_OF_STUDY, ageOn, mlhExportRows, type MlhExportApp } from "./mlhExport";
import { LEVELS_OF_STUDY } from "@/staff-portal/formOptions";
import type { Row } from "./types";

const AGREED = { codeOfConductAt: "2027-01-02T10:00:00Z", dataSharingAt: "2027-01-02T10:00:01Z", emailsOptIn: true };
const NOT_YET = { codeOfConductAt: null, dataSharingAt: null, emailsOptIn: false };
const row = (id: string, mlh: Row["mlh"], extra: Partial<Row> = {}) =>
  ({ id, status: "submitted", decision: null, code: null, first_name: id, last_name: "Test", email: `${id}@example.edu`, phone: null,
     school: "UC San Diego", level_of_study: null, organization: null, applicant_type: "hacker", checkedIn: false, submitted_at: null, mlh, ...extra }) as unknown as Row;
const app = (id: string, extra: Partial<MlhExportApp> = {}): MlhExportApp => ({
  id, first_name: id, last_name: "Test", email: `${id}@example.edu`, phone: "(858) 555-0100", school: "University of California, San Diego",
  level_of_study: "Undergraduate (3+ year: bachelor's)", country_of_residence: "United States", birthdate: "2005-01-17",
  mlh_code_of_conduct_at: AGREED.codeOfConductAt, mlh_data_sharing_at: AGREED.dataSharingAt, mlh_emails_opt_in: true, ...extra,
});

const rows = [row("ada", AGREED), row("bea", NOT_YET), row("cy", undefined)];

beforeEach(() => {
  csv.files.length = 0;
  fetched.eventIds.length = 0;
  fetched.apps = [];
});

describe("the hackers table", () => {
  it("MLH off: no MLH column, filter, CSV fields or export", () => {
    render(<ApplicationsTable kind="hacker" rows={rows} onChanged={() => {}} />);
    expect(screen.queryByRole("columnheader", { name: "MLH consent" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "MLH consent" })).toBeNull();
    expect(screen.queryByRole("button", { name: /MLH export/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /CSV/ }));
    expect(csv.files[0].rows[0]).not.toContain("MLH emails opt-in");
  });

  it("MLH on: a column saying who agreed, and a filter", () => {
    render(<ApplicationsTable kind="hacker" rows={rows} onChanged={() => {}} mlhOn eventId="event-1" />);
    const headers = screen.getAllByRole("columnheader").map(h => h.textContent);
    expect(headers.indexOf("MLH consent")).toBe(headers.indexOf("Batch") - 1);
    const cells = screen.getAllByRole("cell").map(c => c.textContent);
    expect(cells.filter(t => t === "Agreed")).toHaveLength(1);
    expect(cells.filter(t => t === "Not yet")).toHaveLength(2);

    const filter = screen.getByRole("combobox", { name: "MLH consent" });
    fireEvent.change(filter, { target: { value: "agreed" } });
    expect(screen.queryByText("bea")).toBeNull();
    expect(screen.getByText("ada Test")).toBeTruthy();
    fireEvent.change(filter, { target: { value: "not-yet" } });
    expect(screen.queryByText("ada Test")).toBeNull();
    expect(screen.getByText("bea Test")).toBeTruthy();
    expect(screen.getByText("cy Test")).toBeTruthy();
  });

  it("MLH on: the CSV has the agreements", () => {
    render(<ApplicationsTable kind="hacker" rows={rows} onChanged={() => {}} mlhOn eventId="event-1" />);
    fireEvent.click(screen.getByRole("button", { name: /^CSV/ }));
    const [header, ada, bea] = csv.files[0].rows as string[][];
    const col = (name: string) => header.indexOf(name);
    expect(ada[col("MLH consent")]).toBe("Agreed");
    expect(ada[col("MLH Code of Conduct (agreed at)")]).toBe(AGREED.codeOfConductAt);
    expect(ada[col("MLH data sharing (agreed at)")]).toBe(AGREED.dataSharingAt);
    expect(ada[col("MLH emails opt-in")]).toBe("Yes");
    expect(bea[col("MLH consent")]).toBe("Not yet");
    expect(bea[col("MLH emails opt-in")]).toBe("No");
  });

  it("the hackers CSV has their suggested food and activity (blank for older applications); the mentor/judge CSV doesn't", () => {
    const withIdeas = [row("ada", undefined, { suggested_food: "Boba", suggested_activity: "=5K" }), row("bea", undefined)];
    render(<ApplicationsTable kind="hacker" rows={withIdeas} onChanged={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /^CSV/ }));
    const [header, ada, bea] = csv.files[0].rows as string[][];
    expect(ada[header.indexOf("Suggested food")]).toBe("Boba");
    expect(ada[header.indexOf("Suggested activity")]).toBe("=5K"); // csvCell guards formulas when the file is written
    expect(bea[header.indexOf("Suggested food")]).toBe("");
    cleanup();
    render(<ApplicationsTable kind="staff" rows={withIdeas.map(r => ({ ...r, applicant_type: "mentor" }))} onChanged={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /^CSV/ }));
    expect(csv.files[1].rows[0]).not.toContain("Suggested food");
  });

  it("the mentor/judge table never gets MLH's columns", () => {
    render(<ApplicationsTable kind="staff" rows={rows.map(r => ({ ...r, applicant_type: "mentor" }))} onChanged={() => {}} mlhOn eventId="event-1" />);
    expect(screen.queryByRole("columnheader", { name: "MLH consent" })).toBeNull();
    expect(screen.queryByRole("button", { name: /MLH export/ })).toBeNull();
  });

  it("the MLH export has only the people in the list who agreed to share their data", async () => {
    fetched.apps = [app("ada"), app("zed")];
    render(<ApplicationsTable kind="hacker" rows={rows} onChanged={() => {}} mlhOn eventId="event-1" />);
    fireEvent.click(screen.getByRole("button", { name: /MLH export/ }));
    await waitFor(() => expect(csv.files).toHaveLength(1));
    expect(fetched.eventIds).toEqual(["event-1"]);
    expect(csv.files[0].name).toMatch(/^dh-mlh-hackers-applied-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv.files[0].rows).toHaveLength(2);
    expect(csv.files[0].rows[1][0]).toBe("ada");
  });

  it("says so when nobody in the list agreed", async () => {
    render(<ApplicationsTable kind="hacker" rows={rows} onChanged={() => {}} mlhOn eventId="event-1" />);
    fireEvent.click(screen.getByRole("button", { name: /MLH export/ }));
    expect(await screen.findByText(/Nobody in this list has agreed to share their data with MLH/)).toBeTruthy();
    expect(csv.files).toHaveLength(0);
  });
});

describe("the MLH export's rows", () => {
  const on = new Date("2027-01-16T12:00:00-08:00");

  it("has MLH's required fields, in MLH's words", () => {
    const out = mlhExportRows([app("ada")], [row("ada", AGREED, { status: "accepted", checkedIn: true })], on);
    expect(out[0]).toEqual(MLH_EXPORT_HEADER);
    expect(out[1]).toEqual([
      "ada", "Test", "ada@example.edu", "(858) 555-0100", 21, "University of California, San Diego", "Undergraduate University (3+ year)",
      "United States", AGREED.codeOfConductAt, AGREED.dataSharingAt, "Yes", "Accepted", "Yes",
    ]);
  });

  it("leaves out anyone who didn't agree, drafts, and people not in the list", () => {
    const apps = [app("ada"), app("bea", { mlh_data_sharing_at: null }), app("dee"), app("eve")];
    const list = [row("ada", AGREED), row("bea", NOT_YET), row("dee", AGREED, { status: "draft" })];
    expect(mlhExportRows(apps, list, on).slice(1).map(r => r[0])).toEqual(["ada"]);
  });

  it("works out age on the first day of the event (Pacific)", () => {
    expect(ageOn("2005-01-16", on)).toBe(22);
    expect(ageOn("2005-01-17", on)).toBe(21);
    expect(ageOn("2009-01-16", on)).toBe(18);
    expect(ageOn("2009-01-16", new Date("2027-01-16T07:00:00Z"))).toBe(17); // 11 PM on January 15 in San Diego
    expect(ageOn(null, on)).toBeNull();
    expect(ageOn("not a date", on)).toBeNull();
  });

  it("maps every level of study on the form to MLH's wording", () => {
    for (const level of LEVELS_OF_STUDY) expect(MLH_LEVEL_OF_STUDY[level], level).toBeTruthy();
  });
});
