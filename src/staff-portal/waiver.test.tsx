import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Waiver page in dev ?preview mode, with the simulated DocuSign.
vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    functions: { invoke: async () => ({ data: null, error: null }) },
  },
}));

import { AuthProvider } from "@/context/AuthContext";
import StaffPortalLayout from "./StaffPortalLayout";
import Dashboard from "./Dashboard";
import Waiver from "./Waiver";

function renderWaiver() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/portal/mentor/waiver?preview"]}>
          <Routes>
            <Route path="/portal/mentor" element={<StaffPortalLayout portal="mentor" />}>
              <Route index element={<Dashboard />} />
              <Route path="waiver" element={<Waiver />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

const submit = () => screen.getByRole("button", { name: "Submit waiver" });

beforeEach(() => localStorage.clear());

describe("simulated waiver signing", () => {
  it("only lets them submit once a signature is detected", async () => {
    renderWaiver();
    expect(await screen.findByText("Incomplete")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /Start signing/ }));
    expect(submit()).toBeDisabled();

    // Can't finish before adopting a signature, like DocuSign's required Sign Here tab.
    expect(screen.getByRole("button", { name: "Finish" })).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("Type your full name"), { target: { value: "Jane Doe" } });
    fireEvent.click(screen.getByRole("button", { name: "Adopt and sign" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));

    expect(await screen.findByText("Signature detected")).toBeInTheDocument();
    expect(submit()).toBeEnabled();
    fireEvent.click(submit());
    expect(await screen.findByText("Waiver submitted")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.queryByText("Incomplete")).not.toBeInTheDocument();

    // And the dashboard says so too.
    fireEvent.click(screen.getByRole("link", { name: "Back to dashboard" }));
    expect(await screen.findByText(/Hello, Jane Doe!/)).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("stays locked when finished with no signature on file", async () => {
    renderWaiver();
    fireEvent.click(await screen.findByRole("button", { name: /Start signing/ }));
    fireEvent.click(screen.getByRole("button", { name: /no signature on file/ }));
    expect(await screen.findByText("No signature detected on the waiver yet.")).toBeInTheDocument();
    expect(submit()).toBeDisabled();
  });

  it.each([
    ["Close", "You closed the waiver before finishing. Start again when you're ready."],
    ["Decline", "You declined to sign. You'll need a signed waiver to take part."],
  ])("%s keeps it locked and says why", async (button, message) => {
    renderWaiver();
    fireEvent.click(await screen.findByRole("button", { name: /Start signing/ }));
    fireEvent.click(screen.getByRole("button", { name: button }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(submit()).toBeDisabled();
  });
});
