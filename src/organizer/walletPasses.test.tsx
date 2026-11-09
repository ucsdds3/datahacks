import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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
import { needsPass, passLists, passTargets, type Row } from "./types";
import PassesPage from "./PassesPage";
import ApplicationsTable from "./ApplicationsTable";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const row = (id: string, status: string, code: string | null, passSentAt: string | null = null, decision: string | null = null, applicant_type = "hacker") =>
  ({ id, status, decision, code, passSentAt, first_name: id, last_name: null, email: `${id}@example.com`, school: null, organization: null, applicant_type, checkedIn: false }) as unknown as Row;

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

  it("sends only to chosen people, 20 per request, once each", async () => {
    respond = body => ({
      sent: (body.applicationIds as string[]).length,
      failed: [{ code: "X", email: "x@example.com", error: "boom" }],
      remaining: 0,
    });
    const ids = Array.from({ length: 90 }, (_, i) => uuid(i));
    const result = await sendWalletPasses("event-1", undefined, { applicationIds: ids, resend: true });
    expect(calls.map(c => (c.applicationIds as string[]).length)).toEqual([20, 20, 20, 20, 10]);
    expect(calls.flatMap(c => c.applicationIds as string[])).toEqual(ids);
    expect(calls.every(c => c.eventId === "event-1" && c.resend === true)).toBe(true);
    expect(result.sent).toBe(90);
    expect(result.failed).toHaveLength(5);
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

  it("sends whoever a time-boxed request didn't get to in the next request, never twice", async () => {
    const ids = Array.from({ length: 25 }, (_, i) => uuid(i));
    let round = 0;
    // The first request runs out of time after 12 of its 20.
    respond = body => {
      const asked = body.applicationIds as string[];
      return round++ === 0
        ? { sent: 12, failed: [], remaining: 8, remainingIds: asked.slice(12) }
        : { sent: asked.length, failed: [], remaining: 0, remainingIds: [] };
    };
    const result = await sendWalletPasses("event-1", undefined, { applicationIds: ids });
    expect(calls.map(c => c.applicationIds)).toEqual([ids.slice(0, 20), [...ids.slice(12, 20), ...ids.slice(20, 25)]]);
    expect(result.sent).toBe(25);
  });

  it("stops at Gmail's daily limit and says who wasn't sent", async () => {
    const ids = Array.from({ length: 30 }, (_, i) => uuid(i));
    respond = body => ({ sent: 5, failed: [], remaining: 15, remainingIds: (body.applicationIds as string[]).slice(5), stopped: "daily_limit" });
    const result = await sendWalletPasses("event-1", undefined, { applicationIds: ids });
    expect(calls).toHaveLength(1);
    expect(result).toMatchObject({ sent: 5, stopped: "daily_limit" });
    expect(result.notSent).toEqual(ids.slice(5));
  });

  it("sends nothing for an empty selection", async () => {
    const result = await sendWalletPasses("event-1", undefined, { applicationIds: [] });
    expect(calls).toEqual([]);
    expect(result).toEqual({ sent: 0, failed: [] });
  });
});

describe("passLists", () => {
  it("puts everyone accepted without a pass in To send, released or not, and passes in Sent", () => {
    const rows = [
      row("due", "accepted", "DH-1"),
      row("had", "accepted", "DH-2", "2026-10-20T00:00:00Z"),
      row("picked", "submitted", null, null, "accepted"),
      row("flipped", "accepted", "DH-3", null, "rejected"),
      row("flipped-had", "accepted", "DH-4", "2026-10-20T00:00:00Z", "waitlisted"),
      row("rejected", "submitted", null, null, "rejected"),
      row("waitlisted", "waitlisted", null),
      row("applied", "submitted", null),
    ];
    const l = passLists(rows);
    expect(l.toSend.map(r => r.id)).toEqual(["due", "picked"]);
    expect(l.sent.map(r => r.id)).toEqual(["had"]);
  });
});

describe("PassesPage", () => {
  const rows = [
    row("hana", "accepted", "DH-H1"),
    { ...row("hugo", "accepted", "DH-H2"), school: "UC San Diego" } as Row,
    row("mia", "accepted", "DH-M1", null, null, "mentor"),
    row("jo", "accepted", "DH-J1", null, null, "judge"),
    row("jay", "accepted", "DH-J2", "2026-10-20T12:00:00Z", null, "judge"),
    row("kim", "accepted", "DH-X1", null, null, "hybrid"),
    row("lee", "submitted", null, null, "accepted", "hybrid"),
    row("flip", "accepted", "DH-M3", null, "rejected", "mentor"),
    row("flip-sent", "accepted", "DH-J3", "2026-10-20T12:00:00Z", "waitlisted", "judge"),
    row("rej", "submitted", null, null, "rejected"),
    row("wl", "waitlisted", null),
  ];
  const onReleaseAndSend = vi.fn();
  const page = (r = rows, initialSelected?: string[]) =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <PassesPage eventId="event-1" rows={r} initialSelected={initialSelected} onChanged={() => {}} onReleaseAndSend={onReleaseAndSend} />
      </QueryClientProvider>,
    );
  // Every send asks first.
  const confirm = (n: number) => fireEvent.click(screen.getByRole("button", { name: `Yes, send ${n} pass${n === 1 ? "" : "es"}` }));
  const group = (name: string) => screen.getAllByRole("group").find(g => g.querySelector(".og-pass-role-name")?.textContent === name)!;
  const names = (el: HTMLElement) => within(el).queryAllByRole("listitem").map(li => li.querySelector("strong")!.textContent);
  const sendsTo = (ids: string[], resend = false) => expect(calls).toEqual([{ eventId: "event-1", applicationIds: ids, resend }]);

  beforeEach(() => {
    onReleaseAndSend.mockClear();
    respond = body => ({ sent: (body.applicationIds as string[]).length, failed: [], remaining: 0 });
  });

  it("lists everyone accepted without a pass by name, role group and email, groups open, no codes", () => {
    page();
    expect(screen.getByRole("tab", { name: "To send 6" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Sent 1" })).toBeInTheDocument();
    const groups = screen.getAllByRole("group");
    expect(groups.map(g => g.querySelector(".og-pass-role-name")!.textContent)).toEqual(["Hackers", "Mentors", "Judges", "Mentors & judges"]);
    expect(groups.every(g => (g as HTMLDetailsElement).open)).toBe(true);
    expect(names(group("Hackers"))).toEqual(["hana", "hugo"]);
    expect(names(group("Mentors"))).toEqual(["mia"]);
    expect(names(group("Judges"))).toEqual(["jo"]);
    expect(names(group("Mentors & judges"))).toEqual(["kim", "lee"]);
    expect(screen.getByText("hana@example.com")).toBeInTheDocument();
    expect(screen.getByText("UC San Diego")).toBeInTheDocument();
    // Picked for reject or waitlist, or already sent: never in To send.
    for (const id of ["flip", "flip-sent", "rej", "wl", "jay"]) expect(screen.queryByText(id)).not.toBeInTheDocument();
    expect(screen.queryByText(/DH-/)).not.toBeInTheDocument();
  });

  it("shows people not released yet like everyone else, with a tag, selectable and counted", () => {
    page();
    const lee = screen.getByText("lee").closest("li")!;
    expect(within(lee).getByText("Not released")).toBeInTheDocument();
    expect(within(lee).getByRole("checkbox", { name: "Select lee" })).toBeEnabled();
    expect(within(screen.getByText("kim").closest("li")!).queryByText("Not released")).not.toBeInTheDocument();
    expect(group("Mentors & judges").querySelector("summary")).toHaveTextContent("2 to send · 1 not released");
    expect(screen.getByText(/isn't released yet/)).toHaveTextContent(/^1 of these isn't released yet/);
  });

  it("says Release decisions & send when a button would include someone not released, and opens the Release dialog", () => {
    page();
    expect(screen.getByRole("button", { name: "Send 2 hacker passes" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Release decisions & send 2 mentor & judge passes" }));
    expect(onReleaseAndSend).toHaveBeenCalledWith({ count: 2, releasedIds: ["kim"] });
    fireEvent.click(screen.getByRole("button", { name: "Release decisions & send all 6" }));
    expect(onReleaseAndSend).toHaveBeenLastCalledWith({ count: 6, releasedIds: ["hana", "hugo", "mia", "jo", "kim"] });
    fireEvent.click(screen.getByRole("checkbox", { name: "Select lee" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select hana" }));
    fireEvent.click(screen.getByRole("button", { name: "Release decisions & send passes to 2 selected" }));
    expect(onReleaseAndSend).toHaveBeenLastCalledWith({ count: 2, releasedIds: ["hana"] });
    // Nothing is sent from the page itself; the Release dialog does it after releasing.
    expect(calls).toEqual([]);
  });

  it("renders every row, however many, so find-in-page reaches them", () => {
    const many = Array.from({ length: 150 }, (_, i) => row(`h${i}`, "accepted", `DH-H${i}`));
    page(many);
    expect(names(group("Hackers"))).toHaveLength(150);
    expect(screen.queryByText(/more/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send 150 hacker passes" })).toBeInTheDocument();
  });

  it("filters by name, email and school", () => {
    page();
    const search = screen.getByRole("searchbox", { name: "Search passes" });
    fireEvent.change(search, { target: { value: "san diego" } });
    expect(screen.getAllByRole("group")).toHaveLength(1);
    expect(names(group("Hackers"))).toEqual(["hugo"]);
    fireEvent.change(search, { target: { value: "MIA@EXAMPLE" } });
    expect(names(group("Mentors"))).toEqual(["mia"]);
    fireEvent.change(search, { target: { value: "lee" } });
    expect(names(group("Mentors & judges"))).toEqual(["lee"]);
    fireEvent.change(search, { target: { value: "nobody" } });
    expect(screen.getByText("Nobody matches that search.")).toBeInTheDocument();
  });

  it("sends to exactly the selected people when they're all released", async () => {
    page();
    const send = () => screen.getByRole("button", { name: /^Send passes to \d+ selected$/ });
    expect(send()).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select hugo" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select kim" }));
    expect(send()).toHaveTextContent("Send passes to 2 selected");
    fireEvent.click(send());
    expect(calls).toEqual([]);
    expect(screen.getByText(/Send 2 passes from DataHacks Team/)).toBeInTheDocument();
    confirm(2);
    await waitFor(() => expect(screen.getByText("2 passes sent.")).toBeInTheDocument());
    sendsTo(["hugo", "kim"]);
    expect(onReleaseAndSend).not.toHaveBeenCalled();
    // Not offered again before the list reloads.
    expect(screen.queryByText("hugo")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "To send 4" })).toBeInTheDocument();
  });

  it("selects a whole role, keeping selections hidden by search", () => {
    page();
    fireEvent.click(within(group("Hackers")).getByRole("checkbox", { name: "Select all 2 shown" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "mia" } });
    expect(document.querySelector(".og-pass-selected")).toHaveTextContent("2 selected (2 hidden by search)");
  });

  it("sends one role, naming exactly who", async () => {
    page();
    fireEvent.click(screen.getByRole("button", { name: "Send 1 mentor pass" }));
    confirm(1);
    await waitFor(() => expect(screen.getByText("1 mentor pass sent.")).toBeInTheDocument());
    sendsTo(["mia"]);
  });

  it("sends to everyone at once, still as a list, never the function's own pick", async () => {
    page(rows.filter(r => r.id !== "lee"));
    fireEvent.click(screen.getByRole("button", { name: "Send all 5" }));
    confirm(5);
    await waitFor(() => expect(screen.getByText("5 passes sent.")).toBeInTheDocument());
    sendsTo(["hana", "hugo", "mia", "jo", "kim"]);
    expect(screen.getByText("Everyone accepted has their pass.")).toBeInTheDocument();
  });

  it("says so when a send fails", async () => {
    oldFunction = true;
    page();
    fireEvent.click(screen.getByRole("button", { name: "Send 1 judge pass" }));
    confirm(1);
    await waitFor(() => expect(screen.getByText(/Nothing was sent/)).toBeInTheDocument());
    expect(calls).toEqual([]);
  });

  it("lists who has a pass on Sent, by role, with the date and a confirmed Resend", async () => {
    page();
    fireEvent.click(screen.getByRole("tab", { name: "Sent 1" }));
    expect(names(group("Judges"))).toEqual(["jay"]);
    expect(screen.queryByText("flip-sent")).not.toBeInTheDocument();
    expect(screen.getByText("jay@example.com")).toBeInTheDocument();
    expect(screen.getByText(/^Sent .*2026/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Resend pass to jay" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(calls).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Resend pass to jay" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, resend" }));
    await waitFor(() => expect(screen.getByText("New pass sent to jay.")).toBeInTheDocument());
    sendsTo(["jay"], true);
  });

  it("searches Sent too", () => {
    page();
    fireEvent.click(screen.getByRole("tab", { name: "Sent 1" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
    expect(screen.getByText("Nobody matches that search.")).toBeInTheDocument();
  });

  it("arrives from a table's Send pass with those people selected, and says about the rest", () => {
    page(rows, ["hana", "jay", "lee", "rej"]);
    expect(screen.getByRole("checkbox", { name: "Select hana" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Select lee" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Select hugo" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Release decisions & send passes to 2 selected" })).toBeEnabled();
    expect(screen.getByText(/you picked in the table/).textContent).toBe(
      "Selected 2 of the 4 you picked in the table. 1 already has a pass (see Sent). 1 can't get one (not accepted).",
    );
  });

  it("opens on Sent when everyone picked in a table already has a pass", () => {
    page(rows, ["jay"]);
    expect(screen.getByRole("tab", { name: "Sent 1" })).toHaveAttribute("aria-selected", "true");
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

  it("offers Send pass for someone picked to accept, so the Passes page can say why there's no code", () => {
    const onSendPasses = vi.fn();
    render(<ApplicationsTable kind="hacker" rows={rows} onChanged={() => {}} onSendPasses={onSendPasses} />);
    fireEvent.click(screen.getByRole("tab", { name: /Accepted/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select picked-1" }));
    fireEvent.click(screen.getByRole("button", { name: /Send pass/ }));
    expect(onSendPasses).toHaveBeenCalledWith(["picked-1"]);
  });
});
