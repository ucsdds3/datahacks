import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// The real "/" route loads the static homepage with location.replace, which jsdom can't do.
vi.mock("@/pages/Home", () => ({ default: () => <p>The homepage</p> }));

import App from "@/App";

/*
 * The older DataCraft world (/datacraft, and /minecraft before it) is taken down. Every address
 * under either, including the static drafts that used to be served at /datacraft/v1..v6, now
 * lands on the homepage.
 */
describe("the retired DataCraft addresses", () => {
  it.each([
    "/datacraft", "/datacraft/", "/datacraft/about", "/datacraft/faq", "/datacraft/v6/", "/datacraft/drafts/index.html",
    "/minecraft", "/minecraft/", "/minecraft/apply",
  ])("%s goes to the homepage", async path => {
    window.history.replaceState(null, "", path);
    render(<App />);
    expect(await screen.findByText("The homepage")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });
});
