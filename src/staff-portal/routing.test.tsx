import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// sign-in -> /portal -> Supabase says what they applied as -> that portal.
const supabase = vi.hoisted(() => ({
  session: null as null | { user: { id: string; email: string } },
  rows: [] as unknown[],
  rpcError: null as null | { message: string },
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: supabase.session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: async () => {},
    },
    rpc: async () => ({ data: supabase.rows, error: supabase.rpcError }),
    functions: { invoke: async () => ({ data: null, error: null }) },
  },
}));

import { AuthProvider } from "@/context/AuthContext";
import PortalHome from "./StaffGate";
import StaffPortalLayout from "./StaffPortalLayout";
import Dashboard from "./Dashboard";
import Handbook from "./Handbook";
import JudgingPortal from "./JudgingPortal";

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

function renderAt(path: string) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Where />
          <Routes>
            <Route path="/login/mentor" element={<h1>mentor login</h1>} />
            <Route path="/login/judge" element={<h1>judge login</h1>} />
            <Route path="/portal" element={<PortalHome />} />
            {(["mentor", "judge", "hybrid"] as const).map(portal => (
              <Route key={portal} path={`/portal/${portal}`} element={<StaffPortalLayout portal={portal} />}>
                <Route index element={<Dashboard />} />
                <Route path="handbook" element={<Handbook />} />
                {portal !== "mentor" && <Route path="judging" element={<JudgingPortal />} />}
              </Route>
            ))}
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

const signedIn = (type: string, status = "accepted") => {
  supabase.session = { user: { id: "u1", email: "jane@example.com" } };
  supabase.rows = [{ first_name: "Jane", last_name: "Doe", applicant_type: type, status }];
};
const at = () => screen.getByTestId("where").textContent;

beforeEach(() => {
  supabase.session = null;
  supabase.rows = [];
  supabase.rpcError = null;
  localStorage.clear();
});

describe("after sign-in, /portal opens the portal for the application's type", () => {
  it.each([["mentor"], ["judge"], ["hybrid"]])("%s -> /portal/%s", async type => {
    signedIn(type);
    renderAt("/portal");
    await waitFor(() => expect(at()).toBe(`/portal/${type}`));
    expect(await screen.findByText("Hello, Jane Doe!")).toBeInTheDocument();
  });

  it("shows the handbook name and Judging Portal button for each type", async () => {
    signedIn("hybrid");
    renderAt("/portal");
    expect(await screen.findByText("Mentor & Judge Handbook")).toBeInTheDocument();
    expect(screen.getByText("Judging Portal")).toBeInTheDocument();
  });

  it("mentors get no Judging Portal button", async () => {
    signedIn("mentor");
    renderAt("/portal");
    expect(await screen.findByText("Mentor Handbook")).toBeInTheDocument();
    expect(screen.queryByText("Judging Portal")).not.toBeInTheDocument();
  });

  it("judges get the Judge Handbook and Judging Portal", async () => {
    signedIn("judge");
    renderAt("/portal");
    expect(await screen.findByText("Judge Handbook")).toBeInTheDocument();
    expect(screen.getByText("Judging Portal")).toBeInTheDocument();
  });
});

describe("the status comes from the application", () => {
  it.each([
    ["accepted", "Application accepted"],
    ["rejected", "Application rejected"],
    ["pending", "Application pending"],
    ["submitted", "Application pending"],
  ])("%s -> %s", async (status, label) => {
    signedIn("mentor", status);
    renderAt("/portal/mentor");
    expect(await screen.findByText(label)).toBeInTheDocument();
  });

  it("hides the waiver unless accepted", async () => {
    signedIn("mentor", "pending");
    renderAt("/portal/mentor");
    await screen.findByText("Hello, Jane Doe!");
    expect(screen.queryByText("Liability Waiver")).not.toBeInTheDocument();
  });
});

describe("people on the wrong portal are moved to their own", () => {
  it("mentor opening /portal/judge", async () => {
    signedIn("mentor");
    renderAt("/portal/judge");
    await waitFor(() => expect(at()).toBe("/portal/mentor"));
  });

  it("mentor opening the judging page", async () => {
    signedIn("mentor");
    renderAt("/portal/judge/judging");
    await waitFor(() => expect(at()).toBe("/portal/mentor"));
  });

  it("judge opening /portal/mentor/handbook keeps the page", async () => {
    signedIn("judge");
    renderAt("/portal/mentor/handbook");
    await waitFor(() => expect(at()).toBe("/portal/judge/handbook"));
  });

  it("hybrid opening /portal/judge/judging keeps the judging page", async () => {
    signedIn("hybrid");
    renderAt("/portal/judge/judging");
    await waitFor(() => expect(at()).toBe("/portal/hybrid/judging"));
  });
});

describe("people who can't open a portal", () => {
  it("signed out -> login", async () => {
    renderAt("/portal");
    await waitFor(() => expect(at()).toBe("/login/mentor"));
  });

  it("signed out on the judge portal -> judge login", async () => {
    renderAt("/portal/judge");
    await waitFor(() => expect(at()).toBe("/login/judge"));
  });

  it("no application for their email", async () => {
    signedIn("mentor");
    supabase.rows = [];
    renderAt("/portal");
    expect(await screen.findByText("No application found")).toBeInTheDocument();
    expect(at()).toBe("/portal");
  });

  it("a hacker row is not a portal", async () => {
    signedIn("hacker");
    renderAt("/portal");
    expect(await screen.findByText("No application found")).toBeInTheDocument();
  });

  it("Supabase error", async () => {
    signedIn("mentor");
    supabase.rpcError = { message: "boom" };
    renderAt("/portal");
    expect(await screen.findByText("We couldn't load your portal")).toBeInTheDocument();
  });
});
