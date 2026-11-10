import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import Stats, { STATS_TITLE } from "./Stats";

const SAMPLE = {
  event: "DH27",
  hackers: 180, schools: 23, first_time: 81, attended_before: 30, countries: 3, mentors_judges: 12,
  top_schools: [{ label: "University of California, San Diego", count: 96 }, { label: "San Diego State University", count: 11 }, { label: "Other", count: 73 }],
  levels: [{ label: "Undergraduate (3+ year: bachelor's)", count: 150 }, { label: "Other", count: 30 }],
  majors: [],
  graduation_years: [{ label: "2028", count: 70 }, { label: "2027", count: 60 }, { label: "Other", count: 50 }],
  per_day: [
    { date: "2026-11-03", count: 120, total: 120 },
    { date: "2026-11-04", count: 0, total: 120 },
    { date: "2026-11-05", count: 60, total: 180 },
  ],
};
const EMPTY = { ...SAMPLE, hackers: 0, schools: 0, first_time: 0, attended_before: 0, countries: 0, top_schools: [], levels: [], graduation_years: [], per_day: [] };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/stats"]}><Stats /></MemoryRouter>
    </QueryClientProvider>,
  );
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon.jwt.key");
  fetchMock = vi.fn(async () => json(200, SAMPLE));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("live stats page", () => {
  it("shows the counts, the goal and the lists", async () => {
    renderPage();
    expect(await screen.findByText("hacker applications so far")).toBeInTheDocument();
    expect(document.title).toBe(STATS_TITLE);
    expect(STATS_TITLE).toBe("DataHacks 2027 · Live stats");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("DataHacks 2027 live stats");
    expect(screen.getByText("Live")).toBeInTheDocument();

    const cards = screen.getByRole("heading", { name: "Overview" }).parentElement!;
    expect(within(cards).getByText("180")).toBeInTheDocument();
    expect(within(cards).getByText("12%")).toBeInTheDocument(); // 180 of 1,500
    expect(within(cards).getByText("of the 1,500-applicant goal")).toBeInTheDocument();
    expect(within(cards).getByText("45%")).toBeInTheDocument(); // 81 of 180 first-timers
    expect(within(cards).getByText("81 applicants are new to hackathons")).toBeInTheDocument();
    expect(within(cards).getByText("Goal: 1,500 applicants")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Progress toward the applicant goal" })).toHaveAttribute("aria-valuenow", "180");
    expect(screen.getByText("From 3 countries · 30 have been to DataHacks before")).toBeInTheDocument();

    const schools = screen.getByRole("region", { name: "Top schools" });
    expect(within(schools).getAllByRole("listitem").map(li => li.textContent)).toEqual([
      "University of California, San Diego96", "San Diego State University11", "Other73",
    ]);
    // Graduation years in calendar order, Other last.
    const years = screen.getByRole("region", { name: "Graduation year" });
    expect(within(years).getAllByRole("listitem").map(li => li.textContent)).toEqual(["202760", "202870", "Other50"]);
    // A list with nothing big enough to name says so.
    expect(within(screen.getByRole("region", { name: "Majors" })).getByText(/Not enough applications yet/)).toBeInTheDocument();

    // The chart's table, for screen readers.
    expect(screen.getByRole("table", { name: "Hacker applications by day" })).toBeInTheDocument();
    expect(screen.getByText(/Last updated .* · refreshes every 60 seconds/)).toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: "Apply now" })) expect(link).toHaveAttribute("href", "/apply/");
    expect(screen.getByRole("link", { name: "DataHacks home" })).toHaveAttribute("href", "/");
  });

  it("Refresh fetches again", async () => {
    renderPage();
    await screen.findByText("hacker applications so far");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await screen.findByRole("button", { name: "Refresh" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("no applications yet: says applications just opened, with Apply", async () => {
    fetchMock.mockImplementation(async () => json(200, EMPTY));
    renderPage();
    expect(await screen.findByRole("heading", { name: "Applications just opened" })).toBeInTheDocument();
    expect(screen.queryByText("hacker applications so far")).not.toBeInTheDocument();
    const apply = screen.getAllByRole("link", { name: "Apply now" });
    expect(apply).toHaveLength(2);
    for (const link of apply) expect(link).toHaveAttribute("href", "/apply/");
  });

  it("stats switched off: says they're paused, with no numbers", async () => {
    fetchMock.mockImplementation(async () => json(400, { code: "P0002", message: "There are no public stats for that event." }));
    renderPage();
    expect(await screen.findByRole("heading", { name: "Live stats are paused" })).toBeInTheDocument();
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1); // not retried
  });

  it("a failure says so, and Try again recovers", async () => {
    fetchMock.mockImplementation(async () => json(503, { message: "unavailable" }));
    renderPage();
    expect(await screen.findByRole("heading", { name: "Couldn't load the stats" })).toBeInTheDocument();
    expect(screen.getByText("Offline")).toBeInTheDocument();
    fetchMock.mockImplementation(async () => json(200, SAMPLE));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("hacker applications so far")).toBeInTheDocument();
  });
});
