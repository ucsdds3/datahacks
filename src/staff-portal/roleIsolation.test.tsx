import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";

/*
 * Role isolation, through the real route table in App.tsx: what someone signed in as a
 * hacker (any status, or with no application), a mentor or a judge gets on every mentor,
 * judge, hybrid and organizer address, including the odd ones (case, trailing slash,
 * percent-encoding, ?preview, ?as=, a stale "apply as staff" in localStorage).
 *
 * The role only ever comes from the database (the person's own applications row and
 * event_roles, both behind row-level security), so the mock below answers as the
 * database would for that person. Each page component is wrapped so the test sees every
 * render, not just what's on screen at the end: a staff page must never render, not
 * even for one frame before a redirect.
 *
 * Runs as a production build would: the dev-only `?preview` (mock data for any section,
 * no sign-in) is switched off, as `vite build` compiles it out.
 */
vi.hoisted(() => { vi.stubEnv("DEV", false); vi.stubEnv("PROD", true); });

type Row = { first_name: string; last_name: string; applicant_type: string; status: string; id: string; email: string; submitted_at: string };

const db = vi.hoisted(() => ({
  session: null as null | { user: { id: string; email: string } },
  application: null as null | Row,
  roles: [] as { role: string }[],
  /** While set, reads of applications wait for it (to look at the screen before the role is known). */
  hold: null as null | Promise<void>,
  authListener: null as null | ((event: string, session: unknown) => void),
}));

/** Every page render: which page, at which address, for which account. */
const renders = vi.hoisted(() => [] as { page: string; path: string; user: string | null }[]);
/** Who the organizer console showed as signed in, each time it rendered past its gate. */
const consoleRenders = vi.hoisted(() => [] as string[]);

vi.mock("@/lib/supabaseClient", () => {
  const result = async (table: string) => {
    if (table === "events") return { data: { id: "event-1", mlh_required: false, applications_open: true, applications_open_at: null }, error: null };
    if (table === "event_roles") return { data: db.roles, error: null };
    if (table === "applications") {
      if (db.hold) await db.hold;
      return { data: db.application ? [db.application] : [], error: null };
    }
    return { data: null, error: null };
  };
  const query = (table: string) => {
    const q: Record<string, unknown> = {
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => result(table).then(resolve, reject),
      limit: () => result(table),
      maybeSingle: async () => {
        const r = await result(table);
        return { ...r, data: Array.isArray(r.data) ? r.data[0] ?? null : r.data };
      },
    };
    for (const m of ["select", "eq", "in", "order", "not", "is", "gte", "lte", "range", "neq", "or"]) q[m] = () => q;
    return q;
  };
  return {
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: db.session } }),
        onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
          db.authListener = callback;
          return { data: { subscription: { unsubscribe: () => {} } } };
        },
        signOut: async () => ({ error: null }),
      },
      from: query,
      rpc: async () => ({ data: [], error: null }),
      functions: { invoke: async () => ({ data: null, error: null }) },
      channel: () => ({ on() { return this; }, subscribe() { return this; } }),
      removeChannel: () => {},
    },
  };
});

// The pages fetch each other in the background once the portal opens; not needed here.
vi.mock("@/portal/pages", async original => ({ ...(await original<typeof import("@/portal/pages")>()), prefetchPortalPages: () => {} }));

// Record every render of each portal page (and still render the real page).
function spy<P extends object>(page: string, Real: ComponentType<P>) {
  return (props: P) => {
    renders.push({ page, path: window.location.pathname, user: db.session?.user.id ?? null });
    return <Real {...props} />;
  };
}
vi.mock("@/staff-portal/Dashboard", async o => ({ ...(await o<object>()), default: spy("Status", (await o<{ default: ComponentType }>()).default) }));
vi.mock("@/staff-portal/Questions", async o => ({ default: spy("Questions", (await o<{ default: ComponentType }>()).default) }));
vi.mock("@/staff-portal/Handbook", async o => ({ default: spy("Handbook", (await o<{ default: ComponentType }>()).default) }));
vi.mock("@/staff-portal/Schedule", async o => ({ default: spy("Schedule", (await o<{ default: ComponentType }>()).default) }));
vi.mock("@/staff-portal/Waiver", async o => ({ default: spy("Waiver", (await o<{ default: ComponentType }>()).default) }));
vi.mock("@/staff-portal/Mentors", async o => ({ default: spy("Mentors", (await o<{ default: ComponentType }>()).default) }));
vi.mock("@/staff-portal/JudgingPortal", async o => ({ default: spy("Judging", (await o<{ default: ComponentType }>()).default) }));
vi.mock("@/staff-portal/HackerGuide", async o => ({ default: spy("HackerGuide", (await o<{ default: ComponentType<{ page: string }> }>()).default) }));
// The console renders "Signed in as" only once it has decided the person is an organizer.
vi.mock("@/staff-portal/StaffPortalLayout", async o => {
  const real = await o<typeof import("@/staff-portal/StaffPortalLayout")>();
  return {
    ...real,
    SignedInAs: (props: Parameters<typeof real.SignedInAs>[0]) => {
      if (window.location.pathname.startsWith("/portal/organizer")) consoleRenders.push(props.email);
      return real.SignedInAs(props);
    },
  };
});

import App from "@/App";

/** Text that only a mentor, judge or organizer view has. */
const STAFF_ONLY = [
  "Mentor Handbook", "Judge Handbook", "Mentor & Judge Handbook", "Judging Portal", "Scoring, assignments and submissions",
  "Judge arrival", "Judge briefing", "First-round judging", "Second-round judging", "Mentor office hours",
  "Organizer console", "Hacker applications", "Mentor & judge applications",
];
const JUDGE_ONLY = ["Judge Handbook", "Mentor & Judge Handbook", "Judging Portal", "Scoring, assignments and submissions", "Judge arrival", "Judge briefing", "First-round judging", "Second-round judging"];
const MENTOR_ONLY = ["Mentor Handbook", "Mentor & Judge Handbook", "Mentor office hours"];

/** Everything that was ever put on the page, including nodes React removed again. */
let seenText: string[] = [];
let observer: MutationObserver | null = null;

let userCount = 0;
function signIn(type: string | null, status = "accepted") {
  // A new account each time: App's query cache lives as long as the module.
  const id = `user-${++userCount}`;
  db.session = { user: { id, email: `${id}@example.com` } };
  db.application = type && {
    id: `app-${id}`, first_name: "Pat", last_name: "Lee", applicant_type: type, status,
    email: `${id}@example.com`, submitted_at: "2026-11-01T12:00:00Z",
  };
  db.roles = type && status === "accepted"
    ? (type === "hybrid" ? ["mentor", "judge"] : [type]).map(role => ({ role }))
    : [];
  return id;
}

function visit(path: string) {
  window.history.replaceState(null, "", path);
  observer?.disconnect();
  observer = new MutationObserver(records => {
    for (const r of records) {
      r.addedNodes.forEach(n => seenText.push(n.textContent ?? ""));
      if (r.type === "characterData") seenText.push(r.target.textContent ?? "");
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  return render(<App />);
}

const where = () => window.location.pathname;
const everSeen = (text: string) => seenText.some(t => t.includes(text)) || document.body.textContent!.includes(text);
const neverShown = (markers: string[]) => markers.filter(everSeen);
const pagesRendered = () => renders.map(r => `${r.page}@${r.path}`);

beforeEach(() => {
  db.session = null;
  db.application = null;
  db.roles = [];
  db.hold = null;
  renders.length = 0;
  consoleRenders.length = 0;
  seenText = [];
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  observer?.disconnect();
  observer = null;
});

// Every page of the mentor, judge and hybrid sections, and the pages only hackers have.
const STAFF_PORTALS = ["mentor", "judge", "hybrid"] as const;
const PAGES = ["", "/questions", "/handbook", "/schedule", "/waiver", "/judging", "/mentors", "/resources"];
const STAFF_URLS = STAFF_PORTALS.flatMap(portal => PAGES.map(page => `/portal/${portal}${page}`));

// Ways to write the same address.
const ODD_URLS = [
  "/portal/judge/judging/",
  "/portal/Judge/judging",
  "/portal/JUDGE/JUDGING",
  "/portal/judge/Judging",
  "/portal/hybrid/judging?x=1",
  "/portal/judge/judging?preview&status=accepted",
  "/portal/judge/judging?as=judge",
  "/portal/judge/judging#scores",
  "/portal/%6Audge/judging",
  "/portal/judge/%6Audging",
  "/portal/judge/judging/..",
  "/portal/hacker/../judge/judging",
  "/portal/Mentor/handbook",
  "/portal/mentor/handbook/",
  "/portal/hybrid/schedule?preview",
  "/portal/hacker/judging",
  "/portal/mentor/judging",
];

/** The pages each section has a route for; any other address in it is the 404 page. */
const ROUTES: Record<(typeof STAFF_PORTALS)[number], string[]> = {
  mentor: ["", "/questions", "/handbook", "/schedule", "/waiver"],
  judge: ["", "/questions", "/handbook", "/schedule", "/waiver", "/judging"],
  hybrid: ["", "/questions", "/handbook", "/schedule", "/waiver", "/judging"],
};
/** The hacker pages open once accepted (of those above); before that, Status and Application. */
const HACKER_OPEN_WHEN_ACCEPTED = ["", "/questions", "/schedule", "/waiver", "/mentors", "/resources"];
const NOT_FOUND = "Page not found";

describe("a signed-in hacker on mentor, judge and hybrid addresses", () => {
  describe.each(["accepted", "submitted", "waitlisted", "rejected"])("%s hacker", status => {
    it.each(STAFF_URLS)("%s -> their own section, no staff page rendered", async url => {
      const user = signIn("hacker", status);
      visit(url);
      const [, portal, page] = url.match(/^\/portal\/([a-z]+)(.*)$/)! as unknown as [string, keyof typeof ROUTES, string];
      if (!ROUTES[portal].includes(page)) {
        // No such page in that section: the 404 page, and nothing of the section's.
        expect(await screen.findByText(NOT_FOUND)).toBeInTheDocument();
        expect(where()).toBe(url);
        expect(renders).toEqual([]);
      } else {
        // Same page in their own section when they can open it there; the handbook is Resources for hackers.
        const own = page === "/handbook" ? "/resources" : page;
        const open = status === "accepted" ? HACKER_OPEN_WHEN_ACCEPTED.includes(own) : own === "/questions" || own === "";
        await waitFor(() => expect(where()).toBe(`/portal/hacker${open ? own : ""}`));
        await waitFor(() => expect(renders.length).toBeGreaterThan(0));
      }
      expect(renders.every(r => r.path.startsWith("/portal/hacker") && r.user === user), pagesRendered().join(", ")).toBe(true);
      expect(pagesRendered().filter(p => /^(Handbook|Judging)@/.test(p))).toEqual([]);
      expect(neverShown(STAFF_ONLY)).toEqual([]);
    });
  });

  it.each(ODD_URLS)("accepted hacker: %s", async url => {
    signIn("hacker");
    visit(url);
    await waitFor(() => expect(where().startsWith("/portal/hacker") || document.body.textContent!.includes(NOT_FOUND)).toBe(true));
    // Give any redirect time to finish, then look at everything that was ever rendered.
    await act(() => new Promise(r => setTimeout(r, 50)));
    expect(renders.every(r => r.path.startsWith("/portal/hacker")), pagesRendered().join(", ")).toBe(true);
    expect(pagesRendered().filter(p => /^(Handbook|Judging)@/.test(p))).toEqual([]);
    expect(neverShown(STAFF_ONLY)).toEqual([]);
  });

  it("nothing in this browser can make the portal think they're staff", async () => {
    signIn("hacker", "submitted");
    // What the sign-in page and the callback remember, and keys someone might try.
    localStorage.setItem("datahacks.applyAs", "staff");
    localStorage.setItem("datahacks.role", "judge");
    localStorage.setItem("datahacks.staffPortal.waiverSubmitted.DH27.preview", "true");
    sessionStorage.setItem("datahacks.testTab", "judge");
    visit("/portal/judge/judging?as=staff&role=judge&preview&status=accepted&type=judge");
    await waitFor(() => expect(where()).toBe("/portal/hacker"));
    expect(await screen.findByText("Under review", { selector: ".sp-status" })).toBeInTheDocument();
    expect(neverShown(STAFF_ONLY)).toEqual([]);
  });

  it("renders nothing from the section until the database has answered", async () => {
    signIn("hacker");
    let answer!: () => void;
    db.hold = new Promise(resolve => { answer = resolve; });
    visit("/portal/judge/judging");
    expect(await screen.findByText("Loading your portal…")).toBeInTheDocument();
    await act(() => new Promise(r => setTimeout(r, 50)));
    expect(renders).toEqual([]);
    expect(screen.queryByRole("navigation", { name: "Portal" })).toBeNull();
    answer();
    await waitFor(() => expect(where()).toBe("/portal/hacker"));
    expect(neverShown(STAFF_ONLY)).toEqual([]);
  });
});

describe("signed in without an application", () => {
  it.each(STAFF_URLS)("%s -> the mentor/judge form, no portal page rendered", async url => {
    signIn(null);
    visit(url);
    const [, portal, page] = url.match(/^\/portal\/([a-z]+)(.*)$/)! as unknown as [string, keyof typeof ROUTES, string];
    if (ROUTES[portal].includes(page)) await waitFor(() => expect(where()).toBe("/portal/apply/mentor-judge"));
    else expect(await screen.findByText(NOT_FOUND)).toBeInTheDocument();
    expect(renders).toEqual([]);
    expect(neverShown(STAFF_ONLY)).toEqual([]);
  });

  it("a stale 'apply as staff' doesn't open anything either", async () => {
    signIn(null);
    localStorage.setItem("datahacks.applyAs", "staff");
    visit("/portal/hacker/mentors");
    await waitFor(() => expect(where()).toBe("/portal/apply"));
    expect(renders).toEqual([]);
  });
});

describe("signed out", () => {
  it.each(["/portal/judge/judging", "/portal/mentor/handbook", "/portal/hybrid/schedule"])("%s -> sign in, nothing rendered", async url => {
    visit(url);
    await waitFor(() => expect(where()).toMatch(/^\/login\/(judge|mentor)$/));
    expect(renders).toEqual([]);
    expect(neverShown(STAFF_ONLY)).toEqual([]);
  });
});

describe("mentors and judges stay in their own section", () => {
  // The markers and page spies above are real: staff do get these.
  it.each([
    ["judge", "/portal/judge/judging", "Judging", ["Judging Portal", "Scoring, assignments and submissions"]],
    ["judge", "/portal/judge/schedule", "Schedule", ["Judge briefing", "First-round judging"]],
    ["mentor", "/portal/mentor/schedule", "Schedule", ["Mentor office hours"]],
    ["hybrid", "/portal/hybrid/handbook", "Handbook", ["Mentor & Judge Handbook", "Judging Portal"]],
  ])("an accepted %s on %s gets the page", async (type, url, page, markers) => {
    signIn(type);
    visit(url);
    await waitFor(() => expect(pagesRendered()).toContain(`${page}@${url}`));
    for (const marker of markers) await waitFor(() => expect(document.body.textContent).toContain(marker));
  });

  it.each([
    "/portal/judge/judging", "/portal/hybrid/judging", "/portal/mentor/judging", "/portal/Judge/judging", "/portal/hybrid/judging/",
    "/portal/judge", "/portal/hybrid", "/portal/judge/handbook", "/portal/hybrid/schedule",
  ])("accepted mentor: %s", async url => {
    signIn("mentor");
    visit(url);
    await waitFor(() => expect(where().startsWith("/portal/mentor") || document.body.textContent!.includes(NOT_FOUND)).toBe(true));
    await act(() => new Promise(r => setTimeout(r, 50)));
    expect(renders.every(r => r.path.startsWith("/portal/mentor")), pagesRendered().join(", ")).toBe(true);
    expect(pagesRendered().filter(p => p.startsWith("Judging@"))).toEqual([]);
    expect(neverShown(JUDGE_ONLY)).toEqual([]);
  });

  it.each(["/portal/mentor/schedule", "/portal/hybrid/schedule", "/portal/mentor/handbook", "/portal/hacker/mentors"])("accepted judge: %s", async url => {
    signIn("judge");
    visit(url);
    await waitFor(() => expect(where().startsWith("/portal/judge")).toBe(true));
    await act(() => new Promise(r => setTimeout(r, 50)));
    expect(renders.every(r => r.path.startsWith("/portal/judge")), pagesRendered().join(", ")).toBe(true);
    expect(pagesRendered().filter(p => p.startsWith("Mentors@"))).toEqual([]);
    expect(neverShown(MENTOR_ONLY)).toEqual([]);
  });

  it("a mentor still under review gets no staff pages", async () => {
    signIn("mentor", "submitted");
    visit("/portal/mentor/handbook");
    await waitFor(() => expect(where()).toBe("/portal/mentor"));
    expect(pagesRendered()).toEqual(["Status@/portal/mentor"]);
    expect(neverShown(["Mentor Handbook", "Mentor office hours"])).toEqual([]);
  });
});

describe("the organizer console", () => {
  it.each([
    ["no application", null, "accepted"],
    ["accepted hacker", "hacker", "accepted"],
    ["pending hacker", "hacker", "submitted"],
    ["mentor", "mentor", "accepted"],
    ["judge", "judge", "accepted"],
    ["hybrid", "hybrid", "accepted"],
  ])("%s: 'Organizers only', the console never renders", async (_, type: string | null, status) => {
    signIn(type, status);
    for (const url of ["/portal/organizer", "/portal/organizer/", "/portal/Organizer", "/portal/organizer?preview"]) {
      const view = visit(url);
      expect(await screen.findByText("Organizers only")).toBeInTheDocument();
      view.unmount();
    }
    expect(consoleRenders).toEqual([]);
    expect(neverShown(["Organizer console", "Hacker applications", "Mentor & judge applications"])).toEqual([]);
  });

  it("opens for an organizer (so the checks above aren't passing on a broken page)", async () => {
    const id = signIn(null);
    db.roles = [{ role: "organizer" }];
    visit("/portal/organizer");
    expect(await screen.findByText("Organizer console")).toBeInTheDocument();
    expect(consoleRenders).toContain(`${id}@example.com`);
  });

  it("when another tab signs this browser in as a hacker, the console never shows them, not even for a frame", async () => {
    signIn(null);
    db.roles = [{ role: "organizer" }];
    visit("/portal/organizer");
    expect(await screen.findByText("Organizer console")).toBeInTheDocument();

    const hacker = signIn("hacker");
    act(() => db.authListener!("SIGNED_IN", db.session));
    expect(await screen.findByText("Organizers only")).toBeInTheDocument();
    expect(consoleRenders).not.toContain(`${hacker}@example.com`);
  });
});
