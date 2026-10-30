import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReleasedRow, WalletPassResult } from "./data";
import type { Row } from "./types";

// What the release, the decision emails and the passes would do, without a database.
const fake = vi.hoisted(() => ({
  released: [] as ReleasedRow[],
  // The list after the release: the database gives released acceptances a check-in code.
  after: [] as Row[],
  passCalls: [] as { applicationIds?: string[]; resend?: boolean }[],
  passError: null as Error | null,
  emailFailed: [] as { id: string; error: string }[],
}));
vi.mock("@/portal/event", () => ({ EVENT_CODE: "DH27BETA" }));
vi.mock("./data", () => ({
  EmailNotSetUpError: class extends Error {},
  releaseDecisions: async () => fake.released,
  sendEmails: async (_e: string, ids: string[]) => ({ sent: ids.length, failed: fake.emailFailed.filter(f => ids.includes(f.id)) }),
  fetchApplicationRows: async () => fake.after,
  sendWalletPasses: async (_e: string, _p: unknown, options: { applicationIds?: string[]; resend?: boolean }): Promise<WalletPassResult> => {
    if (fake.passError) throw fake.passError;
    fake.passCalls.push(options);
    const ids = options.applicationIds ?? [];
    return { sent: ids.length - 1, failed: ids.length ? [{ code: "X", email: "x@example.com", error: "boom" }] : [] };
  },
}));

import ReleaseDialog from "./ReleaseDialog";

const row = (id: string, status: string | null, decision: string | null, code: string | null = null, passSentAt: string | null = null) =>
  ({ id, status, decision, code, passSentAt, first_name: id, last_name: null, email: `${id}@example.com`, applicant_type: "hacker", checkedIn: false }) as unknown as Row;
const released = (id: string, status: string): ReleasedRow =>
  ({ application_id: id, email: `${id}@example.com`, first_name: id, applicant_type: "hacker", status });

// Before: two picked to accept, one picked to reject, one already accepted earlier (with a pass).
const before = [
  row("ana", "submitted", "accepted"),
  row("ben", "submitted", "accepted"),
  row("cy", "submitted", "rejected"),
  row("old", "accepted", "accepted", "DH-OLD", "2026-10-01T00:00:00Z"),
];

const release = async (untick = false) => {
  render(<ReleaseDialog mode="release" eventId="event-1" rows={before} onClose={() => {}} onChanged={() => {}} />);
  const box = screen.getByRole("checkbox", { name: "Also send wallet passes to everyone newly accepted" });
  expect(box).toBeChecked();
  if (untick) fireEvent.click(box);
  fireEvent.change(screen.getByRole("textbox", { name: /Type DH27BETA to confirm/ }), { target: { value: "DH27BETA" } });
  fireEvent.click(screen.getByRole("button", { name: "Release 3 decisions" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument());
};

beforeEach(() => {
  fake.released = [released("ana", "accepted"), released("ben", "accepted"), released("cy", "rejected")];
  fake.after = [
    row("ana", "accepted", "accepted", "DH-ANA"),
    row("ben", "accepted", "accepted", "DH-BEN"),
    row("cy", "rejected", "rejected"),
    row("old", "accepted", "accepted", "DH-OLD", "2026-10-01T00:00:00Z"),
  ];
  fake.passCalls = [];
  fake.passError = null;
  fake.emailFailed = [];
});

describe("ReleaseDialog wallet passes", () => {
  it("sends passes only to the people it just accepted who now have a code", async () => {
    await release();
    expect(fake.passCalls).toEqual([{ applicationIds: ["ana", "ben"] }]);
    expect(screen.getByText(/Sent/).textContent).toMatch(/Sent 1 wallet pass; 1 failed\./);
  });

  it("sends none when unticked", async () => {
    await release(true);
    expect(fake.passCalls).toEqual([]);
    expect(screen.queryByText(/wallet pass/)).not.toBeInTheDocument();
  });

  it("skips anyone who already has a pass, and says who has no code yet", async () => {
    fake.after = fake.after.map(r => (r.id === "ana" ? { ...r, passSentAt: "2026-10-30T00:00:00Z" } : r.id === "ben" ? { ...r, code: null } : r));
    await release();
    expect(fake.passCalls).toEqual([]);
    expect(screen.getByText(/Sent/).textContent).toMatch(/Sent 0 wallet passes; 0 failed\. 1 already had one\. 1 without a check-in code yet/);
  });

  it("leaves out anyone whose picked decision has changed since", async () => {
    fake.after = fake.after.map(r => (r.id === "ben" ? { ...r, decision: "rejected" } : r));
    await release();
    expect(fake.passCalls).toEqual([{ applicationIds: ["ana"] }]);
  });

  it("doesn't send a pass to someone whose acceptance email failed", async () => {
    fake.emailFailed = [{ id: "ben", error: "bounced" }];
    await release();
    expect(fake.passCalls).toEqual([{ applicationIds: ["ana"] }]);
  });

  it("says so, and sends nothing, if the function can't take a list of people", async () => {
    fake.passError = new Error("The deployed send-wallet-passes function can't send to chosen people yet. Deploy the latest version and try again. Nothing was sent.");
    await release();
    expect(screen.getByText("Wallet passes not sent.")).toBeInTheDocument();
    expect(screen.getByText(/can't send to chosen people yet/)).toBeInTheDocument();
    expect(fake.passCalls).toEqual([]);
  });

  it("doesn't offer passes when nobody is being accepted", () => {
    render(<ReleaseDialog mode="release" eventId="event-1" rows={[row("cy", "submitted", "rejected")]} onClose={() => {}} onChanged={() => {}} />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
