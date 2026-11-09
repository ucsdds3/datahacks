import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ session: null, isOrganizer: false, loading: false }) }));
vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }));

import SignIn from "./SignIn";
import { MCP_LIVE } from "./applyWithAiConfig";

describe("sign-in pages", () => {
  it("mentor and judge heading says 'and': the pixel font draws '&' like '$'", () => {
    render(<MemoryRouter><SignIn as="staff" /></MemoryRouter>);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Mentor and Judge Sign In");
  });

  it("doesn't send people to Apply with AI until it works", () => {
    render(<MemoryRouter><SignIn as="hacker" /></MemoryRouter>);
    expect(screen.queryByRole("link", { name: "Apply with AI" }) !== null).toBe(MCP_LIVE);
  });
});
