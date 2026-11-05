import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// A signed-in person (not preview): the waiver flag comes from public.waivers, and
// Submit goes through the docusign-waiver function's status check.
const fake = vi.hoisted(() => ({
  waiver: { data: null as { signed_at: string } | null, error: null as unknown },
  invoke: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ session: { user: { id: "user-1", email: "mentor@example.com", user_metadata: {} } } }),
}));

vi.mock("@/lib/supabaseClient", () => {
  const query = (table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => (table === "events" ? { data: { id: "event-1" }, error: null } : fake.waiver),
    };
    return chain;
  };
  return { supabase: { from: query, functions: { invoke: (...args: unknown[]) => fake.invoke(...args) } } };
});

import { StaffPortalProvider, useStaffPortal, waiverKey } from "./StaffPortalContext";

function Probe() {
  const { waiverSubmitted, submitWaiver } = useStaffPortal();
  return (
    <>
      <p>{waiverSubmitted ? "on file" : "not on file"}</p>
      <button onClick={() => submitWaiver("env-1").catch(e => { document.title = (e as Error).message; })}>Submit</button>
    </>
  );
}

function renderProbe() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StaffPortalProvider application={{ firstName: "M", lastName: "J", type: "mentor", status: "accepted", submittedAt: null }} preview={false}>
        <Probe />
      </StaffPortalProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  document.title = "";
  fake.waiver = { data: null, error: null };
  fake.invoke.mockReset();
});

describe("waiver on file", () => {
  it("reads it from the database", async () => {
    fake.waiver = { data: { signed_at: "2026-11-04T18:00:00Z" }, error: null };
    renderProbe();
    expect(await screen.findByText("on file")).toBeInTheDocument();
    expect(localStorage.getItem(waiverKey("user-1"))).toBe("true");
  });

  it("the database wins over this browser's old flag", async () => {
    localStorage.setItem(waiverKey("user-1"), "true");
    renderProbe();
    await waitFor(() => expect(localStorage.getItem(waiverKey("user-1"))).toBeNull());
    expect(screen.getByText("not on file")).toBeInTheDocument();
  });

  it("falls back to this browser's copy when the database can't be reached", async () => {
    localStorage.setItem(waiverKey("user-1"), "true");
    fake.waiver = { data: null, error: new Error("offline") };
    renderProbe();
    await new Promise(r => setTimeout(r, 20));
    expect(screen.getByText("on file")).toBeInTheDocument();
  });

  it("Submit asks the server, which records it", async () => {
    fake.invoke.mockResolvedValue({ data: { signed: true, status: "completed", recorded: true }, error: null });
    renderProbe();
    expect(await screen.findByText("not on file")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("on file")).toBeInTheDocument();
    expect(fake.invoke).toHaveBeenCalledWith("docusign-waiver", { body: expect.objectContaining({ action: "status", envelopeId: "env-1", eventCode: expect.any(String) }) });
  });

  it("Submit refuses when DocuSign has no signature, or it couldn't be recorded", async () => {
    fake.invoke.mockResolvedValue({ data: { signed: false, status: "sent", recorded: false }, error: null });
    renderProbe();
    fireEvent.click(await screen.findByRole("button", { name: "Submit" }));
    await waitFor(() => expect(document.title).toBe("No signature detected on the waiver yet."));
    expect(screen.getByText("not on file")).toBeInTheDocument();

    fake.invoke.mockResolvedValue({ data: { signed: true, status: "completed", recorded: false }, error: null });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(document.title).toMatch(/couldn't save it/));
    expect(screen.getByText("not on file")).toBeInTheDocument();
    expect(localStorage.getItem(waiverKey("user-1"))).toBeNull();
  });
});
