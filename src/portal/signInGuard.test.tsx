import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// The site shares one Supabase session per browser: every Google sign-in button
// asks before replacing an account that's already signed in.
const db = vi.hoisted(() => ({
  session: null as null | { user: { id: string; email: string } },
  roles: [] as { role: string }[],
  calls: [] as string[],
  authListener: null as null | ((event: string, session: unknown) => void),
}));
const toast = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({ toast }));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: db.session } }),
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
        db.authListener = callback;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signOut: vi.fn(async () => { db.calls.push("signOut"); db.session = null; return { error: null }; }),
      signInWithOAuth: vi.fn(async (options: { options: { redirectTo: string; queryParams: Record<string, string> } }) => {
        db.calls.push(`oauth ${options.options.redirectTo} ${options.options.queryParams.prompt}`);
        return { error: null };
      }),
    },
    from: (table: string) => {
      const result = async () =>
        table === "events" ? { data: { id: "event-1" }, error: null }
        : table === "event_roles" ? { data: db.roles, error: null }
        : { data: [], error: null };
      const query = {
        select: () => query, eq: () => query, in: () => query, order: () => query, limit: result, maybeSingle: result,
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => result().then(resolve, reject),
      };
      return query;
    },
  },
}));

import { AuthProvider } from "@/context/AuthContext";
import SignIn from "@/pages/SignIn";
import { ApplyButton } from "@/themes/minecraft/ApplyButton";
import { PortalFrame, SignedInAs } from "@/staff-portal/StaffPortalLayout";
import { AccountWatcher } from "./AccountWatcher";
import type { SignInAs as As } from "./signIn";

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

function renderSignIn(as: As, path = "/login/hacker") {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={path} element={<SignIn as={as} />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

const jane = { user: { id: "u1", email: "jane.personal@gmail.com" } };

beforeEach(() => {
  db.session = null;
  db.roles = [];
  db.calls = [];
  toast.mockClear();
  localStorage.clear();
});

describe("sign-in page", () => {
  it("goes straight to Google when nobody is signed in, as before", async () => {
    renderSignIn("hacker");
    fireEvent.click(await screen.findByRole("button", { name: "Continue with Google" }));
    await waitFor(() => expect(db.calls).toHaveLength(1));
    expect(db.calls[0]).toMatch(/^oauth .*\/auth\/callback\?as=hacker select_account$/);
    expect(screen.queryByText(/You're signed in as/)).not.toBeInTheDocument();
  });

  it("asks first when this browser is already signed in, and doesn't start Google", async () => {
    db.session = jane;
    renderSignIn("hacker");
    expect(await screen.findByText(/You're signed in as/)).toHaveTextContent("You're signed in as jane.personal@gmail.com.");
    expect(screen.queryByRole("button", { name: "Continue with Google" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue as jane.personal@gmail.com" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use a different account" })).toBeInTheDocument();
    expect(db.calls).toEqual([]);
  });

  it("Continue goes where the callback would send them, without signing in again", async () => {
    db.session = jane;
    renderSignIn("staff", "/login/mentor");
    fireEvent.click(await screen.findByRole("button", { name: "Continue as jane.personal@gmail.com" }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/portal");
    expect(localStorage.getItem("datahacks.applyAs")).toBe("staff");
    expect(db.calls).toEqual([]);
  });

  it("Use a different account signs out, then opens Google's account picker", async () => {
    db.session = jane;
    renderSignIn("hacker");
    fireEvent.click(await screen.findByRole("button", { name: "Use a different account" }));
    await waitFor(() => expect(db.calls).toHaveLength(2));
    expect(db.calls[0]).toBe("signOut");
    expect(db.calls[1]).toMatch(/^oauth .*as=hacker select_account$/);
  });

  it("organizer sign-in: an account that isn't an organizer says so and only offers the switch", async () => {
    db.session = jane;
    renderSignIn("organizer", "/organizer");
    expect(await screen.findByText(/isn't an organizer for this event/)).toHaveTextContent("jane.personal@gmail.com isn't an organizer for this event.");
    expect(screen.queryByRole("button", { name: /Continue as/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use a different account" }));
    await waitFor(() => expect(db.calls).toHaveLength(2));
    expect(db.calls[0]).toBe("signOut");
    expect(db.calls[1]).toMatch(/as=organizer/);
  });

  it("organizer sign-in: an organizer continues to the console", async () => {
    db.session = { user: { id: "u2", email: "organizer@ucsd.edu" } };
    db.roles = [{ role: "organizer" }];
    renderSignIn("organizer", "/organizer");
    fireEvent.click(await screen.findByRole("button", { name: "Continue as organizer@ucsd.edu" }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/portal/organizer");
  });
});

describe("the public site's apply buttons", () => {
  const renderButton = () =>
    render(
      <MemoryRouter initialEntries={["/datacraft"]}>
        <Routes>
          <Route path="/datacraft" element={<ApplyButton as="hacker">Apply as a hacker</ApplyButton>} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );

  it("go straight to Google when nobody is signed in", async () => {
    renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Apply as a hacker" }));
    await waitFor(() => expect(db.calls).toHaveLength(1));
    expect(db.calls[0]).toMatch(/as=hacker select_account$/);
  });

  it("ask first when someone is signed in", async () => {
    db.session = jane;
    renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Apply as a hacker" }));
    const dialog = await screen.findByRole("dialog", { name: "Already signed in" });
    expect(dialog).toHaveTextContent("You're signed in as jane.personal@gmail.com.");
    expect(db.calls).toEqual([]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue as jane.personal@gmail.com" }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/portal");
  });
});

describe("portal sidebar", () => {
  it("shows who's signed in, and labels the contact link as a contact", async () => {
    db.session = { user: { id: "u1", email: "a.really.long.address.for.testing@ucsd.edu" } };
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/portal/hacker"]}>
          <PortalFrame nav={null} signOutPath="/login/hacker"><p>page</p></PortalFrame>
        </MemoryRouter>
      </AuthProvider>,
    );
    const email = await screen.findByText("a.really.long.address.for.testing@ucsd.edu");
    expect(email).toHaveAttribute("title", "a.really.long.address.for.testing@ucsd.edu");
    expect(email.closest(".sp-account-who")).toHaveTextContent("Signed in as");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    const contact = screen.getByRole("link", { name: /Questions\?/ });
    expect(contact).toHaveAttribute("href", "mailto:info@ds3.club");
    expect(contact).toHaveTextContent("Questions? info@ds3.club");
    expect(contact).not.toHaveTextContent("Signed in");
  });

  it("organizer console's sidebar can show the account without a sign-out (preview)", () => {
    render(<SignedInAs email="preview@ds3.club" signOut={false} onSignOut={() => {}} />);
    expect(screen.getByText("Signed in as")).toBeInTheDocument();
    expect(screen.getByText("preview@ds3.club")).toHaveAttribute("title", "preview@ds3.club");
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });
});

describe("account changed in another tab", () => {
  it("says so and refreshes this page's data", async () => {
    db.session = jane;
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    render(<QueryClientProvider client={client}><AuthProvider><AccountWatcher /></AuthProvider></QueryClientProvider>);
    await waitFor(() => expect(db.authListener).not.toBeNull());
    // Supabase hands every open tab the other tab's sign-out, then its new sign-in.
    await act(async () => { db.authListener!("SIGNED_IN", jane); });
    await act(async () => { db.authListener!("SIGNED_OUT", null); });
    expect(toast).not.toHaveBeenCalled();
    await act(async () => { db.authListener!("SIGNED_IN", { user: { id: "u9", email: "organizer@ucsd.edu" } }); });
    expect(toast).toHaveBeenCalledWith("Signed in as organizer@ucsd.edu in another tab", expect.anything());
    expect(invalidate).toHaveBeenCalled();
  });
});
