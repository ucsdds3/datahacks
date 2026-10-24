import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// The apply pages follow the event's "applications open" switch.
const db = vi.hoisted(() => ({
  event: { id: "event-1", applications_open: true, applications_open_at: null as string | null },
  // Only the switch read (select applications_open, ...) fails.
  windowError: null as null | { message: string },
  applications: [] as unknown[],
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "u1", email: "jane@example.com" } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: async () => {},
    },
    from: (table: string) => {
      let columns = "";
      const result = async () =>
        table === "events" ? (db.windowError && columns.includes("applications_open") ? { data: null, error: db.windowError } : { data: db.event, error: null })
        : table === "event_roles" ? { data: [], error: null }
        : { data: db.applications, error: null };
      const query = {
        select: (cols: string) => { columns = cols; return query; }, eq: () => query, in: () => query, order: () => query, limit: result, maybeSingle: result,
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => result().then(resolve, reject),
      };
      return query;
    },
  },
}));

import { AuthProvider } from "@/context/AuthContext";
import { closedTitle } from "@/portal/event";
import { ApplyLayout } from "./Apply";

function renderApply() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/portal/apply/hacker"]}>
          <Routes>
            <Route path="/portal/apply" element={<ApplyLayout />}>
              <Route path="hacker" element={<h1>hacker form</h1>} />
            </Route>
            <Route path="/portal" element={<h1>portal home</h1>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  db.event = { id: "event-1", applications_open: true, applications_open_at: null };
  db.windowError = null;
  db.applications = [];
});

describe("apply pages and the applications-open switch", () => {
  it("shows the form while applications are open", async () => {
    renderApply();
    expect(await screen.findByRole("heading", { name: "hacker form" })).toBeTruthy();
  });

  it("shows the opening date instead of the form while closed", async () => {
    db.event = { id: "event-1", applications_open: false, applications_open_at: "2999-11-03T17:00:00Z" };
    renderApply();
    expect(await screen.findByRole("heading", { name: "Applications open on November 3, 2999" })).toBeTruthy();
    expect(screen.queryByText("hacker form")).toBeNull();
  });

  it("says they aren't open when closed with no date", async () => {
    db.event = { id: "event-1", applications_open: false, applications_open_at: null };
    renderApply();
    expect(await screen.findByRole("heading", { name: "Applications aren't open right now" })).toBeTruthy();
    expect(screen.queryByText("hacker form")).toBeNull();
  });

  it("shows the form if the switch can't be read (the database still enforces it)", async () => {
    db.event = { id: "event-1", applications_open: false, applications_open_at: null };
    db.windowError = { message: "network down" };
    renderApply();
    expect(await screen.findByRole("heading", { name: "hacker form" })).toBeTruthy();
  });

  it("someone who already applied goes to the portal, open or not", async () => {
    db.event = { id: "event-1", applications_open: false, applications_open_at: null };
    db.applications = [{ first_name: "Jane", last_name: "Doe", applicant_type: "hacker", status: "submitted", submitted_at: null }];
    renderApply();
    expect(await screen.findByRole("heading", { name: "portal home" })).toBeTruthy();
  });
});

describe("closedTitle", () => {
  const now = new Date("2026-10-23T12:00:00Z");
  it("names a future date in Pacific time", () => {
    // 07:00 UTC on Nov 4 is still Nov 3 in San Diego.
    expect(closedTitle("2026-11-04T07:00:00Z", now)).toBe("Applications open on November 3, 2026");
  });
  it("past, missing or bad dates just say not open", () => {
    expect(closedTitle("2026-10-01T00:00:00Z", now)).toBe("Applications aren't open right now");
    expect(closedTitle(null, now)).toBe("Applications aren't open right now");
    expect(closedTitle("soon", now)).toBe("Applications aren't open right now");
  });
});
