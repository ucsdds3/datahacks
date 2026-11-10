import { useEffect, useState } from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// The hacker and mentor/judge forms keep a draft of what's typed (localStorage, per
// account and event), restore it, delete it after submitting or signing out, and
// keep the answers on screen when the session ends mid-form.

const db = vi.hoisted(() => ({
  session: { user: { id: "u1", email: "ada@example.com" } } as null | { user: { id: string; email: string } },
  listeners: [] as ((event: string, session: unknown) => void)[],
  insertError: null as null | { code?: string; message: string },
  inserts: [] as Record<string, unknown>[],
  invokes: [] as { name: string; body: unknown }[],
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
      signInWithOAuth: async () => ({ error: null }),
    },
    from: (table: string) => {
      const result = async () => (table === "events" ? { data: { id: "event-1" }, error: null } : { data: [], error: null });
      const query = {
        select: () => query, eq: () => query, in: () => query, order: () => query, limit: result, maybeSingle: result,
        insert: async (row: Record<string, unknown>) => { db.inserts.push(row); return { error: db.insertError }; },
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => result().then(resolve, reject),
      };
      return query;
    },
    functions: {
      invoke: async (name: string, options?: { body?: unknown }) => {
        db.invokes.push({ name, body: options?.body });
        return { data: { sent: 1 }, error: null };
      },
    },
  },
}));

import { AuthProvider, useAuth } from "@/context/AuthContext";
import { EVENT_CODE } from "@/portal/event";
import { draftKey, resetLeaving } from "@/portal/formDraft";
import { forgetReceivedEmailRequests } from "@/portal/receivedEmail";
import { signOutEverywhere } from "@/portal/signIn";
import HackerApplication from "./HackerApplication";
import StaffApplication from "./StaffApplication";
import { GENDERS, GRADUATION_YEARS, HACKATHON_EXPERIENCE, HEARD_ABOUT, LEVELS_OF_STUDY, RACES } from "./formOptions";

const HACKER_KEY = draftKey("hacker", EVENT_CODE, "u1");

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

const saveDraft = (form: object, key = HACKER_KEY) =>
  localStorage.setItem(key, JSON.stringify({ v: 1, savedAt: "2026-11-09T18:00:00Z", form }));
const savedForm = (key = HACKER_KEY) => {
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw).form as Record<string, unknown>) : null;
};

/** Like ApplyLayout: the form opens once there's a session, and stays open if it ends. */
function Gate({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [opened, setOpened] = useState(false);
  useEffect(() => { if (session) setOpened(true); }, [session]);
  return opened ? <>{children}</> : null;
}

function renderForm(form: "hacker" | "staff" = "hacker") {
  const path = form === "hacker" ? "/portal/apply/hacker" : "/portal/apply/mentor-judge";
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/portal/apply/hacker" element={<Gate><HackerApplication /></Gate>} />
            <Route path="/portal/apply/mentor-judge" element={<Gate><StaffApplication /></Gate>} />
            <Route path="/portal" element={<h1>portal home</h1>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  resetLeaving();
  db.session = { user: { id: "u1", email: "ada@example.com" } };
  db.listeners = [];
  db.insertError = null;
  db.inserts = [];
  db.invokes = [];
  forgetReceivedEmailRequests();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

async function mountWithSession(form: "hacker" | "staff" = "hacker") {
  const view = renderForm(form);
  await screen.findByRole("button", { name: /Submit/i });
  return view;
}

describe("application drafts", () => {
  it("saves what's typed, per account and event, after a short pause", async () => {
    await mountWithSession();
    fireEvent.change(screen.getByLabelText(/First name/), { target: { value: "Ada" } });
    await waitFor(() => expect(savedForm(draftKey("hacker", EVENT_CODE, "u1"))?.first_name).toBe("Ada"), { timeout: 2000 });
    expect(HACKER_KEY.startsWith("datahacks.")).toBe(true); // signOutEverywhere clears datahacks.*
  });

  it("restores a saved draft when the form opens again", async () => {
    saveDraft({ ...valid, essay_goal: "Ship something." });
    await mountWithSession();
    expect(screen.getByLabelText(/First name/)).toHaveValue("Ada");
    expect(screen.getByLabelText(/get out of this event/)).toHaveValue("Ship something.");
    expect(screen.getByText(/We restored the answers you saved/)).toBeInTheDocument();
  });

  it("ignores another account's draft and answers of the wrong shape", async () => {
    saveDraft({ ...valid, first_name: "Someone else" }, draftKey("hacker", EVENT_CODE, "u2"));
    saveDraft({ last_name: 42, race_ethnicity: "not a list" });
    await mountWithSession();
    expect(screen.getByLabelText(/First name/)).toHaveValue("");
    expect(screen.getByLabelText(/Last name/)).toHaveValue("");
  });

  it("deletes the draft after a successful submit", async () => {
    saveDraft(valid);
    await mountWithSession();
    fireEvent.submit(screen.getByRole("button", { name: /Submit application/ }).closest("form")!);
    expect(await screen.findByText("portal home")).toBeInTheDocument();
    expect(db.inserts).toHaveLength(1);
    expect(db.inserts[0]).toMatchObject({ first_name: "Ada", user_id: "u1", email: "ada@example.com" });
    expect(localStorage.getItem(HACKER_KEY)).toBeNull();
  });

  it("is deleted by signing out, and an open form doesn't write it back", async () => {
    saveDraft(valid);
    await mountWithSession();
    await act(async () => { await signOutEverywhere(); });
    expect(localStorage.getItem(HACKER_KEY)).toBeNull();
    fireEvent.change(screen.getByLabelText(/First name/), { target: { value: "Ada B." } });
    await new Promise(r => setTimeout(r, 600));
    expect(localStorage.getItem(HACKER_KEY)).toBeNull();
  });

  it("asks before leaving the page while there are unsubmitted answers", async () => {
    await mountWithSession();
    const leave = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(leave()).toBe(false);
    fireEvent.change(screen.getByLabelText(/First name/), { target: { value: "Ada" } });
    expect(leave()).toBe(true);
    // ...and saves first, so even leaving right away keeps the answer.
    expect(savedForm()?.first_name).toBe("Ada");
  });

  it("start over clears the restored answers", async () => {
    saveDraft(valid);
    await mountWithSession();
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.getByLabelText(/First name/)).toHaveValue("");
    expect(localStorage.getItem(HACKER_KEY)).toBeNull();
  });

  it("keeps the mentor/judge form's answers too, with the email from the account", async () => {
    saveDraft({ first_name: "Grace", email: "spoof@example.com" }, draftKey("staff", EVENT_CODE, "u1"));
    await mountWithSession("staff");
    expect(screen.getByLabelText(/First name/)).toHaveValue("Grace");
    expect(screen.getByLabelText(/^Email/)).toHaveValue("ada@example.com");
  });
});

describe("the \"we've received your application\" email", () => {
  const staffDraft = {
    first_name: "Grace", last_name: "Hopper", phone: "(858) 555-0123", organization: "Navy", role_title: "Admiral",
    linkedin_url: "https://www.linkedin.com/in/grace", ucsd_affiliation: "none", applicant_type: "judge",
    judging_track: "finance", acknowledged_in_person_judging: true, acknowledged_in_person: true,
  };

  it("the hacker form asks the server for it once the application is in, with nothing about who or what", async () => {
    saveDraft(valid);
    await mountWithSession();
    fireEvent.submit(screen.getByRole("button", { name: /Submit application/ }).closest("form")!);
    expect(await screen.findByText("portal home")).toBeInTheDocument();
    expect(db.invokes).toEqual([{ name: "send-received-email", body: {} }]);
  });

  it("so does the mentor/judge form", async () => {
    saveDraft(staffDraft, draftKey("staff", EVENT_CODE, "u1"));
    await mountWithSession("staff");
    fireEvent.submit(screen.getByRole("button", { name: /Submit Application/ }).closest("form")!);
    expect(await screen.findByText("portal home")).toBeInTheDocument();
    expect(db.inserts[0]).toMatchObject({ applicant_type: "judge" });
    expect(db.invokes).toEqual([{ name: "send-received-email", body: {} }]);
  });

  it("isn't asked for when the submit fails", async () => {
    saveDraft(valid);
    db.insertError = { code: "23505", message: "duplicate key value violates unique constraint" };
    await mountWithSession();
    fireEvent.submit(screen.getByRole("button", { name: /Submit application/ }).closest("form")!);
    await screen.findByRole("alert");
    expect(db.invokes).toEqual([]);
  });
});

describe("signed out mid-form", () => {
  it("keeps the answers on screen, says so, and saves the draft again", async () => {
    saveDraft(valid);
    await mountWithSession();
    // Another tab's sign-out cleared storage, then this tab heard about it.
    localStorage.removeItem(HACKER_KEY);
    db.session = null;
    act(() => db.listeners.forEach(cb => cb("SIGNED_OUT", null)));
    expect(await screen.findByText(/You were signed out\./)).toBeInTheDocument();
    expect(screen.getByText(/your answers are saved on this device/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in again" })).toBeInTheDocument();
    expect(screen.getByLabelText(/First name/)).toHaveValue("Ada");
    expect(screen.getByRole("button", { name: /Submit application/ })).toBeDisabled();
    await waitFor(() => expect(savedForm()?.first_name).toBe("Ada"));
  });

  it("an expired sign-in found on submit shows the same notice, not the raw error", async () => {
    saveDraft(valid);
    db.insertError = { code: "PGRST301", message: "JWT expired" };
    await mountWithSession();
    fireEvent.submit(screen.getByRole("button", { name: /Submit application/ }).closest("form")!);
    expect(await screen.findByText(/You were signed out\./)).toBeInTheDocument();
    expect(screen.queryByText(/JWT/)).toBeNull();
    expect(savedForm()?.first_name).toBe("Ada");
  });
});

describe("submit errors", () => {
  it("says applications are closed, not that answers are missing", async () => {
    saveDraft(valid);
    db.insertError = { code: "23514", message: "Applications for DataHacks 2027 aren't open right now." };
    await mountWithSession();
    fireEvent.submit(screen.getByRole("button", { name: /Submit application/ }).closest("form")!);
    const alert = await screen.findByText(/Applications for DataHacks 2027 aren't open right now\./);
    expect(alert).toHaveTextContent("Your answers are saved on this device.");
    expect(screen.queryByText(/missing or in a format/)).toBeNull();
  });

  it("a network failure is plain English, and the answers stay", async () => {
    saveDraft(valid);
    db.insertError = { code: "", message: "TypeError: Failed to fetch" };
    await mountWithSession();
    fireEvent.submit(screen.getByRole("button", { name: /Submit application/ }).closest("form")!);
    expect(await screen.findByText(/couldn't reach DataHacks/)).toBeInTheDocument();
    expect(screen.queryByText(/TypeError/)).toBeNull();
    expect(screen.getByLabelText(/First name/)).toHaveValue("Ada");
  });

  it("focuses and marks the field a form-level problem is about", async () => {
    saveDraft({ ...valid, linkedin_url: "http://linkedin.com/in/ada" });
    await mountWithSession();
    fireEvent.submit(screen.getByRole("button", { name: /Submit application/ }).closest("form")!);
    const field = screen.getByLabelText(/LinkedIn profile/);
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field.closest("label")).toHaveClass("sp-field-error");
    expect(screen.getByRole("alert")).toHaveTextContent(/starting with https/);
    await waitFor(() => expect(document.activeElement).toBe(field));
    // Fixing it clears the mark.
    fireEvent.change(field, { target: { value: "https://linkedin.com/in/ada" } });
    expect(field).not.toHaveAttribute("aria-invalid");
  });
});
