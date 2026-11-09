import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReleasedRow, SendResult } from "./data";
import type { Row } from "./types";

// The release, the emails and the reload after a failure, without a database.
const fake = vi.hoisted(() => ({
  releaseCalls: [] as { id: string; decision_version: number }[][],
  release: null as null | ((targets: { id: string; decision_version: number }[]) => Promise<{ released: ReleasedRow[]; notReleased: string[] }>),
  // What a reload of the list returns.
  fresh: [] as Row[],
  emailCalls: [] as { ids: string[]; subject: string; body: string; kind: string; expectStatus?: string }[],
  // Per call: how many go out before it fails with a network error (null = all).
  emailFailAfter: [] as (number | null)[],
}));
vi.mock("@/portal/event", () => ({ EVENT_CODE: "DH27" }));
vi.mock("./data", () => {
  class SendError extends Error {
    constructor(message: string, readonly partial: SendResult, readonly code: string | null = null) { super(message); }
  }
  return {
    SendError,
    useEmailQuota: () => ({ data: { used: 1790, limit: 1800, remaining: 10, frees_at: null } }),
    useRefreshQuota: () => () => {},
    releaseDecisions: async (_e: string, targets: { id: string; decision_version: number }[]) => {
      fake.releaseCalls.push(targets);
      return fake.release!(targets);
    },
    fetchApplicationRows: async () => fake.fresh,
    sendWalletPasses: async () => ({ sent: 0, failed: [] }),
    sendEmails: async (_e: string, ids: string[], subject: string, body: string, kind: string, _p: unknown, options: { expectStatus?: string } = {}) => {
      fake.emailCalls.push({ ids, subject, body, kind, expectStatus: options.expectStatus });
      const failAfter = fake.emailFailAfter.shift() ?? null;
      const result: SendResult = { sent: 0, skipped: [], failed: [], notSent: [], stopped: null, quota: null };
      for (const [i, id] of ids.entries()) {
        if (failAfter !== null && i >= failAfter) {
          result.notSent = ids.slice(i);
          throw new SendError("Couldn't reach the email service (a network problem, or it timed out). Anyone already sent to is recorded, so sending again only reaches the rest.", result, "network");
        }
        result.sent++;
        const row = fake.fresh.find(r => r.id === id);
        if (row) row.decision_emailed_at = "2026-12-10T00:00:00Z";
      }
      return result;
    },
  };
});

import ReleaseDialog from "./ReleaseDialog";

const row = (id: string, status: string, decision: string | null, extra: Partial<Row> = {}) =>
  ({
    id, status, decision, decision_version: 2, decided_by: null, decided_at: null, code: null, passSentAt: null,
    first_name: id, last_name: null, email: `${id}@example.com`, applicant_type: "hacker", checkedIn: false,
    decision_released_at: null, decision_emailed_at: null, ...extra,
  }) as unknown as Row;
const released = (r: Row): ReleasedRow => ({ application_id: r.id, email: r.email, first_name: r.first_name, applicant_type: r.applicant_type, status: r.decision! });
// The same people after a release that went through: status = decision, not emailed yet.
const afterRelease = (rows: Row[]) => rows.map(r => (r.decision && r.status !== "draft"
  ? { ...r, status: r.decision, decision_released_at: "2026-12-10T00:00:00Z", decision_emailed_at: null } : { ...r })) as Row[];

const before = [
  row("ana", "submitted", "rejected"),
  row("ben", "submitted", "rejected"),
  row("cy", "submitted", "rejected"),
  row("dee", "submitted", "waitlisted"),
  // A draft with a decision left over: never shown, released or emailed.
  row("draft", "draft", "accepted"),
];

const open = (rows = before, mode: "release" | "retry" = "release") =>
  render(<ReleaseDialog mode={mode} eventId="event-1" rows={rows} onClose={() => {}} onChanged={() => {}} />);
const confirm = (label: RegExp | string) => {
  fireEvent.change(screen.getByRole("textbox", { name: /Type DH27 to confirm/ }), { target: { value: "DH27" } });
  fireEvent.click(screen.getByRole("button", { name: label }));
};

beforeEach(() => {
  window.localStorage.clear();
  fake.releaseCalls = [];
  fake.emailCalls = [];
  fake.emailFailAfter = [];
  fake.fresh = afterRelease(before);
  fake.release = async targets => ({ released: targets.map(t => released(before.find(r => r.id === t.id)!)), notReleased: [] });
});

describe("ReleaseDialog", () => {
  it("shows and releases exactly the staged decisions listed, by id and version, never drafts", async () => {
    open();
    expect(screen.getAllByRole("listitem").map(li => li.textContent)).toEqual(["3 rejected hackers", "1 waitlisted hackers"]);
    confirm("Release 4 decisions");
    await waitFor(() => expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument());
    expect(fake.releaseCalls).toEqual([[
      { id: "ana", decision_version: 2 }, { id: "ben", decision_version: 2 }, { id: "cy", decision_version: 2 }, { id: "dee", decision_version: 2 },
    ]]);
    expect(fake.emailCalls.map(c => [c.ids, c.expectStatus])).toEqual([[["ana", "ben", "cy"], "rejected"], [["dee"], "waitlisted"]]);
    expect(screen.getByText(/decisions released/).textContent).toBe("4 decisions released.");
  });

  it("says when some shown decisions weren't released because someone changed them", async () => {
    fake.release = async targets => ({
      released: targets.filter(t => t.id !== "dee").map(t => released(before.find(r => r.id === t.id)!)), notReleased: ["dee"],
    });
    open();
    confirm("Release 4 decisions");
    await waitFor(() => expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument());
    expect(screen.getByText(/1 decision you saw wasn't released: someone changed it/)).toBeInTheDocument();
  });

  it("shows the database's own words when releasing fails, never [object Object]", async () => {
    // Supabase hands back a plain object, not an Error.
    fake.release = async () => { throw { message: "Not authorized", code: "P0001", details: null }; };
    fake.fresh = before;
    open();
    confirm("Release 4 decisions");
    const error = await screen.findByRole("alert");
    expect(error.textContent).toBe("Not authorized (P0001). Nothing was released, so it's safe to try again.");
    expect(document.body.textContent).not.toContain("[object Object]");
    // Still on the review screen, so they can try again.
    expect(screen.getByRole("button", { name: "Release 4 decisions" })).toBeInTheDocument();
  });

  it("after a dropped connection, checks what was released, then says N released, M emails still to send, with a retry that works", async () => {
    // The release commits, but the reply is lost.
    fake.release = async () => { throw new TypeError("Failed to fetch"); };
    // The first email batch gets one out, then the network fails.
    fake.emailFailAfter = [1];
    open();
    confirm("Release 4 decisions");
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("4 released, 3 emails still to send.")).toBeInTheDocument();
    expect(alert).toHaveTextContent("Couldn't reach the email service");
    expect(screen.getByText(/The connection dropped during the release \(Failed to fetch\), but the release went through/)).toBeInTheDocument();
    expect(fake.emailCalls[0].ids).toEqual(["ana", "ben", "cy"]);

    fireEvent.click(screen.getByRole("button", { name: "Send the 3 emails still to send" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    // Only the people still waiting, grouped by their real decision.
    expect(fake.emailCalls.slice(1).map(c => c.ids)).toEqual([["ben", "cy"], ["dee"]]);
    expect(screen.getByText(/emails? sent/).textContent).toBe("3 emails sent.");
  });

  it("says nothing changed, and to reload, when it can't even check after a dropped connection", async () => {
    fake.release = async () => { throw new TypeError("Failed to fetch"); };
    fake.fresh = before; // the reload shows nothing released
    open();
    confirm("Release 4 decisions");
    expect((await screen.findByRole("alert")).textContent).toBe("Failed to fetch. Nothing was released, so it's safe to try again.");
  });

  it("keeps edited emails for the event, and a later retry sends the same words", async () => {
    const { unmount } = open();
    fireEvent.click(screen.getByText(/Rejected hackers:/));
    const subject = screen.getAllByRole("textbox", { name: "Subject" })[0];
    fireEvent.change(subject, { target: { value: "About your DataHacks application (edited)" } });
    fake.emailFailAfter = [0];
    confirm("Release 4 decisions");
    await screen.findByRole("alert");
    unmount();

    // Later, from "Send unsent decision emails" (a new dialog).
    open(fake.fresh, "retry");
    expect(screen.getByText(/Using your edited emails for DH27/)).toBeInTheDocument();
    confirm("Send 4 emails");
    await waitFor(() => expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument());
    const retry = fake.emailCalls.find(c => c.ids.includes("ana") && c.subject.includes("edited") && fake.emailCalls.indexOf(c) > 0);
    expect(retry?.subject).toBe("About your DataHacks application (edited)");

    // Reset goes back to the defaults.
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
  });

  it("warns before sending more than today's Gmail limit allows", () => {
    const many = Array.from({ length: 12 }, (_, i) => row(`p${i}`, "submitted", "accepted"));
    open(many);
    expect(screen.getByText(/Only 10 more emails can go out today/)).toBeInTheDocument();
    expect(screen.getByText(/Gmail sending:/)).toHaveTextContent("10 of 1,800 left");
  });
});
