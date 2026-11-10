import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Row } from "./types";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabaseClient", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

import WaiversPage from "./WaiversPage";

const ID1 = "6f1c2a9e-3b7d-4e8a-9c0f-1a2b3c4d5e61";
const ID2 = "6f1c2a9e-3b7d-4e8a-9c0f-1a2b3c4d5e62";
const ID3 = "6f1c2a9e-3b7d-4e8a-9c0f-1a2b3c4d5e63";
const row = (id: string, first: string, email: string, extra: Partial<Row> = {}): Row => ({
  id, applicant_type: "hacker", status: "accepted", submitted_at: null, first_name: first, last_name: "Test", email,
  phone: null, school: null, level_of_study: null, organization: null, suggested_food: null, suggested_activity: null, decision: "accepted", decided_by: null, decided_at: null, decision_version: 1, decision_released_at: null,
  decision_emailed_at: null, code: null, checkedIn: false, passSentAt: null, waiverSignedAt: null, ...extra,
});
const ROWS = [
  row(ID1, "José", "jose@ucsd.edu", { code: "DH27-H001" }),
  row(ID2, "Siobhán", "siobhan@example.com"),
  row(ID3, "Already", "already@example.com", { waiverSignedAt: "2026-11-01T00:00:00Z" }),
];

const CSV = [
  "Envelope ID,Role 1::Role Name,Role 1::Name,Role 1::Email,Role 1::datahacks_id",
  `0f1e2d3c-aaaa-bbbb-cccc-1234567890ab,Participant,José Test,other@gmail.com,${ID1}`,
  "1f1e2d3c-aaaa-bbbb-cccc-1234567890ab,Participant,Already Test,already@example.com,",
  "2f1e2d3c-aaaa-bbbb-cccc-1234567890ab,Participant,Stranger,stranger@example.com,",
].join("\n");

function upload(text: string, name = "waiver.csv") {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([text], name, { type: "text/csv" });
  Object.defineProperty(file, "text", { value: async () => text });
  fireEvent.change(input, { target: { files: [file] } });
}

beforeEach(() => rpc.mockReset());
afterEach(() => vi.restoreAllMocks());

describe("Waivers page", () => {
  it("previews an import, and records only the matched rows after confirming", async () => {
    const onChanged = vi.fn();
    rpc.mockResolvedValue({ data: { recorded: 1, already_on_file: 0, skipped: 0, skipped_rows: [] }, error: null });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<WaiversPage eventId="event-1" rows={ROWS} onChanged={onChanged} />);
    expect(screen.getByText("On file").nextElementSibling).toHaveTextContent("1 of 3 accepted");

    upload(CSV);
    expect(await screen.findByText(/PowerForm data export/)).toBeInTheDocument();
    const tabs = screen.getByRole("tablist", { name: "Import rows" });
    expect(within(tabs).getByRole("tab", { name: /To record 1/ })).toHaveAttribute("aria-selected", "true");
    expect(within(tabs).getByRole("tab", { name: /Already on file 1/ })).toBeInTheDocument();
    expect(within(tabs).getByRole("tab", { name: /Not matched 1/ })).toBeInTheDocument();
    expect(screen.getByText("by datahacks_id")).toBeInTheDocument();

    fireEvent.click(within(tabs).getByRole("tab", { name: /Not matched/ }));
    expect(screen.getByText("No application with this email")).toBeInTheDocument();

    // Cancelling the confirm sends nothing.
    confirm.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "Record 1 waiver" }));
    expect(rpc).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Record 1 waiver" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("record_waivers_import", {
      p_event_id: "event-1",
      p_rows: [{ application_id: ID1, envelope_id: "0f1e2d3c-aaaa-bbbb-cccc-1234567890ab", signed_at: null }],
    }));
    expect(await screen.findByText(/Recorded 1\./)).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
  });

  it("says why a file can't be read", async () => {
    render(<WaiversPage eventId="event-1" rows={ROWS} onChanged={() => {}} />);
    upload("foo,bar\n1,2");
    expect(await screen.findByRole("alert")).toHaveTextContent(/doesn't look like a DocuSign export/);
  });

  it("marks someone signed after a confirm with a note, and not when cancelled", async () => {
    const onChanged = vi.fn();
    rpc.mockResolvedValue({ data: { status: "marked", signed_at: "2026-11-05T10:00:00Z" }, error: null });
    const prompt = vi.spyOn(window, "prompt").mockReturnValueOnce(null).mockReturnValueOnce("Showed DocuSign completion email");
    render(<WaiversPage eventId="event-1" rows={ROWS} onChanged={onChanged} />);
    expect(screen.getByRole("heading", { name: /No waiver yet 2/ })).toBeInTheDocument();

    const joseRow = screen.getByText("José Test").closest("tr")!;
    fireEvent.click(within(joseRow).getByRole("button", { name: "Mark signed" }));
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalled();

    fireEvent.click(within(joseRow).getByRole("button", { name: "Mark signed" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("mark_waiver_seen", { p_event_id: "event-1", p_person_id: ID1, p_note: "Showed DocuSign completion email" }));
    expect(await screen.findByText("Marked José Test signed.")).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
  });

  it("explains a mark the database refused", async () => {
    rpc.mockResolvedValue({ data: { status: "no_account" }, error: null });
    vi.spyOn(window, "prompt").mockReturnValue("");
    render(<WaiversPage eventId="event-1" rows={ROWS} onChanged={() => {}} />);
    fireEvent.click(within(screen.getByText("Siobhán Test").closest("tr")!).getByRole("button", { name: "Mark signed" }));
    expect(await screen.findByText(/don't have a portal account/)).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("mark_waiver_seen", { p_event_id: "event-1", p_person_id: ID2, p_note: null });
  });
});
