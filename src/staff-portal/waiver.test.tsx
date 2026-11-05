import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Waiver page in dev ?preview mode: the PowerForm link, and (embedded mode) the simulated DocuSign.
const invoke = vi.hoisted(() => vi.fn(async () => ({ data: null, error: null })));
vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    functions: { invoke },
  },
}));

import { AuthProvider } from "@/context/AuthContext";
import StaffPortalLayout from "./StaffPortalLayout";
import Dashboard from "./Dashboard";
import Waiver from "./Waiver";
import { waiverKey } from "./StaffPortalContext";
import { EVENT_CODE } from "@/portal/event";
import { DOCUSIGN } from "./config";

function renderWaiver(query = "") {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <MemoryRouter initialEntries={[`/portal/mentor/waiver?preview${query}`]}>
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

const shipped = { ...DOCUSIGN };
beforeEach(() => {
  localStorage.clear();
  invoke.mockClear();
  // The simulated-signing tests below are for embedded mode.
  DOCUSIGN.mode = "embedded";
});
afterEach(() => { Object.assign(DOCUSIGN, shipped); });

describe("PowerForm waiver page", () => {
  beforeEach(() => { Object.assign(DOCUSIGN, shipped); });

  it("says the waiver opens soon while it isn't published, even with a link set", async () => {
    renderWaiver();
    expect(await screen.findByRole("button", { name: "Waiver opens soon" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: /Sign the waiver/ })).not.toBeInTheDocument();
    expect(screen.getByText("Not on file yet")).toBeInTheDocument();
  });

  it("says it opens soon without a link, even once published", async () => {
    Object.assign(DOCUSIGN, { waiverPublished: true, powerFormUrl: "" });
    renderWaiver();
    expect(await screen.findByRole("button", { name: "Waiver opens soon" })).toBeDisabled();
  });

  it("links to the prefilled PowerForm in a new tab once published, and never calls the edge function", async () => {
    DOCUSIGN.waiverPublished = true;
    renderWaiver();
    const link = await screen.findByRole("link", { name: /Sign the waiver/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    const href = new URL(link.getAttribute("href")!);
    expect(href.origin + href.pathname).toBe("https://www.docusign.net/Member/PowerFormSigning.aspx");
    expect(href.searchParams.get("Participant_UserName")).toBe("Jane Doe");
    expect(href.searchParams.get("Participant_Email")).toBe("jane.doe@example.com");
    expect(href.searchParams.get("datahacks_id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(screen.getByText(/Signed\? It shows here within a day once we sync with DocuSign/)).toBeInTheDocument();
    // Nothing on the page can mark it signed except the preview-only stand-in for a sync.
    expect(screen.queryByRole("button", { name: /I signed|Submit/ })).not.toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("shows Signed from the database (preview: a pretend sync), and the dashboard agrees", async () => {
    DOCUSIGN.waiverPublished = true;
    renderWaiver();
    fireEvent.click(await screen.findByRole("button", { name: /Pretend DocuSign synced/ }));
    expect(await screen.findByText("Waiver on file")).toBeInTheDocument();
    expect(screen.getByText("Signed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Back to dashboard" }));
    expect(await screen.findByText("Completed")).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("preview's &waiver=ready shows the live button before publishing", async () => {
    renderWaiver("&waiver=ready");
    expect(await screen.findByRole("link", { name: /Sign the waiver/ })).toBeInTheDocument();
  });
});

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

describe("waiver flag isolation", () => {
  it("ignores a waiver saved for another event, another account or by the old shared key", async () => {
    localStorage.setItem("datahacks.staffPortal.waiverSubmitted", "true");
    localStorage.setItem("datahacks.staffPortal.waiverSubmitted.DH26.preview", "true");
    localStorage.setItem(waiverKey("someone-else"), "true");
    renderWaiver();
    expect(await screen.findByText("Incomplete")).toBeInTheDocument();
  });

  it("saves the submitted waiver under this event and person", () => {
    expect(waiverKey("user-1")).toBe(`datahacks.staffPortal.waiverSubmitted.${EVENT_CODE}.user-1`);
    expect(waiverKey("user-1")).not.toBe(waiverKey("user-2"));
  });
});
