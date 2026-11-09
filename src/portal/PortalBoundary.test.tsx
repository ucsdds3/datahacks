import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PortalBoundary, isStaleChunkError } from "./PortalBoundary";

const Boom = ({ error }: { error: Error }) => { throw error; };

beforeEach(() => {
  sessionStorage.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("PortalBoundary", () => {
  it("knows a page left behind by a deploy", () => {
    expect(isStaleChunkError(new TypeError("Failed to fetch dynamically imported module: https://x/assets/Apply-abc.js"))).toBe(true);
    expect(isStaleChunkError(new TypeError("error loading dynamically imported module"))).toBe(true); // Firefox
    expect(isStaleChunkError(new TypeError("Importing a module script failed."))).toBe(true); // Safari
    expect(isStaleChunkError(new Error("Cannot read properties of undefined"))).toBe(false);
  });

  it("says something went wrong (not 'applications open in October') and offers a reload", () => {
    render(<MemoryRouter><PortalBoundary><Boom error={new Error("Cannot read properties of undefined")} /></PortalBoundary></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Something went wrong loading the portal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload the page" })).toBeInTheDocument();
    expect(screen.queryByText(/October/)).toBeNull();
  });

  it("reloads once by itself for a stale page, but not in a loop", () => {
    const reload = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, reload } as Location);
    const stale = new TypeError("Failed to fetch dynamically imported module: /assets/x.js");
    const first = render(<MemoryRouter><PortalBoundary><Boom error={stale} /></PortalBoundary></MemoryRouter>);
    expect(reload).toHaveBeenCalledTimes(1);
    first.unmount();
    render(<MemoryRouter><PortalBoundary><Boom error={stale} /></PortalBoundary></MemoryRouter>);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
