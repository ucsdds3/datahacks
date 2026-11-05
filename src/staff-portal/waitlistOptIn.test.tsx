import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// The waitlist "email me if a spot opens" switch on a waitlisted hacker's dashboard.
const fake = vi.hoisted(() => ({
  optInAt: null as string | null,
  selectError: null as unknown,
  rpcCalls: [] as { name: string; args: Record<string, unknown> }[],
  rpcError: null as unknown,
  eq: [] as [string, unknown][],
  session: null as unknown,
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: fake.session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => {
      const builder = {
        select: () => builder,
        eq: (c: string, v: unknown) => { fake.eq.push([c, v]); return builder; },
        maybeSingle: async () => ({ data: fake.selectError ? null : { waitlist_opt_in_at: fake.optInAt }, error: fake.selectError }),
      };
      return builder;
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      fake.rpcCalls.push({ name, args });
      if (fake.rpcError) return { data: null, error: fake.rpcError };
      fake.optInAt = args.p_opt_in ? "2027-01-10T00:00:00Z" : null;
      return { data: fake.optInAt, error: null };
    },
  },
}));
vi.mock("@/portal/event", async importOriginal => ({ ...(await importOriginal<object>()), currentEventId: async () => "event-1" }));
vi.mock("@/context/AuthContext", async importOriginal => ({
  ...(await importOriginal<object>()),
  useAuth: () => ({ session: fake.session, loading: false }),
}));

import WaitlistOptIn from "./WaitlistOptIn";
import StaffPortalLayout from "./StaffPortalLayout";
import Dashboard from "./Dashboard";

const wrap = (ui: React.ReactNode) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

beforeEach(() => {
  fake.optInAt = null;
  fake.selectError = null;
  fake.rpcCalls.length = 0;
  fake.rpcError = null;
  fake.eq.length = 0;
  fake.session = { user: { id: "user-1", email: "h@example.edu" } };
});

describe("WaitlistOptIn", () => {
  it("reads the applicant's own hacker application and saves the switch through the RPC", async () => {
    wrap(<WaitlistOptIn />);
    const toggle = await screen.findByRole("switch", { name: "Email me if a spot opens" });
    expect(screen.getByText("Want a spot if one opens on the day?")).toBeTruthy();
    expect(screen.getByText("We'll email you if there's room after check-in closes.")).toBeTruthy();
    expect(fake.eq).toEqual([["user_id", "user-1"], ["event_id", "event-1"], ["applicant_type", "hacker"]]);
    expect((toggle as HTMLInputElement).checked).toBe(false);

    fireEvent.click(toggle);
    await screen.findByText(/You're on the list/);
    expect(fake.rpcCalls).toEqual([{ name: "set_waitlist_opt_in", args: { p_event_id: "event-1", p_opt_in: true } }]);
    expect((screen.getByRole("switch") as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(screen.queryByText(/You're on the list/)).toBeNull());
    expect(fake.rpcCalls[1].args).toEqual({ p_event_id: "event-1", p_opt_in: false });
  });

  it("shows it's already on", async () => {
    fake.optInAt = "2027-01-09T00:00:00Z";
    wrap(<WaitlistOptIn />);
    expect(((await screen.findByRole("switch")) as HTMLInputElement).checked).toBe(true);
  });

  it("says when saving fails", async () => {
    fake.rpcError = new Error("Only waitlisted applications can ask for a spot on the day.");
    wrap(<WaitlistOptIn />);
    fireEvent.click(await screen.findByRole("switch"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only waitlisted applications");
  });

  it("stays hidden if it can't load (say, before the database has the column)", async () => {
    fake.selectError = new Error("column applications.waitlist_opt_in_at does not exist");
    const { container } = wrap(<WaitlistOptIn />);
    await new Promise(r => setTimeout(r, 20));
    expect(container.textContent).toBe("");
  });
});

describe("dashboard", () => {
  const dashboard = (portal: "hacker" | "mentor", status: string) =>
    wrap(
      <MemoryRouter initialEntries={[`/portal/${portal}?preview&status=${status}`]}>
        <Routes>
          <Route path={`/portal/${portal}`} element={<StaffPortalLayout portal={portal} />}>
            <Route index element={<Dashboard />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

  it("asks waitlisted hackers", async () => {
    dashboard("hacker", "waitlisted");
    expect(await screen.findByRole("switch", { name: "Email me if a spot opens" })).toBeTruthy();
  });

  it("doesn't ask accepted hackers", async () => {
    dashboard("hacker", "accepted");
    await screen.findByText(/Hello/);
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("doesn't ask waitlisted mentors", async () => {
    dashboard("mentor", "waitlisted");
    await screen.findByText(/Hello/);
    expect(screen.queryByRole("switch")).toBeNull();
  });
});
