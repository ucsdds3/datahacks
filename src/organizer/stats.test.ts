import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HACKER_GOAL, TIMELINE } from "@/staff-portal/config";
import { HACKATHON_EXPERIENCE, LEVELS_OF_STUDY } from "@/staff-portal/formOptions";
import {
  JOB_KINDS, JUDGING_TRACK_LABEL, OTHER_KEY, batchSplit, byGraduationYear, byOptions, checkinTally, clean, computeStats, dailySubmissions,
  decisionTally, jobKind, organizationKey, pacificDay, recentSubmissions, schoolKey, schoolLabel, share, tally, topN, withEvery, yesNo,
  type Item, type StatsRow,
} from "./stats";

const row = (extra: Partial<StatsRow> = {}): StatsRow => ({
  id: "x", applicant_type: "hacker", status: "submitted", submitted_at: "2026-11-10T12:00:00-08:00",
  school: null, major: null, level_of_study: null, graduation_year: null, hackathon_experience: null, attended_before: null,
  country_of_residence: null, heard_about: null, suggested_food: null, suggested_activity: null,
  wants_travel_stipend: null, travel_region: null, travel_distance: null, gender: null, race_ethnicity: null, judging_track: null, ucsd_affiliation: null,
  organization: null, role_title: null, decision: null, checkedIn: false,
  ...extra,
});

const bars = (items: Item[]) => items.map(i => [i.label, i.count]);

describe("normalising answers", () => {
  it("trims and collapses spaces, and treats blank as no answer", () => {
    expect(clean("  Data   Science ")).toBe("Data Science");
    expect(clean("   ")).toBeNull();
    expect(clean(null)).toBeNull();
  });

  it("groups spellings that differ only in case, spaces and punctuation, under the most common one", () => {
    const majors = ["Data Science", "data science", " Data Science ", "DATA SCIENCE.", "Data Science", "Cognitive Science", "", null];
    const b = tally(majors, m => m);
    expect(bars(b.items)).toEqual([["Data Science", 5], ["Cognitive Science", 1]]);
    expect(b.answered).toBe(6);
    expect(b.missing).toBe(2);
    expect(b.distinct).toBe(2);
  });

  it("puts UCSD, UC San Diego and the full name in one school, named as the form's list spells it", () => {
    const schools = ["UCSD", "ucsd", "UC San Diego", "University of California, San Diego", "university of california san diego",
      "University of San Diego", "SDSU", "San Diego State University", "UC-Irvine"];
    const b = tally(schools, s => s, { key: schoolKey, label: schoolLabel });
    expect(bars(b.items)).toEqual([
      ["University of California, San Diego", 5],
      ["San Diego State University", 2],
      ["University of California, Irvine", 1],
      ["University of San Diego", 1],
    ]);
    expect(schoolKey("UC Irvine")).toBe(schoolKey("University of California, Irvine"));
    expect(schoolKey("University of San Diego")).not.toBe(schoolKey("UCSD"));
  });
});

describe("multi-select questions", () => {
  it("counts each choice once per person, and shares are of the people who answered", () => {
    const people = [
      { heard: ["Instagram", "Friend or word of mouth"] },
      { heard: ["Instagram", "Instagram"] },
      { heard: ["LinkedIn"] },
      { heard: [] },
      { heard: null },
    ];
    const b = tally(people, p => p.heard);
    expect(bars(b.items)).toEqual([["Instagram", 2], ["Friend or word of mouth", 1], ["LinkedIn", 1]]);
    expect(b.answered).toBe(3);
    expect(b.missing).toBe(2);
  });

  it("splits race/ethnicity, which the form stores joined with '; '", () => {
    const b = tally([row({ race_ethnicity: "Asian; White" }), row({ race_ethnicity: "Asian" }), row()], r => r.race_ethnicity?.split(";"));
    expect(bars(b.items)).toEqual([["Asian", 2], ["White", 1]]);
    expect(b.answered).toBe(2);
  });
});

describe("topN", () => {
  const schools = tally(
    ["A", "A", "A", "B", "B", "C", "D", "E"],
    s => s,
  );

  it("keeps the biggest and adds up the rest in an Other bar at the end", () => {
    const b = topN(schools, 2);
    expect(b.items.map(i => [i.label, i.count, i.rest])).toEqual([["A", 3, undefined], ["B", 2, undefined], ["Other", 3, 3]]);
    expect(b.items[2].key).toBe(OTHER_KEY);
    expect(b.distinct).toBe(5);
    expect(b.answered).toBe(8);
  });

  it("doesn't fold a single bar into Other", () => {
    expect(topN(schools, 4).items).toHaveLength(5);
    expect(topN(schools, 4).items.some(i => i.rest)).toBe(false);
    expect(topN(schools, 3).items.map(i => i.label)).toEqual(["A", "B", "C", "Other"]);
  });

  it("ranks by count even when the list was in the form's order", () => {
    const b = tally(["z", "a", "a"], s => s, { sort: byOptions(["z", "a"]) });
    expect(b.items.map(i => i.label)).toEqual(["z", "a"]);
    expect(topN({ ...b, items: [...b.items, { key: "q", label: "q", count: 1 }, { key: "r", label: "r", count: 1 }] }, 1).items.map(i => i.label))
      .toEqual(["a", "Other"]);
  });
});

describe("withEvery", () => {
  it("adds a 0 bar for each option nobody has picked, after the ones that have been", () => {
    const options = { a_b: "A & B", c: "C", d: "D" };
    const b = withEvery(tally(["c", "a_b", "c", null], v => v, { label: v => options[v as keyof typeof options] }), options);
    expect(bars(b.items)).toEqual([["C", 2], ["A & B", 1], ["D", 0]]);
    expect(b).toMatchObject({ answered: 3, missing: 1, distinct: 2 });
  });

  it("leaves an answer that isn't an option alone", () => {
    expect(bars(withEvery(tally(["x"], v => v), { y: "Y" }).items)).toEqual([["x", 1], ["Y", 0]]);
  });
});

describe("mentors' and judges' companies and job titles", () => {
  it("groups a company's spellings, ignoring Inc., LLC and notes in brackets, and UCSD's names as one", () => {
    const companies = ["Qualcomm", "qualcomm", "Qualcomm Inc.", "Qualcomm, Inc", "Apple", "Apple LLC", "Apple", "Amazon (AWS)", "Amazon", "Amazon",
      "UCSD", "UC San Diego", "University of California, San Diego", "University of San Diego", "Co", "(stealth)"];
    const b = tally(companies, c => c, { key: organizationKey, label: schoolLabel });
    expect(bars(b.items)).toEqual([
      ["Qualcomm", 4],
      ["Amazon", 3],
      ["Apple", 3],
      ["University of California, San Diego", 3],
      ["(stealth)", 1],
      ["Co", 1],
      ["University of San Diego", 1],
    ]);
  });

  it("sorts job titles into kinds of role by the words in them", () => {
    const kinds: [string, string][] = [
      ["Software Engineer", "Software Engineering"],
      ["Sr. SDE", "Software Engineering"],
      ["SWE II", "Software Engineering"],
      ["Member of Technical Staff", "Software Engineering"],
      ["Machine Learning Engineer", "Machine Learning / AI"],
      ["AI/ML Engineer", "Machine Learning / AI"],
      ["Applied Scientist", "Machine Learning / AI"],
      ["Senior Data Scientist", "Data / Analytics"],
      ["Data Analyst", "Data / Analytics"],
      ["Quantitative Researcher", "Data / Analytics"],
      ["Product Manager", "Product"],
      ["Technical Program Manager", "Product"],
      ["Research Scientist", "Research"],
      ["Research Engineer", "Research"],
      ["Engineering Manager", "Engineering Leadership"],
      ["Staff Software Engineer", "Engineering Leadership"],
      ["Co-founder & CEO", "Founder / Executive"],
      ["Director of Data Science", "Founder / Executive"],
      ["Security Engineer", "Security"],
      ["PhD Student", "Student / Academic"],
      ["Assistant Professor", "Student / Academic"],
      ["Portfolio Manager", "Investment"],
      ["Consultant", "Other"],
    ];
    expect(kinds.map(([title]) => [title, jobKind(title)])).toEqual(kinds);
    expect(kinds.every(([, kind]) => JOB_KINDS.includes(kind))).toBe(true);
  });
});

describe("ordering", () => {
  it("keeps answers with a natural order in the form's order, anything unexpected after", () => {
    const b = tally([LEVELS_OF_STUDY[3], LEVELS_OF_STUDY[0], "Something else", LEVELS_OF_STUDY[3]], v => v, { sort: byOptions(LEVELS_OF_STUDY) });
    expect(b.items.map(i => i.label)).toEqual([LEVELS_OF_STUDY[0], LEVELS_OF_STUDY[3], "Something else"]);
  });

  it("sorts graduation years by year, then the non-years", () => {
    const b = tally(["Not applicable", "2029", "Already graduated", "2027", "2027"], v => v, { sort: byGraduationYear });
    expect(b.items.map(i => i.label)).toEqual(["2027", "2029", "Already graduated", "Not applicable"]);
  });

  it("answers yes/no with Yes first and leaves null out", () => {
    const b = yesNo([true, false, false, null], v => v);
    expect(bars(b.items)).toEqual([["Yes", 1], ["No", 2]]);
    expect(b.missing).toBe(1);
  });
});

describe("Pacific time", () => {
  it("dates a submission by the day in San Diego", () => {
    expect(pacificDay("2026-11-30T07:30:00Z")).toBe("2026-11-29"); // 11:30 PM PST
    expect(pacificDay("2026-11-30T08:00:00Z")).toBe("2026-11-30"); // midnight PST
    expect(pacificDay("2026-07-01T06:59:00Z")).toBe("2026-06-30"); // 11:59 PM PDT
  });

  it("puts anything up to the priority deadline (11:59 PM Pacific) in the priority batch", () => {
    const at = (submitted_at: string | null) => ({ submitted_at });
    // Relative to TIMELINE, so the test follows the deadline when it moves.
    const deadline = new Date(TIMELINE.priorityDeadline).getTime();
    const iso = (ms: number) => new Date(ms).toISOString();
    expect(batchSplit([
      at("2026-11-03T09:00:00-08:00"),
      at(iso(deadline - 59_000)), // 11:59 PM Pacific
      at(iso(deadline - 30 * 60_000)), // 11:29 PM in San Diego, already the next day in UTC
      at(iso(deadline + 31_000)), // half a minute after midnight Pacific
      at("2026-12-25T12:00:00Z"),
      at(null),
    ])).toEqual({ priority: 3, regular: 3 });
  });
});

const DAY = 86_400_000;

describe("dailySubmissions", () => {
  const at = (submitted_at: string | null) => ({ submitted_at });

  it("counts per Pacific day with quiet days filled in and a running total, up to today while open", () => {
    const days = dailySubmissions([
      at("2026-11-03T10:00:00-08:00"),
      at("2026-11-04T07:30:00Z"), // 11:30 PM on November 3 in San Diego
      at("2026-11-05T12:00:00-08:00"),
      at(null),
      at("not a date"),
    ], new Date("2026-11-07T15:00:00-08:00"));
    expect(days.map(d => [d.day, d.count, d.cumulative])).toEqual([
      ["2026-11-03", 2, 2],
      ["2026-11-04", 0, 2],
      ["2026-11-05", 1, 3],
      ["2026-11-06", 0, 3],
      ["2026-11-07", 0, 3],
    ]);
    expect(new Date(days[0].start).toISOString()).toBe("2026-11-03T00:00:00.000Z");
  });

  it("stops at the regular deadline once applications have closed", () => {
    // Relative to TIMELINE, so the test follows the deadline when it moves.
    const end = new Date(TIMELINE.regularDeadline).getTime();
    const iso = (ms: number) => new Date(ms).toISOString();
    const days = dailySubmissions([at(iso(end - 2 * DAY))], new Date("2027-01-20T12:00:00-08:00"));
    expect(days.map(d => d.day)).toEqual([pacificDay(iso(end - 2 * DAY)), pacificDay(iso(end - DAY)), pacificDay(iso(end))]);
  });

  it("is empty with nothing submitted", () => {
    expect(dailySubmissions([at(null)])).toEqual([]);
  });

  it("counts today and the last 7 days in Pacific time", () => {
    const now = new Date("2026-11-10T09:00:00-08:00");
    expect(recentSubmissions([
      at("2026-11-10T08:00:00-08:00"),
      at("2026-11-10T07:30:00Z"), // 11:30 PM on the 9th
      at("2026-11-04T00:10:00-08:00"),
      at("2026-11-03T23:50:00-08:00"),
      at(null),
    ], now)).toEqual({ today: 1, week: 3 });
  });
});

describe("decisions", () => {
  it("places each submission like the console's tabs, split into released and staged", () => {
    const counts = decisionTally([
      row({ status: "accepted", decision: "accepted" }),
      row({ status: "accepted", decision: null }), // released before decisions were private
      row({ status: "submitted", decision: "accepted" }), // staged
      row({ status: "accepted", decision: "waitlisted" }), // released accepted, now picked for the waitlist
      row({ status: "rejected", decision: "rejected" }),
      row({ status: "submitted", decision: null }),
      row({ status: "draft", decision: null }),
    ]);
    expect(counts.map(c => [c.key, c.count, c.released, c.staged])).toEqual([
      ["accepted", 3, 2, 1],
      ["waitlisted", 1, 0, 1],
      ["rejected", 1, 1, 0],
      ["undecided", 1, 0, 0],
    ]);
  });

  it("counts check-ins against everyone accepted", () => {
    expect(checkinTally([row({ status: "accepted", checkedIn: true }), row({ status: "accepted" }), row()])).toEqual({ accepted: 2, checkedIn: 1 });
  });
});

describe("computeStats", () => {
  const rows: StatsRow[] = [
    row({ id: "1", school: "UCSD", hackathon_experience: HACKATHON_EXPERIENCE[0], submitted_at: "2026-11-20T10:00:00-08:00", wants_travel_stipend: false }),
    row({
      id: "2", school: "University of California, San Diego", hackathon_experience: HACKATHON_EXPERIENCE[1], wants_travel_stipend: false,
      suggested_food: "Boba", suggested_activity: "Smash tournament",
    }),
    row({
      id: "3", school: "UCLA", hackathon_experience: HACKATHON_EXPERIENCE[0], submitted_at: "2026-12-01T10:00:00-08:00",
      wants_travel_stipend: true, travel_region: "Los Angeles, CA", travel_distance: "50–200 miles",
      suggested_food: "boba ", suggested_activity: "5K",
    }),
    row({
      id: "4", status: "draft", submitted_at: null, school: "Stanford University", hackathon_experience: HACKATHON_EXPERIENCE[0],
      suggested_food: "Pizza", suggested_activity: "Karaoke",
    }),
    row({ id: "5", applicant_type: "mentor", ucsd_affiliation: "alumni", heard_about: ["Word of Mouth"], organization: "UCSD", role_title: "PhD student" }),
    row({
      id: "6", applicant_type: "judge", judging_track: "biotech_life_sciences", ucsd_affiliation: "none", decision: "accepted",
      heard_about: ["DataHacks Industry Sponsor", "Word of Mouth"], organization: "Qualcomm", role_title: "Senior Software Engineer",
    }),
    row({ id: "7", applicant_type: "hybrid", judging_track: "social_good", ucsd_affiliation: "none", organization: "Qualcomm Inc.", role_title: "Data Scientist" }),
    row({ id: "8", applicant_type: "judge", status: "draft", submitted_at: null, heard_about: ["IEEE Member"], organization: "Apple", role_title: "CEO" }),
  ];
  const stats = computeStats(rows, { now: new Date("2026-12-02T12:00:00-08:00") });

  it("leaves drafts out of everything but the drafts count", () => {
    expect(stats.hackers).toBe(3);
    expect(stats.hackerDrafts).toBe(1);
    expect(stats.schoolsRepresented).toBe(2);
    expect(stats.firstTimers).toBe(2);
    expect(stats.staff.total).toBe(3);
    expect(stats.staff.drafts).toBe(1);
  });

  it("measures progress against the 1,500-applicant goal", () => {
    expect(HACKER_GOAL).toBe(1500);
    expect(stats.goal).toBe(1500);
    expect(stats.progress).toBeCloseTo(3 / 1500);
    expect(computeStats(rows, { goal: 2 }).progress).toBe(1.5);
    expect(stats.batch).toEqual({ priority: 2, regular: 1 });
  });

  it("breaks hackers down by school, travel and more", () => {
    expect(bars(stats.hacker.schools.items)).toEqual([["University of California, San Diego", 2], ["University of California, Los Angeles", 1]]);
    expect(bars(stats.hacker.travel.items)).toEqual([["Yes", 1], ["No", 2]]);
    expect(bars(stats.hacker.travelRegion.items)).toEqual([["Los Angeles, CA", 1]]);
    expect(stats.hacker.experience.items[0].label).toBe(HACKATHON_EXPERIENCE[0]);
    expect(stats.daily.at(-1)).toMatchObject({ day: "2026-12-02", cumulative: 3 });
  });

  it("lists hackers' suggested food and activities, grouped, without drafts or older applications", () => {
    expect(bars(stats.hacker.food.items)).toEqual([["Boba", 2]]);
    expect(stats.hacker.food).toMatchObject({ answered: 2, missing: 1, distinct: 1 });
    expect(bars(stats.hacker.activities.items)).toEqual([["5K", 1], ["Smash tournament", 1]]);
    expect(stats.hacker.activities.missing).toBe(1);
  });

  it("breaks mentors and judges down by role, decision, track and affiliation, with the form's labels", () => {
    expect(bars(stats.staff.byRole.items)).toEqual([["Mentor", 1], ["Judge", 1], ["Mentor & judge", 1]]);
    expect(stats.staff.decisions.find(d => d.key === "accepted")).toMatchObject({ count: 1, staged: 1 });
    // Every 2027 track, 0 where no judge has picked it yet.
    expect(bars(stats.staff.tracks.items)).toEqual([
      ["Biotech & Life Sciences", 1], ["Social Good", 1], ["Defense & Cybersecurity", 0], ["Entertainment", 0], ["Finance", 0],
    ]);
    expect(stats.staff.tracks).toMatchObject({ answered: 2, distinct: 2 });
    expect(bars(stats.staff.affiliation.items)).toEqual([["UCSD alumni", 1], ["Not affiliated with UCSD", 2]]);
  });

  it("breaks mentors and judges down by company and kind of job, without drafts", () => {
    expect(bars(stats.staff.companies.items)).toEqual([["Qualcomm", 2], ["University of California, San Diego", 1]]);
    expect(stats.staff.companies).toMatchObject({ answered: 3, missing: 0, distinct: 2 });
    expect(bars(stats.staff.jobs.items)).toEqual([["Software Engineering", 1], ["Data / Analytics", 1], ["Student / Academic", 1]]);
  });

  it("counts how mentors and judges heard about DataHacks, apart from hackers", () => {
    expect(bars(stats.staff.heardAbout.items)).toEqual([["Word of Mouth", 2], ["DataHacks Industry Sponsor", 1]]);
    expect(stats.staff.heardAbout).toMatchObject({ answered: 2, missing: 1 });
    expect(stats.hacker.heardAbout.items.map(i => i.label)).not.toContain("Word of Mouth");
  });
});

describe("judging tracks", () => {
  it("are DataHacks 2027's, as the database takes them (the latest applications_judging_track_check)", () => {
    const dir = join(__dirname, "../../supabase/migrations");
    const sql = readdirSync(dir).sort().map(f => readFileSync(join(dir, f), "utf8")).join("\n").replace(/--.*$/gm, "");
    const latest = sql.slice(sql.lastIndexOf("add constraint applications_judging_track_check"));
    const allowed = [...latest.slice(0, latest.indexOf(";")).matchAll(/'([^']*)'/g)].map(m => m[1]);
    expect(Object.keys(JUDGING_TRACK_LABEL)).toEqual(allowed);
    expect(Object.values(JUDGING_TRACK_LABEL)).toEqual(["Social Good", "Biotech & Life Sciences", "Defense & Cybersecurity", "Finance", "Entertainment"]);
  });
});

describe("share", () => {
  it("rounds, shows a sliver as <1%, and is blank with nothing to share", () => {
    expect(share(1, 3)).toBe("33%");
    expect(share(1, 400)).toBe("<1%");
    expect(share(0, 5)).toBe("0%");
    expect(share(1, 0)).toBe("");
  });
});
