import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// Records what the console asks send-wallet-passes for, and answers like the function would.
const calls: Record<string, unknown>[] = [];
let respond: (body: Record<string, unknown>) => unknown = () => ({ sent: 0, failed: [], remaining: 0 });
vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    functions: {
      invoke: async (_name: string, { body }: { body: Record<string, unknown> }) => {
        calls.push(body);
        return { data: respond(body), error: null };
      },
    },
  },
}));
vi.mock("@/portal/event", () => ({ currentEventId: async () => "event-1" }));

import { outsideEvent, parseApplicationIds } from "../../supabase/functions/send-wallet-passes/selection";
import { sendWalletPasses } from "./data";
import { passTargets, type Row } from "./types";
import WalletPassDialog from "./WalletPassDialog";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const row = (id: string, status: string, code: string | null, passSentAt: string | null = null) =>
  ({ id, status, code, passSentAt, first_name: id, last_name: null, applicant_type: "hacker", checkedIn: false }) as unknown as Row;

beforeEach(() => {
  calls.length = 0;
  respond = () => ({ sent: 0, failed: [], remaining: 0 });
});

describe("send-wallet-passes applicationIds", () => {
  it("means everyone without a pass when left out", () => {
    expect(parseApplicationIds(undefined)).toEqual({ ok: true, ids: null });
    expect(parseApplicationIds(null)).toEqual({ ok: true, ids: null });
  });

  it("means nobody, not everyone, when empty", () => {
    expect(parseApplicationIds([])).toEqual({ ok: true, ids: [] });
  });

  it("only takes a list of application ids", () => {
    expect(parseApplicationIds("all").ok).toBe(false);
    expect(parseApplicationIds([uuid(1), 7]).ok).toBe(false);
    expect(parseApplicationIds(["not-an-id"]).ok).toBe(false);
  });

  it("drops repeats and takes at most 40", () => {
    expect(parseApplicationIds([uuid(1), uuid(1).toUpperCase(), uuid(2)])).toEqual({ ok: true, ids: [uuid(1), uuid(2)] });
    expect(parseApplicationIds(Array.from({ length: 40 }, (_, i) => uuid(i))).ok).toBe(true);
    expect(parseApplicationIds(Array.from({ length: 41 }, (_, i) => uuid(i))).ok).toBe(false);
  });

  it("finds chosen ids that aren't at the event", () => {
    expect(outsideEvent([uuid(1), uuid(2), uuid(3)], [uuid(2).toUpperCase(), uuid(1)])).toEqual([uuid(3)]);
    expect(outsideEvent([uuid(1)], [uuid(1)])).toEqual([]);
  });
});

describe("passTargets", () => {
  it("splits the selection into first passes, repeats and people without a code", () => {
    const rows = [
      row("new", "accepted", "DH-1"),
      row("had", "accepted", "DH-2", "2026-10-20T00:00:00Z"),
      row("staged", "submitted", null),
      row("rejected", "rejected", null),
      row("not-picked", "accepted", "DH-3"),
    ];
    const t = passTargets(rows, ["new", "had", "staged", "rejected"]);
    expect(t.due.map(r => r.id)).toEqual(["new"]);
    expect(t.alreadySent.map(r => r.id)).toEqual(["had"]);
    expect(t.noCode.map(r => r.id)).toEqual(["staged", "rejected"]);
  });
});

describe("sendWalletPasses", () => {
  it("still sends to everyone without a pass by default, round after round", async () => {
    let left = 50;
    respond = () => {
      const sent = Math.min(40, left);
      left -= sent;
      return { sent, failed: [], remaining: left };
    };
    const result = await sendWalletPasses("event-1");
    expect(calls).toEqual([{ eventId: "event-1" }, { eventId: "event-1" }]);
    expect(result.sent).toBe(50);
  });

  it("sends only to chosen people, 40 per request, once each", async () => {
    respond = body => ({
      sent: (body.applicationIds as string[]).length,
      failed: [{ code: "X", email: "x@example.com", error: "boom" }],
      remaining: 0,
    });
    const ids = Array.from({ length: 90 }, (_, i) => uuid(i));
    const result = await sendWalletPasses("event-1", undefined, { applicationIds: ids, resend: true });
    expect(calls.map(c => (c.applicationIds as string[]).length)).toEqual([40, 40, 10]);
    expect(calls.flatMap(c => c.applicationIds as string[])).toEqual(ids);
    expect(calls.every(c => c.eventId === "event-1" && c.resend === true)).toBe(true);
    expect(result.sent).toBe(90);
    expect(result.failed).toHaveLength(3);
  });

  it("sends nothing for an empty selection", async () => {
    const result = await sendWalletPasses("event-1", undefined, { applicationIds: [] });
    expect(calls).toEqual([]);
    expect(result).toEqual({ sent: 0, failed: [] });
  });
});

describe("WalletPassDialog for selected rows", () => {
  const rows = [
    row("new", "accepted", "DH-1"),
    row("had", "accepted", "DH-2", "2026-10-20T00:00:00Z"),
    row("staged", "submitted", null),
    row("someone-else", "accepted", "DH-3"),
  ];

  it("sends only to the chosen people who need a pass", async () => {
    respond = body => ({ sent: (body.applicationIds as string[]).length, failed: [], remaining: 0 });
    render(<WalletPassDialog eventId="event-1" rows={rows} selectedIds={["new", "had", "staged"]} onClose={() => {}} onChanged={() => {}} />);
    expect(screen.getByText(/Skipping 1 without a check-in code/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send 1 pass" }));
    await waitFor(() => expect(screen.getByText(/pass sent/)).toBeInTheDocument());
    expect(calls).toEqual([{ eventId: "event-1", applicationIds: ["new"], resend: false }]);
  });

  it("can send a new copy to chosen people who already have one", async () => {
    respond = body => ({ sent: (body.applicationIds as string[]).length, failed: [], remaining: 0 });
    render(<WalletPassDialog eventId="event-1" rows={rows} selectedIds={["new", "had"]} onClose={() => {}} onChanged={() => {}} />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Send 2 passes" }));
    await waitFor(() => expect(screen.getByText(/passes sent/)).toBeInTheDocument());
    expect(calls).toEqual([{ eventId: "event-1", applicationIds: ["new", "had"], resend: true }]);
  });

  it("keeps everyone without a pass as the default", async () => {
    render(<WalletPassDialog eventId="event-1" rows={rows} onClose={() => {}} onChanged={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Send 2 passes" }));
    await waitFor(() => expect(calls).toEqual([{ eventId: "event-1" }]));
  });
});
