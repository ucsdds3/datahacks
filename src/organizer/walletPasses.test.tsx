import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// Records what the console asks send-wallet-passes to send, and answers like the function would.
// GET is the "do you know applicationIds?" check; oldFunction answers it like the previous version (405).
const calls: Record<string, unknown>[] = [];
const checks: string[] = [];
let oldFunction = false;
let respond: (body: Record<string, unknown>) => unknown = () => ({ sent: 0, failed: [], remaining: 0 });
vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    functions: {
      invoke: async (_name: string, { body, method }: { body?: Record<string, unknown>; method?: string }) => {
        if (method === "GET") {
          checks.push("GET");
          return oldFunction
            ? { data: null, error: Object.assign(new Error("Edge Function returned a non-2xx status code"), { name: "FunctionsHttpError", context: { status: 405 } }) }
            : { data: { applicationIds: true }, error: null };
        }
        if (oldFunction) throw new Error("the old function would have emailed everyone");
        calls.push(body!);
        return { data: respond(body!), error: null };
      },
    },
  },
}));
vi.mock("@/portal/event", () => ({ currentEventId: async () => "event-1" }));

import { outsideEvent, parseApplicationIds } from "../../supabase/functions/send-wallet-passes/selection";
import { sendWalletPasses } from "./data";
import { needsPass, passTargets, someNames, type Row } from "./types";
import WalletPassDialog from "./WalletPassDialog";
import ApplicationsTable from "./ApplicationsTable";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const row = (id: string, status: string, code: string | null, passSentAt: string | null = null, decision: string | null = null) =>
  ({ id, status, decision, code, passSentAt, first_name: id, last_name: null, applicant_type: "hacker", checkedIn: false }) as unknown as Row;

beforeEach(() => {
  calls.length = 0;
  checks.length = 0;
  oldFunction = false;
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

  // Released as accepted (so on the roster with a code), then picked "rejected" and not released yet.
  const rows = [
    row("due", "accepted", "DH-1"),
    row("flipped", "accepted", "DH-2", null, "rejected"),
    row("flipped-had", "accepted", "DH-3", "2026-10-20T00:00:00Z", "waitlisted"),
    row("kept", "accepted", "DH-4", null, "accepted"),
    row("picked", "submitted", null, null, "accepted"),
    row("picked-2", "waitlisted", null, null, "accepted"),
  ];

  it("never offers a pass to someone picked for a different decision that isn't released", () => {
    expect(rows.filter(needsPass).map(r => r.id)).toEqual(["due", "kept"]);
    const all = passTargets(rows);
    expect(all.due.map(r => r.id)).toEqual(["due", "kept"]);
    // Without a selection, only people who'd otherwise get a first pass count as skipped.
    expect(all.onHold.map(r => r.id)).toEqual(["flipped"]);
    const picked = passTargets(rows, ["flipped", "flipped-had", "due"]);
    expect(picked.due.map(r => r.id)).toEqual(["due"]);
    expect(picked.alreadySent).toEqual([]);
    expect(picked.onHold.map(r => r.id)).toEqual(["flipped", "flipped-had"]);
    expect(picked.noCode).toEqual([]);
  });

  it("finds people picked to accept who have no code until decisions are released", () => {
    expect(passTargets(rows).notReleased.map(r => r.id)).toEqual(["picked", "picked-2"]);
    const t = passTargets(rows, ["picked", "due"]);
    expect(t.notReleased.map(r => r.id)).toEqual(["picked"]);
    expect(t.noCode).toEqual([]);
  });
});

describe("someNames", () => {
  const people = (n: number) => Array.from({ length: n }, (_, i) => ({ first_name: `P${i + 1}`, last_name: null }));
  it("lists up to five names, then how many more", () => {
    expect(someNames(people(1))).toBe("P1");
    expect(someNames(people(3))).toBe("P1, P2 and P3");
    expect(someNames(people(5))).toBe("P1, P2, P3, P4 and P5");
    expect(someNames(people(7))).toBe("P1, P2, P3, P4, P5 and 2 more");
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

  it("checks the function knows applicationIds before sending to chosen people", async () => {
    respond = () => ({ sent: 1, failed: [], remaining: 0 });
    await sendWalletPasses("event-1", undefined, { applicationIds: [uuid(1)] });
    expect(checks).toEqual(["GET"]);
    await sendWalletPasses("event-1");
    expect(checks).toEqual(["GET"]);
  });

  it("sends nothing if the deployed function is too old to pick people", async () => {
    oldFunction = true;
    await expect(sendWalletPasses("event-1", undefined, { applicationIds: [uuid(1)] })).rejects.toThrow(/Nothing was sent/);
    expect(calls).toEqual([]);
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

  it("skips chosen people picked for a different decision that isn't released", async () => {
    respond = body => ({ sent: (body.applicationIds as string[]).length, failed: [], remaining: 0 });
    const withFlipped = [...rows, row("flipped", "accepted", "DH-9", null, "rejected")];
    render(<WalletPassDialog eventId="event-1" rows={withFlipped} selectedIds={["new", "flipped"]} onClose={() => {}} onChanged={() => {}} />);
    expect(screen.getByText(/1 skipped: you've picked a different decision for them that isn't released yet — release decisions first/)).toBeInTheDocument();
    expect(screen.queryByText(/Skipping/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send 1 pass" }));
    await waitFor(() => expect(screen.getByText(/pass sent/)).toBeInTheDocument());
    expect(calls).toEqual([{ eventId: "event-1", applicationIds: ["new"], resend: false }]);
  });
});

describe("WalletPassDialog for everyone without a pass", () => {
  // Like DH27BETA: released acceptances since picked "rejected", and picked acceptances not released yet.
  const rows = [
    row("due", "accepted", "DH-1"),
    row("had", "accepted", "DH-2", "2026-10-20T00:00:00Z"),
    row("flipped-1", "accepted", "DH-3", null, "rejected"),
    row("flipped-2", "accepted", "DH-4", null, "rejected"),
    ...["Ana", "Ben", "Cy", "Di", "Ed", "Flo", "Gus"].map(n => row(n, "submitted", null, null, "accepted")),
  ];

  it("leaves out people about to be un-accepted, and names exactly who to send to", async () => {
    respond = body => ({ sent: (body.applicationIds as string[]).length, failed: [], remaining: 0 });
    render(<WalletPassDialog eventId="event-1" rows={rows} onClose={() => {}} onChanged={() => {}} />);
    expect(screen.getByText(/2 skipped: you've picked a different decision for them that isn't released yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send 1 pass" }));
    await waitFor(() => expect(screen.getByText(/pass sent/)).toBeInTheDocument());
    // Not { eventId } alone, which lets the function send to everyone on the roster without a pass.
    expect(calls).toEqual([{ eventId: "event-1", applicationIds: ["due"], resend: false }]);
  });

  it("says who's accepted but waiting on a release, with their names", () => {
    render(<WalletPassDialog eventId="event-1" rows={rows} onClose={() => {}} onChanged={() => {}} />);
    expect(screen.getByText(
      "7 accepted but not released yet — release decisions to give them a check-in code: Ana, Ben, Cy, Di, Ed and 2 more.",
    )).toBeInTheDocument();
  });

  it("explains itself even when nobody can get a pass yet", () => {
    render(<WalletPassDialog eventId="event-1" rows={rows.filter(r => r.status !== "accepted" || r.decision)} onClose={() => {}} onChanged={() => {}} />);
    expect(screen.getByRole("button", { name: "Send 0 passes" })).toBeDisabled();
    expect(screen.getByText(/2 skipped/)).toBeInTheDocument();
    expect(screen.getByText(/7 accepted but not released yet/)).toBeInTheDocument();
  });
});

describe("ApplicationsTable accepted tab", () => {
  const rows = [
    row("released", "accepted", "DH-1"),
    row("picked-1", "submitted", null, null, "accepted"),
    row("picked-2", "submitted", null, null, "accepted"),
    row("flipped", "accepted", "DH-2", null, "rejected"),
  ];

  it("counts who isn't released and shows Release right after the name", () => {
    render(<ApplicationsTable kind="hacker" rows={rows} onChanged={() => {}} />);
    expect(screen.getByRole("tab", { name: /Accepted 3 \(2 not released\)/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Rejected 1 \(1 not released\)/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Accepted/ }));
    const headers = screen.getAllByRole("columnheader").map(h => h.textContent);
    expect(headers.slice(1, 3)).toEqual(["Name", "Release"]);
    expect(screen.getAllByText("Not released")).toHaveLength(2);
  });

  it("offers Send pass for someone picked to accept, so the dialog can say why there's no code", () => {
    const onSendPasses = vi.fn();
    render(<ApplicationsTable kind="hacker" rows={rows} onChanged={() => {}} onSendPasses={onSendPasses} />);
    fireEvent.click(screen.getByRole("tab", { name: /Accepted/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select picked-1" }));
    fireEvent.click(screen.getByRole("button", { name: /Send pass/ }));
    expect(onSendPasses).toHaveBeenCalledWith(["picked-1"]);
  });
});
