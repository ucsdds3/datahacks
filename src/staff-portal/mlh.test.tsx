import { useEffect, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// MLH's checkboxes on the hacker application, the card for people who applied
// before MLH was switched on, and the privacy notice above Submit. MLH is on
// here when the event's mlh_required is (MLH_ENABLED is false in config.ts;
// mlhFlag.test.tsx covers the flag).

const db = vi.hoisted(() => ({
  session: { user: { id: "u1", email: "ada@example.com" } } as null | { user: { id: string; email: string } },
  listeners: [] as ((event: string, session: unknown) => void)[],
  mlhRequired: false,
  /** Once the database refuses a submission for missing MLH boxes, the switch reads as on. */
  turnOnAfterRefusal: false,
  insertError: null as null | { code?: string; message: string },
  inserts: [] as Record<string, unknown>[],
  consent: null as null | { mlh_code_of_conduct: boolean; mlh_data_sharing: boolean; mlh_emails_opt_in: boolean },
  rpcCalls: [] as { name: string; args: Record<string, unknown> }[],
  rpcError: null as null | { message: string },
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: db.session } }),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        db.listeners.push(cb);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signOut: async () => {},
    },
    from: (table: string) => {
      let columns = "";
      const result = async () =>
        table === "events"
          ? { data: columns.includes("mlh_required") ? { mlh_required: db.mlhRequired } : { id: "event-1" }, error: null }
          : columns.includes("mlh_") ? { data: db.consent, error: null }
          : { data: [], error: null };
      const query = {
        select: (cols: string) => { columns = cols; return query; },
        eq: () => query, in: () => query, order: () => query, limit: result, maybeSingle: result,
        insert: async (row: Record<string, unknown>) => {
          db.inserts.push(row);
          if (db.insertError && db.turnOnAfterRefusal) db.mlhRequired = true;
          return { error: db.insertError };
        },
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => result().then(resolve, reject),
      };
      return query;
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      db.rpcCalls.push({ name, args });
      if (db.rpcError) return { data: null, error: db.rpcError };
      db.consent = { mlh_code_of_conduct: true, mlh_data_sharing: true, mlh_emails_opt_in: args.p_emails_opt_in === true };
      return { data: {}, error: null };
    },
  },
}));

import { AuthProvider, useAuth } from "@/context/AuthContext";
import { EVENT_CODE } from "@/portal/event";
import { draftKey, resetLeaving } from "@/portal/formDraft";
import HackerApplication, { formProblem } from "./HackerApplication";
import StaffApplication from "./StaffApplication";
import { MLH_LINKS, MLH_TEXT, MlhConsentCard, PrivacyNotice } from "./mlh";
import { DATA_RETENTION, MLH_ENABLED } from "./config";
import { GENDERS, GRADUATION_YEARS, HACKATHON_EXPERIENCE, HEARD_ABOUT, LEVELS_OF_STUDY, RACES } from "./formOptions";

const valid = {
  first_name: "Ada", last_name: "Lovelace", phone: "(858) 555-0123", gender: GENDERS[0], race_ethnicity: [RACES[0]],
  birthdate: "2000-01-01", country_of_residence: "United States", city_of_residence: "San Diego",
  level_of_study: LEVELS_OF_STUDY[0], school: "UC San Diego", major: "Data Science", graduation_year: GRADUATION_YEARS[0],
  hackathon_experience: HACKATHON_EXPERIENCE[0], attended_before: false, linkedin_url: "https://www.linkedin.com/in/ada",
  github_url: "https://github.com/ada", devpost_url: "", resume_url: "https://drive.google.com/file/d/x",
  essay_proudest_project: "The analytical engine.", essay_unique_thing: "Poetical science.", essay_goal: "Meet people.",
  funniest_joke: "", lifetime_goal: "", heard_about: [HEARD_ABOUT[0]], wants_travel_stipend: false, travel_region: "",
  travel_method: "", travel_distance: "", travel_stipend_reason: "", agreed_to_terms: true,
};
const blankMlh = { mlh_code_of_conduct: false, mlh_data_sharing: false, mlh_emails_opt_in: false };

const saveDraft = (form: object) =>
  localStorage.setItem(draftKey("hacker", EVENT_CODE, "u1"), JSON.stringify({ v: 1, savedAt: "2026-11-09T18:00:00Z", form }));

function Gate({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [opened, setOpened] = useState(false);
  useEffect(() => { if (session) setOpened(true); }, [session]);
  return opened ? <>{children}</> : null;
}

const wrap = (ui: React.ReactNode, path = "/portal/apply/hacker") =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/portal/apply/hacker" element={<Gate>{ui}</Gate>} />
            <Route path="/portal" element={<h1>portal home</h1>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );

const submitButton = () => screen.findByRole("button", { name: /Submit/i });

beforeEach(() => {
  localStorage.clear();
  resetLeaving();
  db.session = { user: { id: "u1", email: "ada@example.com" } };
  db.listeners = [];
  db.mlhRequired = false;
  db.turnOnAfterRefusal = false;
  db.insertError = null;
  db.inserts = [];
  db.consent = null;
  db.rpcCalls = [];
  db.rpcError = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("MLH's wording", () => {
  it("is off by default (flip MLH_ENABLED in config.ts, or events.mlh_required)", () => {
    expect(MLH_ENABLED).toBe(false);
  });

  it("shows MLH's three checkboxes word for word, with MLH's links", async () => {
    db.mlhRequired = true;
    wrap(<HackerApplication />);
    const coc = await screen.findByRole("checkbox", { name: /MLH Code of Conduct/ });
    const data = screen.getByRole("checkbox", { name: /share my application\/registration information/ });
    const emails = screen.getByRole("checkbox", { name: /occasional emails/ });
    const text = (box: HTMLElement) => box.closest("label")!.querySelector("span")!.textContent!.replace(/\s+/g, " ").replace(/ \*$| \(optional\)$/, "").trim();
    expect(text(coc)).toBe(MLH_TEXT.codeOfConduct);
    expect(text(data)).toBe(MLH_TEXT.dataSharing);
    expect(text(emails)).toBe(MLH_TEXT.emails);
    expect((coc as HTMLInputElement).required).toBe(true);
    expect((data as HTMLInputElement).required).toBe(true);
    expect((emails as HTMLInputElement).required).toBe(false);
    expect(screen.getByRole("link", { name: "MLH Code of Conduct" }).getAttribute("href")).toBe(MLH_LINKS.codeOfConduct);
    expect(screen.getByRole("link", { name: "MLH Contest Terms and Conditions" }).getAttribute("href")).toBe(MLH_LINKS.contestTerms);
    expect(screen.getByRole("link", { name: "MLH Privacy Policy" }).getAttribute("href")).toBe(MLH_LINKS.privacyPolicy);
    expect(screen.getByRole("link", { name: "dev.to" }).getAttribute("href")).toBe(MLH_LINKS.dev);
    for (const link of screen.getAllByRole("link", { name: /MLH|dev\.to/ })) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
    }
  });
});

describe("the hacker application", () => {
  it("MLH off: no MLH section, and nothing MLH in what's saved", async () => {
    saveDraft({ ...valid, mlh_code_of_conduct: true });
    wrap(<HackerApplication />);
    fireEvent.click(await submitButton());
    await screen.findByRole("heading", { name: "portal home" });
    expect(screen.queryByText(/Major League Hacking/)).toBeNull();
    expect(db.inserts).toHaveLength(1);
    expect(Object.keys(db.inserts[0]).filter(k => k.startsWith("mlh_"))).toEqual([]);
  });

  it("MLH on: the required boxes have to be ticked", async () => {
    db.mlhRequired = true;
    saveDraft(valid);
    wrap(<HackerApplication />);
    await screen.findByRole("heading", { name: "Major League Hacking (MLH)" });
    fireEvent.submit((await submitButton()).closest("form")!);
    expect(await screen.findByText("Agree to the MLH Code of Conduct to apply.")).toBeTruthy();
    const coc = screen.getByRole("checkbox", { name: /MLH Code of Conduct/ });
    expect(coc.getAttribute("aria-invalid")).toBe("true");
    await waitFor(() => expect(document.activeElement).toBe(coc));
    expect(db.inserts).toHaveLength(0);

    fireEvent.click(coc);
    fireEvent.submit(coc.closest("form")!);
    expect(await screen.findByText(/Agree to sharing your application with MLH/)).toBeTruthy();
    expect(db.inserts).toHaveLength(0);
  });

  it("MLH on: saves the three answers with the application", async () => {
    db.mlhRequired = true;
    saveDraft(valid);
    wrap(<HackerApplication />);
    fireEvent.click(await screen.findByRole("checkbox", { name: /MLH Code of Conduct/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /share my application/ }));
    fireEvent.click(await submitButton());
    await screen.findByRole("heading", { name: "portal home" });
    expect(db.inserts[0]).toMatchObject({ mlh_code_of_conduct: true, mlh_data_sharing: true, mlh_emails_opt_in: false });
  });

  it("MLH on: the optional emails box is saved when ticked", async () => {
    db.mlhRequired = true;
    saveDraft({ ...valid, mlh_code_of_conduct: true, mlh_data_sharing: true });
    wrap(<HackerApplication />);
    fireEvent.click(await screen.findByRole("checkbox", { name: /occasional emails/ }));
    fireEvent.click(await submitButton());
    await screen.findByRole("heading", { name: "portal home" });
    expect(db.inserts[0]).toMatchObject({ mlh_code_of_conduct: true, mlh_data_sharing: true, mlh_emails_opt_in: true });
  });

  it("the database turned MLH on after the page loaded: it shows the boxes and says what's needed", async () => {
    saveDraft(valid);
    db.insertError = { code: "23514", message: "To apply, agree to the MLH Code of Conduct and to sharing your application with MLH (the MLH checkboxes)." };
    db.turnOnAfterRefusal = true;
    wrap(<HackerApplication />);
    fireEvent.click(await submitButton());
    expect(await screen.findByText("Agree to the MLH Code of Conduct to apply.")).toBeTruthy();
    expect(await screen.findByRole("checkbox", { name: /MLH Code of Conduct/ })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "portal home" })).toBeNull();
  });

  it("formProblem only asks for MLH's boxes while MLH is on", () => {
    const form = { ...valid, ...blankMlh };
    expect(formProblem(form, new Date("2026-11-09"))).toBeNull();
    expect(formProblem(form, new Date("2026-11-09"), true)?.field).toBe("mlh_code_of_conduct");
    expect(formProblem({ ...form, mlh_code_of_conduct: true }, new Date("2026-11-09"), true)?.field).toBe("mlh_data_sharing");
    expect(formProblem({ ...form, mlh_code_of_conduct: true, mlh_data_sharing: true }, new Date("2026-11-09"), true)).toBeNull();
  });
});

describe("the privacy notice above Submit", () => {
  const notice = () => screen.getByRole("region", { name: "Your privacy" });

  it("is on the hacker form whether or not MLH is on, just above Submit", async () => {
    wrap(<HackerApplication />);
    await submitButton();
    const text = notice().textContent!;
    expect(text).toMatch(/What we collect:.*your answers on this form and your sign-in email/);
    expect(text).toMatch(/Who sees it:.*DS3 organizers, and UC San Diego/);
    expect(text).toContain(DATA_RETENTION);
    expect(text).not.toMatch(/Major League Hacking/);
    expect(within(notice()).getByRole("link", { name: "info@ds3.club" }).getAttribute("href")).toBe("mailto:info@ds3.club");
    const actions = (await submitButton()).closest(".sp-form-actions")!;
    expect(actions.previousElementSibling).toBe(notice());
  });

  it("names MLH while MLH is on", async () => {
    db.mlhRequired = true;
    wrap(<HackerApplication />);
    await screen.findByRole("heading", { name: "Major League Hacking (MLH)" });
    expect(notice().textContent).toMatch(/Major League Hacking \(MLH\) too, if you agree above/);
  });

  it("is on the mentor/judge form too", async () => {
    wrap(<StaffApplication />);
    await submitButton();
    expect(notice()).toBeTruthy();
  });

  it("reads as a short list", () => {
    render(<PrivacyNotice />);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });
});

describe("the card for people who applied before MLH was on", () => {
  const renderCard = (preview = false) => wrap(<MlhConsentCard preview={preview} />);

  it("isn't there while MLH is off", async () => {
    db.consent = blankMlh;
    renderCard();
    await new Promise(r => setTimeout(r, 30));
    expect(screen.queryByRole("region", { name: /MLH/ })).toBeNull();
  });

  it("isn't there once they've agreed", async () => {
    db.mlhRequired = true;
    db.consent = { mlh_code_of_conduct: true, mlh_data_sharing: true, mlh_emails_opt_in: false };
    renderCard();
    await new Promise(r => setTimeout(r, 30));
    expect(screen.queryByRole("region", { name: /MLH/ })).toBeNull();
  });

  it("asks for both required boxes, then saves through agree_to_mlh", async () => {
    db.mlhRequired = true;
    db.consent = blankMlh;
    renderCard();
    const card = await screen.findByRole("region", { name: "One more step: MLH" });
    fireEvent.click(within(card).getByRole("button", { name: "Save" }));
    expect(await within(card).findByText("Agree to the MLH Code of Conduct to apply.")).toBeTruthy();
    expect(db.rpcCalls).toHaveLength(0);

    fireEvent.click(within(card).getByRole("checkbox", { name: /MLH Code of Conduct/ }));
    fireEvent.click(within(card).getByRole("checkbox", { name: /share my application/ }));
    fireEvent.click(within(card).getByRole("checkbox", { name: /occasional emails/ }));
    fireEvent.click(within(card).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("We've saved your MLH agreements on your application.")).toBeTruthy();
    expect(db.rpcCalls).toEqual([{ name: "agree_to_mlh", args: { p_event_id: "event-1", p_emails_opt_in: true } }]);
  });

  it("says when saving fails, in the database's words", async () => {
    db.mlhRequired = true;
    db.consent = blankMlh;
    db.rpcError = { message: "You don't have a hacker application for this event." };
    renderCard();
    const card = await screen.findByRole("region", { name: "One more step: MLH" });
    fireEvent.click(within(card).getByRole("checkbox", { name: /MLH Code of Conduct/ }));
    fireEvent.click(within(card).getByRole("checkbox", { name: /share my application/ }));
    fireEvent.click(within(card).getByRole("button", { name: "Save" }));
    expect(await within(card).findByText(/Couldn't save that\. You don't have a hacker application/)).toBeTruthy();
  });

  it("dev ?preview with &mlh shows it without a database", async () => {
    window.history.replaceState(null, "", "/?preview&mlh");
    try {
      renderCard(true);
      expect(await screen.findByRole("region", { name: "One more step: MLH" })).toBeTruthy();
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });
});

describe("the portal home", () => {
  it("shows the card to waitlisted, pending and accepted hackers but not to people who weren't accepted", async () => {
    const { StaffPortalProvider } = await import("./StaffPortalContext");
    const { default: Dashboard } = await import("./Dashboard");
    db.mlhRequired = true;
    db.consent = blankMlh;
    const show = (status: "pending" | "rejected") =>
      render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <AuthProvider>
            <MemoryRouter>
              <StaffPortalProvider application={{ firstName: "Ada", lastName: "L", type: "hacker", status, submittedAt: null }} preview={false}>
                <Dashboard />
              </StaffPortalProvider>
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>,
      );
    const pending = show("pending");
    expect(await screen.findByRole("region", { name: "One more step: MLH" })).toBeTruthy();
    pending.unmount();
    show("rejected");
    await waitFor(() => expect(screen.getByText(/Hello, Ada/)).toBeTruthy());
    await new Promise(r => setTimeout(r, 30));
    expect(screen.queryByRole("region", { name: "One more step: MLH" })).toBeNull();
  });
});
