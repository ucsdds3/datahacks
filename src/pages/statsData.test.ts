import { afterEach, describe, expect, it, vi } from "vitest";
import { EVENT_CODE } from "@/portal/event";
import {
  APPLICANT_GOAL, STATS_EVENT_CODE, StatsPausedError, chartPoints, fetchPublicStats, formatCount, formatDay, formatPercent,
  goalProgress, niceMax, parseStats, sortGraduationYears,
} from "./statsData";

// event.ts imports the Supabase client; nothing here talks to Supabase through it.
vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("live stats settings", () => {
  it("shows the portal's current event", () => expect(STATS_EVENT_CODE).toBe(EVENT_CODE));
  it("measures against the 1,500-applicant goal", () => expect(APPLICANT_GOAL).toBe(1500));
});

describe("formatting", () => {
  it("counts with thousands separators", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(1500)).toBe("1,500");
  });

  it("percentages are whole numbers, with <1% for a small share and 0% for none", () => {
    expect(formatPercent(46, 100)).toBe("46%");
    expect(formatPercent(1, 3)).toBe("33%");
    expect(formatPercent(1, 1500)).toBe("<1%");
    expect(formatPercent(0, 10)).toBe("0%");
    expect(formatPercent(5, 0)).toBe("0%");
  });

  it("goal progress: the label can pass 100%, the bar stops there", () => {
    expect(goalProgress(150)).toEqual({ label: "10%", fill: 10, reached: false });
    expect(goalProgress(0)).toEqual({ label: "0%", fill: 0, reached: false });
    expect(goalProgress(1800)).toEqual({ label: "120%", fill: 100, reached: true });
    expect(goalProgress(1500).reached).toBe(true);
  });

  it("days read as written, whatever the viewer's time zone", () => {
    expect(formatDay("2026-11-03")).toBe("Nov 3");
    expect(formatDay("2027-01-16")).toBe("Jan 16");
  });

  it("graduation years in calendar order, then the rest, then Other", () => {
    const sorted = sortGraduationYears([
      { label: "Other", count: 9 },
      { label: "2028", count: 40 },
      { label: "Already graduated", count: 6 },
      { label: "2027", count: 30 },
      { label: "2030", count: 5 },
    ]);
    expect(sorted.map(b => b.label)).toEqual(["2027", "2028", "2030", "Already graduated", "Other"]);
  });

  it("the chart's scale tops out at a round number", () => {
    expect(niceMax(0)).toBe(10);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(11)).toBe(20);
    expect(niceMax(180)).toBe(200);
    expect(niceMax(230)).toBe(300);
    expect(niceMax(1500)).toBe(2000);
    expect(niceMax(1000)).toBe(1000);
    expect(niceMax(1001)).toBe(2000);
  });

  it("chart points run left to right, rising with the running total", () => {
    const { top, points } = chartPoints([
      { date: "2026-11-03", count: 10, total: 10 },
      { date: "2026-11-04", count: 0, total: 10 },
      { date: "2026-11-05", count: 8, total: 18 },
    ], 600, 200);
    expect(top).toBe(20);
    expect(points.map(p => p.x)).toEqual([0, 300, 600]);
    expect(points.map(p => p.y)).toEqual([100, 100, 20]);
    expect(chartPoints([{ date: "2026-11-03", count: 4, total: 4 }], 600, 200).points[0].x).toBe(300);
  });
});

describe("parseStats", () => {
  it("reads the database's JSON", () => {
    const stats = parseStats({
      hackers: 23, schools: 4, first_time: 10, attended_before: 6, countries: 2, mentors_judges: 3,
      top_schools: [{ label: "UC San Diego", count: 12 }, { label: "Other", count: 6 }],
      levels: [], majors: [], graduation_years: [{ label: "2027", count: 10 }],
      per_day: [{ date: "2026-11-07", count: 12, total: 12 }],
    });
    expect(stats).toMatchObject({
      hackers: 23, schools: 4, firstTime: 10, attendedBefore: 6, countries: 2, mentorsJudges: 3,
      topSchools: [{ label: "UC San Diego", count: 12 }, { label: "Other", count: 6 }],
      graduationYears: [{ label: "2027", count: 10 }],
      perDay: [{ date: "2026-11-07", count: 12, total: 12 }],
    });
  });

  it("anything missing or malformed reads as zero or empty", () => {
    expect(parseStats(null)).toEqual({
      hackers: 0, schools: 0, firstTime: 0, attendedBefore: 0, countries: 0, mentorsJudges: 0,
      topSchools: [], levels: [], majors: [], graduationYears: [], perDay: [],
    });
    const stats = parseStats({ hackers: "12", schools: -3, top_schools: [null, { label: "", count: 9 }, { label: "A", count: "7" }], per_day: [{ date: "soon" }] });
    expect(stats.hackers).toBe(12);
    expect(stats.schools).toBe(0);
    expect(stats.topSchools).toEqual([{ label: "A", count: 7 }]);
    expect(stats.perDay).toEqual([]);
  });
});

describe("fetchPublicStats", () => {
  const connect = (key = "anon.jwt.key") => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co/");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", key);
  };
  const reply = (status: number, body: unknown) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

  it("asks the database for the current event's public stats with the anon key", async () => {
    connect();
    const fetch = reply(200, { hackers: 5, per_day: [] });
    vi.stubGlobal("fetch", fetch);
    expect((await fetchPublicStats()).hackers).toBe(5);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/public_event_stats");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ p_code: "DH27" });
    expect(init.headers).toMatchObject({ apikey: "anon.jwt.key", Authorization: "Bearer anon.jwt.key" });
  });

  it("a publishable key goes in apikey only", async () => {
    connect("sb_publishable_abc");
    const fetch = reply(200, {});
    vi.stubGlobal("fetch", fetch);
    await fetchPublicStats();
    const init = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.headers).toMatchObject({ apikey: "sb_publishable_abc" });
    expect(init.headers).not.toHaveProperty("Authorization");
  });

  it("the event's stats switched off: paused", async () => {
    connect();
    vi.stubGlobal("fetch", reply(400, { code: "P0002", message: "There are no public stats for that event." }));
    await expect(fetchPublicStats()).rejects.toBeInstanceOf(StatsPausedError);
  });

  it("any other failure is an error", async () => {
    connect();
    vi.stubGlobal("fetch", reply(503, { message: "unavailable" }));
    await expect(fetchPublicStats()).rejects.toThrow("The stats request failed (503).");
  });

  it("a build without the Supabase values says so instead of fetching", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(fetchPublicStats()).rejects.toThrow("isn't connected to the database");
    expect(fetch).not.toHaveBeenCalled();
  });
});
