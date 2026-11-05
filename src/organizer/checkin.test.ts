import { describe, expect, it } from "vitest";
import {
  activityFeed, activityFromLog, arrivalBuckets, arrivalsFromLog, scanCounts, buildPeople, checkinsByOrganizer, findUndos, groupBySchool, isUcsd, noShows,
  NO_SCHOOL, roleTallies, tally, travelRequests, ucsdSplit, waiverStats,
  type CheckinApplication, type LogEvent, type RosterEntry,
} from "./checkin";

const at = (hhmm: string) => `2027-04-10T${hhmm}:00Z`;

const entry = (id: string, extra: Partial<RosterEntry> = {}): RosterEntry => ({
  id, application_id: `app-${id}`, code: `DH-${id}`, name: `Person ${id}`, email: `${id}@example.edu`,
  roles: ["hacker"], checked_in_at: null, checked_in_by: null, ...extra,
});

const app = (id: string, extra: Partial<CheckinApplication> = {}): CheckinApplication => ({
  id: `app-${id}`, applicant_type: "hacker", school: "University of California, San Diego", organization: null,
  wants_travel_stipend: false, travel_region: null, travel_method: null, travel_distance: null, ...extra,
});

describe("arrivalBuckets", () => {
  it("counts per 15 minutes on :00/:15/:30/:45, fills gaps, and keeps a running total", () => {
    const { minutes, buckets } = arrivalBuckets([at("10:01"), at("10:14"), at("10:15"), null, at("10:59"), at("10:02")]);
    expect(minutes).toBe(15);
    expect(buckets.map(b => new Date(b.start).toISOString().slice(11, 16))).toEqual(["10:00", "10:15", "10:30", "10:45"]);
    expect(buckets.map(b => b.count)).toEqual([3, 1, 0, 1]);
    expect(buckets.map(b => b.cumulative)).toEqual([3, 4, 4, 5]);
  });

  it("is empty with no check-ins", () => {
    expect(arrivalBuckets([null, null]).buckets).toEqual([]);
  });

  it("runs the axis on to `until` so a quiet spell shows as empty bars", () => {
    const { buckets } = arrivalBuckets([at("10:05")], { until: Date.parse(at("10:50")) });
    expect(buckets.map(b => b.count)).toEqual([1, 0, 0, 0]);
    expect(buckets[3].cumulative).toBe(1);
  });

  it("widens the buckets when the span would be more than 96 bars", () => {
    // A test check-in two days early plus the real ones.
    const { minutes, buckets } = arrivalBuckets(["2027-04-08T09:00:00Z", at("10:00"), at("10:20")]);
    expect(minutes).toBe(60);
    expect(buckets.length).toBeLessThanOrEqual(96);
    expect(buckets.reduce((s, b) => s + b.count, 0)).toBe(3);
    expect(buckets[buckets.length - 1].cumulative).toBe(3);
  });
});

describe("no-shows and tallies", () => {
  const roster = [
    entry("a", { checked_in_at: at("10:00") }),
    entry("b"),
    entry("c", { roles: ["mentor"] }),
    entry("d", { roles: ["mentor", "judge"], checked_in_at: at("10:30") }),
    entry("e", { roles: ["judge"] }),
    entry("f", { application_id: null }),
  ];
  const people = buildPeople(roster, [
    app("a"), app("b", { school: "San Diego State University" }),
    app("c", { applicant_type: "mentor", school: null, organization: "Qualcomm" }),
    app("d", { applicant_type: "hybrid", school: null, organization: "Intuit" }),
    app("e", { applicant_type: "judge", school: "UC San Diego", organization: null }),
  ]);

  it("lists everyone on the roster without a check-in, in roster order", () => {
    expect(noShows(people).map(p => p.id)).toEqual(["b", "c", "e", "f"]);
  });

  it("counts a mentor & judge under both roles but once overall", () => {
    const t = roleTallies(people);
    expect(t.all).toEqual({ accepted: 6, checkedIn: 2, expected: 4, percent: 33 });
    expect(t.hacker).toEqual({ accepted: 3, checkedIn: 1, expected: 2, percent: 33 });
    expect(t.mentor).toEqual({ accepted: 2, checkedIn: 1, expected: 1, percent: 50 });
    expect(t.judge).toEqual({ accepted: 2, checkedIn: 1, expected: 1, percent: 50 });
  });

  it("is 0% (not NaN) with nobody accepted", () => {
    expect(tally([])).toEqual({ accepted: 0, checkedIn: 0, expected: 0, percent: 0 });
  });

  it("uses the organization for mentors and judges, the school for hackers, and the roles when there's no application", () => {
    const byId = new Map(people.map(p => [p.id, p]));
    expect(byId.get("b")!.affiliation).toBe("San Diego State University");
    expect(byId.get("c")!.affiliation).toBe("Qualcomm");
    expect(byId.get("e")!.affiliation).toBe("UC San Diego");
    expect(byId.get("d")!.type).toBe("hybrid");
    expect(byId.get("f")).toMatchObject({ type: "hacker", affiliation: "", school: null });
  });

  it("groups by school case-insensitively, biggest first, no school last", () => {
    const groups = groupBySchool([
      { id: 1, affiliation: "UCLA" }, { id: 2, affiliation: "" }, { id: 3, affiliation: "SDSU" },
      { id: 4, affiliation: "ucla" }, { id: 5, affiliation: "  " }, { id: 6, affiliation: "Mesa" },
    ]);
    expect(groups.map(g => [g.school, g.people.map(p => p.id)])).toEqual([
      ["UCLA", [1, 4]], ["Mesa", [6]], ["SDSU", [3]], [NO_SCHOOL, [2, 5]],
    ]);
  });
});

describe("UCSD split", () => {
  it.each([
    ["University of California, San Diego", true],
    ["University of California San Diego", true],
    ["University of California at San Diego", true],
    ["UC San Diego", true],
    ["uc-san diego", true],
    ["UCSD", true],
    ["ucsd extension", true],
    ["University of San Diego", false],
    ["San Diego State University", false],
    ["UC Irvine", false],
    ["San Diego Mesa College", false],
    ["", null],
    [null, null],
  ])("%s → %s", (school, want) => {
    expect(isUcsd(school)).toBe(want);
  });

  it("tallies UCSD, not UCSD and no school given separately", () => {
    const split = ucsdSplit([
      { school: "UCSD", checkedInAt: at("10:00") },
      { school: "University of California, San Diego", checkedInAt: null },
      { school: "SDSU", checkedInAt: null },
      { school: "University of San Diego", checkedInAt: at("11:00") },
      { school: null, checkedInAt: null },
    ]);
    expect(split.ucsd).toEqual({ accepted: 2, checkedIn: 1, expected: 1, percent: 50 });
    expect(split.other).toEqual({ accepted: 2, checkedIn: 1, expected: 1, percent: 50 });
    expect(split.unknown).toEqual({ accepted: 1, checkedIn: 0, expected: 1, percent: 0 });
  });
});

describe("travel, waivers and activity", () => {
  it("lists accepted people who asked for travel money and whether they came", () => {
    const people = buildPeople(
      [entry("a", { checked_in_at: at("10:00") }), entry("b"), entry("c")],
      [app("a", { wants_travel_stipend: true, travel_region: "LA" }), app("b", { wants_travel_stipend: true }), app("c")],
    );
    const travel = travelRequests(people);
    expect(travel.people.map(p => p.id)).toEqual(["a", "b"]);
    expect(travel).toMatchObject({ accepted: 2, checkedIn: 1, expected: 1 });
    expect(travel.people[0].travel?.travel_region).toBe("LA");
  });

  it("hides waivers when the column isn't there, and counts checked-in people without one when it is", () => {
    expect(waiverStats(buildPeople([entry("a", { checked_in_at: at("10:00") })], []))).toBeNull();
    const stats = waiverStats(buildPeople([
      entry("a", { checked_in_at: at("10:00"), waiver_signed_at: at("09:00") }),
      entry("b", { checked_in_at: at("10:05"), waiver_signed_at: null }),
      entry("c", { waiver_signed_at: null }),
    ], []))!;
    expect(stats).toMatchObject({ checkedIn: 2, signed: 1, percent: 50 });
    expect(stats.missing.map(p => p.id)).toEqual(["b"]);
  });

  it("finds undone check-ins between two loads and puts them in the feed, newest first", () => {
    const before = [entry("a", { checked_in_at: at("10:00"), checked_in_by: "org-1" }), entry("b", { checked_in_at: at("10:05"), checked_in_by: "org-2" })];
    const after = [entry("a", { checked_in_at: at("10:00"), checked_in_by: "org-1" }), entry("b")];
    const undos = findUndos(before, after, at("10:20"));
    expect(undos).toHaveLength(1);
    expect(undos[0]).toMatchObject({ kind: "undo", person: { id: "b", type: "hacker" }, at: at("10:20") });
    expect(findUndos(after, after, at("10:21"))).toEqual([]);

    const feed = activityFeed(buildPeople(after, []), undos);
    expect(feed.map(a => [a.kind, a.person.id, a.by])).toEqual([["undo", "b", null], ["checkin", "a", "org-1"]]);
  });

  it("counts check-ins per organizer", () => {
    const people = buildPeople([
      entry("a", { checked_in_at: at("10:00"), checked_in_by: "org-1" }),
      entry("b", { checked_in_at: at("10:01"), checked_in_by: "org-2" }),
      entry("c", { checked_in_at: at("10:02"), checked_in_by: "org-1" }),
      entry("d", { checked_in_at: at("10:03"), checked_in_by: null }),
      entry("e"),
    ], []);
    expect(checkinsByOrganizer(people)).toEqual([{ by: "org-1", count: 2 }, { by: "org-2", count: 1 }, { by: null, count: 1 }]);
  });
});

let logId = 0;
const ev = (attendee: string, kind: LogEvent["kind"], hhmm: string, extra: Partial<LogEvent> = {}): LogEvent => ({
  id: ++logId, attendee_id: attendee, code: `DH-${attendee}`, kind, scan_type_id: kind === "scan" ? "lunch" : null,
  by_user: "org-1", scanned_at: at(hhmm), source: "online", not_checked_in: false, ...extra,
});

describe("the check-in log", () => {
  const people = buildPeople([entry("a", { checked_in_at: at("10:05") }), entry("b"), entry("m", { roles: ["mentor"] })], [app("a"), app("b")]);
  const byId = new Map(people.map(p => [p.id, p]));

  it("feeds check-ins and undos newest first, with who did them (undos too), named from the roster", () => {
    const log = [
      ev("a", "check_in", "10:00"), ev("a", "undo", "10:02", { by_user: "org-2" }), ev("a", "check_in", "10:05", { source: "offline" }),
      ev("a", "scan", "12:00"), ev("gone", "check_in", "09:00"),
    ];
    const feed = activityFromLog(log, byId);
    expect(feed.map(f => [f.kind, f.at.slice(11, 16), f.by, f.source])).toEqual([
      ["checkin", "10:05", "org-1", "offline"], ["undo", "10:02", "org-2", "online"], ["checkin", "10:00", "org-1", "online"], ["checkin", "09:00", "org-1", "online"],
    ]);
    expect(feed[0].person).toEqual({ id: "a", name: "Person a", code: "DH-a", type: "hacker" });
    // No longer on the roster: the log still knows their code.
    expect(feed[3].person).toEqual({ id: "gone", name: "DH-gone", code: "DH-gone", type: null });
  });

  it("orders by scan time, so an offline check-in sent late lands where it happened", () => {
    const log = [ev("a", "check_in", "10:30"), ev("b", "check_in", "10:10", { source: "offline" })];
    expect(activityFromLog(log, byId).map(f => f.person.id)).toEqual(["a", "b"]);
  });

  it("arrival is the latest check-in not undone since", () => {
    const log = [
      ev("a", "check_in", "10:00"), ev("a", "undo", "10:02"), ev("a", "check_in", "10:05"),
      ev("b", "check_in", "10:10"), ev("b", "undo", "10:20"),
      ev("m", "scan", "12:00", { not_checked_in: true }),
    ];
    expect([...arrivalsFromLog(log)]).toEqual([["a", at("10:05")]]);
  });

  it("counts scans per type, flags the ones before check-in, and a share of who's here", () => {
    const log = [
      ev("a", "scan", "12:00"), ev("b", "scan", "12:01", { not_checked_in: true }), ev("m", "scan", "12:02"),
      ev("a", "scan", "12:03", { scan_type_id: "shirt" }), ev("a", "check_in", "10:00"), ev("x", "scan", "12:04", { scan_type_id: "elsewhere" }),
    ];
    expect(scanCounts(log, ["lunch", "shirt", "dinner"], 4)).toEqual([
      { scanTypeId: "lunch", scanned: 3, notCheckedIn: 1, percentOfHere: 75 },
      { scanTypeId: "shirt", scanned: 1, notCheckedIn: 0, percentOfHere: 25 },
      { scanTypeId: "dinner", scanned: 0, notCheckedIn: 0, percentOfHere: 0 },
    ]);
    expect(scanCounts(log, ["lunch"], 0)[0].percentOfHere).toBeNull();
  });
});
