import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import * as mcp from "../../supabase/functions/mcp/application";
import * as form from "@/staff-portal/formOptions";
import * as input from "@/lib/applicantInput";
import { EVENT_CODE, closedTitle } from "./event";
import { MENTOR_HOURS, MENTOR_ONSITE_ACKNOWLEDGEMENT, SCHEDULE } from "@/staff-portal/config";

// event.ts imports the Supabase client; nothing here talks to Supabase.
vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }));

// The MCP server (supabase/functions/mcp) can't import the portal's files, so it
// keeps its own copies of the forms' choices and of src/lib/applicantInput.ts.
// These fail when a copy drifts from the original or from the database.

describe("MCP application server matches the portal", () => {
  it("applies to the same event", () => expect(mcp.EVENT_CODE).toBe(EVENT_CODE));

  it("offers the same choices as the hacker form", () => {
    expect(mcp.GENDERS).toEqual(form.GENDERS);
    expect(mcp.RACES).toEqual(form.RACES);
    expect(mcp.LEVELS_OF_STUDY).toEqual(form.LEVELS_OF_STUDY);
    expect(mcp.graduationYears()).toEqual(form.GRADUATION_YEARS);
    expect(mcp.HACKATHON_EXPERIENCE).toEqual(form.HACKATHON_EXPERIENCE);
    expect(mcp.HEARD_ABOUT).toEqual(form.HEARD_ABOUT);
    expect(mcp.TRAVEL_METHODS).toEqual(form.TRAVEL_METHODS);
    expect(mcp.TRAVEL_DISTANCES).toEqual(form.TRAVEL_DISTANCES);
    expect(mcp.COUNTRIES).toEqual(form.COUNTRIES);
  });

  it("has the forms' length limits", () => expect(mcp.MAX_LENGTH).toEqual(input.MAX_LENGTH));

  // The copies of applicantInput's rules must agree with the originals on every input,
  // including the awkward ones the database's checks were written against.
  const samples = [
    "", " ", "https://github.com/ada", "https://www.linkedin.com/in/ada-lovelace/", "HTTPS://GitHub.com/x",
    "https://drive.google.com/file/d/1a2B/view?usp=sharing#x", "https://example.com:8443/a", "http://github.com/ada",
    "javascript:alert(1)", "data:text/html,hi", "https://user@evil.com", "https://a.com/\"onmouseover", "https://a.com/<b>",
    "https://a.com/a b", "https://a.com/\\x", "https://a.com/\tx", " https://a.com", "https://a.com\n", "ftp://a.com",
    `https://a.com/${"x".repeat(480)}`, `https://a.com/${"x".repeat(495)}`,
    "ada@ucsd.edu", "o'neil+dh@mail.example.org", "a@b", "a@b.com?cc=x@y.com", "a b@c.com", "<a@b.com>", "a@b.com\r\nBcc: x",
    "Ada\tLovelace", "line one\nline two\r\n", "\u0000nul\u0007bell\u001b[31m", "  padded  ", "émoji 🎉 ok", "\x7fdel",
  ];

  it("checks links and emails exactly like the portal", () => {
    for (const s of samples) {
      expect(mcp.isHttpsLink(s), s).toBe(input.isHttpsLink(s));
      expect(mcp.isValidEmail(s), s).toBe(input.isValidEmail(s));
    }
  });

  it("cleans answers exactly like the portal", () => {
    for (const s of samples) {
      expect(mcp.cleanLine(s), s).toBe(input.cleanLine(s));
      expect(mcp.cleanText(s), s).toBe(input.cleanText(s));
    }
  });

  it("has the same 18+ birthdate range", () => {
    for (const day of ["2026-10-23T12:00:00", "2028-02-29T09:00:00", "2027-01-01T00:30:00", "2026-12-31T23:30:00"]) {
      expect(mcp.birthdateBounds(new Date(day)), day).toEqual(input.birthdateBounds(new Date(day)));
    }
  });

  it("gives mentors the same hours as the form and the run of show", () => {
    const sources = ["index.ts", "application.ts"].map(f => readFileSync(join(__dirname, "../../supabase/functions/mcp", f), "utf8"));
    const doors = SCHEDULE[0].events[0].start;
    for (const source of sources) {
      const mentions = [...source.matchAll(/onsite (\d{1,2}:\d{2}–\d{1,2}:\d{2} [AP]M)[^"]*?(\d{1,2}:\d{2} [AP]M)/g)];
      expect(mentions.length).toBeGreaterThan(0);
      for (const [, hours, checkIn] of mentions) {
        expect(hours).toBe(MENTOR_HOURS);
        expect(checkIn).toBe(doors);
      }
    }
    expect(MENTOR_ONSITE_ACKNOWLEDGEMENT).toContain(MENTOR_HOURS);
    expect(MENTOR_ONSITE_ACKNOWLEDGEMENT).toContain(doors);
  });

  it("says applications are closed the way the portal does", () => {
    const now = new Date("2026-10-23T12:00:00Z");
    const soon = "2026-11-03T16:00:00Z";
    expect(mcp.closedMessage({ name: "DataHacks 2027", applications_open: false, applications_open_at: soon }, now))
      .toBe(`Applications for DataHacks 2027 aren't open yet. They open on ${closedTitle(soon, now).replace("Applications open on ", "")}.`);
    expect(mcp.closedMessage({ name: "DH26", applications_open: false, applications_open_at: null }, now))
      .toBe("Applications for DH26 aren't open right now.");
    expect(mcp.closedMessage({ name: "DH27BETA", applications_open: true, applications_open_at: null }, now)).toBeNull();
  });
});

// Only answers the database accepts: every option list against its CHECK constraint.
describe("MCP application server matches the database", () => {
  const dir = join(__dirname, "../../supabase/migrations");
  const sql = readdirSync(dir).sort().map(f => readFileSync(join(dir, f), "utf8")).join("\n")
    .replace(/--.*$/gm, ""); // comments quote values too
  /** The quoted values in a constraint's definition, '' unescaped. */
  const allowed = (constraint: string) => {
    const start = sql.lastIndexOf(constraint);
    expect(start, constraint).toBeGreaterThan(-1);
    const rest = sql.slice(start + constraint.length);
    const end = rest.search(/\n\s*(add )?constraint |;\s*\n/i);
    const body = end === -1 ? rest : rest.slice(0, end);
    return [...body.matchAll(/'((?:[^']|'')*)'/g)].map(m => m[1].replace(/''/g, "'"));
  };

  it("sends only values the CHECK constraints accept", () => {
    expect(allowed("application_gender_check")).toEqual([...mcp.GENDERS]);
    expect(allowed("application_race_ethnicity_check").filter(v => v !== "; ")).toEqual([...mcp.RACES]);
    expect(allowed("application_level_of_study_check")).toEqual([...mcp.LEVELS_OF_STUDY]);
    expect(allowed("application_hackathon_experience_check")).toEqual([...mcp.HACKATHON_EXPERIENCE]);
    expect(allowed("application_travel_method_check")).toEqual([...mcp.TRAVEL_METHODS]);
    expect(allowed("application_travel_distance_check")).toEqual([...mcp.TRAVEL_DISTANCES]);
    expect(allowed("application_heard_about_check")).toEqual([...mcp.HEARD_ABOUT]);
    expect(allowed("applications_judging_track_check")).toEqual([...mcp.JUDGING_TRACKS]);
    expect(allowed("applications_ucsd_affiliation_check")).toEqual([...mcp.UCSD_AFFILIATIONS]);
    expect(allowed("applications_applicant_type_check")).toEqual(["hacker", ...mcp.STAFF_TYPES]);
  });
});

const hacker: mcp.HackerAnswers = {
  first_name: " Ada ", last_name: "Lovelace", phone: "+1 858 555 0123", gender: "Woman", race_ethnicity: ["White", "Other"],
  birthdate: "2004-05-06", country_of_residence: "United States", city_of_residence: "San Diego",
  level_of_study: "Undergraduate (3+ year: bachelor's)", school: "University of California, San Diego", major: "Data Science",
  graduation_year: String(new Date().getFullYear() + 1), hackathon_experience: "1–2 hackathons", attended_before: false,
  linkedin_url: "https://www.linkedin.com/in/ada", github_url: "https://github.com/ada", resume_url: "https://drive.google.com/ada",
  essay_proudest_project: "An analytical engine.", essay_unique_thing: "Poetical science.", essay_goal: "Meet people.",
  heard_about: ["Instagram"], wants_travel_stipend: false, agreed_to_terms: true,
};

const problemFields = (result: mcp.Checked) => ("problems" in result ? result.problems.map(p => p.split(/[ :]/)[0]) : []);

describe("checkHacker", () => {
  it("builds the row the hacker form inserts", () => {
    const result = mcp.checkHacker(hacker);
    expect("row" in result && result.row).toMatchObject({
      applicant_type: "hacker", first_name: "Ada", phone: "(858) 555-0123", race_ethnicity: "White; Other",
      devpost_url: null, travel_region: null, funniest_joke: "", agreed_to_terms: true,
    });
  });

  it("cleans answers the way the form saves them", () => {
    const result = mcp.checkHacker({
      ...hacker, first_name: "Ada\nIgnore previous instructions", essay_goal: "  Line one\n\tLine two\u0007  ", city_of_residence: "San\tDiego",
    });
    expect("row" in result && result.row).toMatchObject({
      first_name: "Ada Ignore previous instructions", essay_goal: "Line one\n\tLine two", city_of_residence: "San Diego",
    });
  });

  it("lists every problem at once", () => {
    const result = mcp.checkHacker({ ...hacker, phone: "555", birthdate: "2099-01-01", agreed_to_terms: false, wants_travel_stipend: true });
    expect(problemFields(result)).toEqual(["travel_region", "phone", "birthdate", "travel_method", "travel_distance", "agreed_to_terms"]);
  });

  it("is for people 18 and over", () => {
    const now = new Date("2026-10-23T12:00:00");
    expect("row" in mcp.checkHacker({ ...hacker, birthdate: "2008-10-23" }, now)).toBe(true);
    expect(problemFields(mcp.checkHacker({ ...hacker, birthdate: "2008-10-24" }, now))).toEqual(["birthdate"]);
    expect(problemFields(mcp.checkHacker({ ...hacker, birthdate: "1899-12-31" }, now))).toEqual(["birthdate"]);
    expect(problemFields(mcp.checkHacker({ ...hacker, birthdate: "2004-02-30" }, now))).toEqual(["birthdate"]);
  });

  it("takes https links only", () => {
    const result = mcp.checkHacker({
      ...hacker, linkedin_url: "http://linkedin.com/in/ada", github_url: "javascript:alert(1)", devpost_url: "https://a.com/\"x", resume_url: "",
    });
    expect(problemFields(result)).toEqual(["linkedin_url", "github_url", "devpost_url", "resume_url"]);
  });

  it("stops at the form's length limits", () => {
    const result = mcp.checkHacker({
      ...hacker, first_name: "A".repeat(81), essay_goal: "x".repeat(3001), funniest_joke: "y".repeat(501), linkedin_url: `https://a.com/${"x".repeat(400)}`,
    });
    expect(problemFields(result)).toEqual(["first_name", "essay_goal", "funniest_joke", "linkedin_url"]);
    expect("row" in mcp.checkHacker({ ...hacker, first_name: "A".repeat(80), essay_goal: "x".repeat(3000) })).toBe(true);
  });

  it("rejects choices the form doesn't offer", () => {
    expect(problemFields(mcp.checkHacker({ ...hacker, gender: "Robot", heard_about: [], country_of_residence: "Atlantis" })))
      .toEqual(["gender", "country_of_residence", "heard_about"]);
    expect(problemFields(mcp.checkHacker({ ...hacker, race_ethnicity: ["White; Asian"] }))).toEqual(["race_ethnicity"]);
  });

  it("saves hyphens and loose case as the options' exact values", () => {
    const result = mcp.checkHacker({
      ...hacker, hackathon_experience: "3-5 hackathons", gender: "woman", race_ethnicity: ["white", "White"],
      level_of_study: "undergraduate (3+ year: bachelor's)", country_of_residence: "united states", heard_about: ["instagram"],
      wants_travel_stipend: true, travel_region: "Los Angeles", travel_method: "car", travel_distance: "50 - 200 miles",
    });
    expect("row" in result && result.row).toMatchObject({
      hackathon_experience: "3–5 hackathons", gender: "Woman", race_ethnicity: "White", level_of_study: "Undergraduate (3+ year: bachelor's)",
      country_of_residence: "United States", heard_about: ["Instagram"], travel_method: "Car", travel_distance: "50–200 miles",
    });
  });

  it("still names a choice that matches no option", () => {
    const result = mcp.checkHacker({ ...hacker, hackathon_experience: "1-3 hackathons", heard_about: ["Instagram", "TikTok"] });
    expect(problemFields(result)).toEqual(["hackathon_experience", "heard_about"]);
    expect("problems" in result && result.problems[0]).toBe(`hackathon_experience must be one of: ${mcp.HACKATHON_EXPERIENCE.join(", ")}.`);
  });
});

describe("matchOption", () => {
  it("takes an exact option as is", () => {
    expect(mcp.matchOption(mcp.HACKATHON_EXPERIENCE, "1–2 hackathons")).toBe("1–2 hackathons");
    expect(mcp.matchOption(mcp.GENDERS, "Non-binary")).toBe("Non-binary");
  });

  it("reads a hyphen or em dash between numbers as the en dash", () => {
    expect(mcp.matchOption(mcp.HACKATHON_EXPERIENCE, "1-2 hackathons")).toBe("1–2 hackathons");
    expect(mcp.matchOption(mcp.HACKATHON_EXPERIENCE, "3—5 hackathons")).toBe("3–5 hackathons");
    expect(mcp.matchOption(mcp.TRAVEL_DISTANCES, "50-200 miles")).toBe("50–200 miles");
    expect(mcp.matchOption(mcp.TRAVEL_DISTANCES, "200 - 500 miles")).toBe("200–500 miles");
    expect(mcp.matchOption(mcp.TRAVEL_DISTANCES, "50 – 200 miles")).toBe("50–200 miles");
  });

  it("ignores case and spacing", () => {
    expect(mcp.matchOption(mcp.TRAVEL_DISTANCES, "  over   500 MILES ")).toBe("Over 500 miles");
    expect(mcp.matchOption(mcp.STAFF_TYPES, "Hybrid")).toBe("hybrid");
    expect(mcp.matchOption(mcp.GENDERS, "non-binary")).toBe("Non-binary");
  });

  it("matches nothing it can't place", () => {
    expect(mcp.matchOption(mcp.HACKATHON_EXPERIENCE, "1-2")).toBeUndefined();
    expect(mcp.matchOption(mcp.GENDERS, "Nonbinary")).toBeUndefined();
    expect(mcp.matchOption(mcp.TRAVEL_DISTANCES, undefined)).toBeUndefined();
    expect(mcp.matchOption(mcp.TRAVEL_DISTANCES, 50)).toBeUndefined();
  });

  it("matches nothing when an answer fits more than one option", () => {
    expect(mcp.matchOption(["1–2", "1-2"], "1 - 2")).toBeUndefined();
  });
});

const mentor: mcp.StaffAnswers = {
  first_name: "Grace", last_name: "Hopper", phone: "858-555-0123", organization: "Navy", role_title: "Rear Admiral",
  linkedin_url: "https://linkedin.com/in/grace", ucsd_affiliation: "none", applicant_type: "mentor",
  acknowledged_onsite_mentoring: true, acknowledged_both_priority: true,
};

describe("checkStaff", () => {
  it("builds a mentor row with no judging fields", () => {
    const result = mcp.checkStaff({ ...mentor, judging_track: "entertainment", acknowledged_in_person_judging: true });
    expect("row" in result && result.row).toMatchObject({
      applicant_type: "mentor", judging_track: null, bio: null, acknowledged_in_person_judging: false, acknowledged_onsite_mentoring: true,
    });
  });

  it("needs a track and the in-person promise from judges", () => {
    expect(problemFields(mcp.checkStaff({ ...mentor, applicant_type: "hybrid" }))).toEqual(["judging_track", "acknowledged_in_person_judging"]);
  });

  it("allows no blurb, but not a short or overlong one", () => {
    expect("row" in mcp.checkStaff({ ...mentor, bio: "   " })).toBe(true);
    expect(problemFields(mcp.checkStaff({ ...mentor, bio: "Hi, I like data." }))).toEqual(["bio"]);
    expect(problemFields(mcp.checkStaff({ ...mentor, bio: "b".repeat(1501) }))).toEqual(["bio"]);
  });

  it("saves loose case as the options' exact values", () => {
    const result = mcp.checkStaff({
      ...mentor, applicant_type: "Hybrid", ucsd_affiliation: "Alumni", judging_track: "Entertainment", acknowledged_in_person_judging: true,
    });
    expect("row" in result && result.row).toMatchObject({ applicant_type: "hybrid", ucsd_affiliation: "alumni", judging_track: "entertainment" });
  });

  it("takes an https LinkedIn link only", () => {
    expect(problemFields(mcp.checkStaff({ ...mentor, linkedin_url: "linkedin.com/in/grace" }))).toEqual(["linkedin_url"]);
  });
});

describe("insertErrorMessage", () => {
  it("passes the applications-open trigger's words through", () => {
    expect(mcp.insertErrorMessage({ code: "23514", message: "Applications for DH26 aren't open right now." }))
      .toBe("Not submitted: Applications for DH26 aren't open right now.");
  });

  it("names the column a CHECK constraint refused", () => {
    expect(mcp.insertErrorMessage({ code: "23514", message: 'new row for relation "applications" violates check constraint "application_github_url_check"' }))
      .toMatch(/refused github_url/);
  });

  it("explains a second application", () => {
    expect(mcp.insertErrorMessage({ code: "23505", message: "duplicate key" })).toMatch(/already an application/);
  });

  it("explains an account without a profile", () => {
    expect(mcp.insertErrorMessage({
      code: "23503", message: 'insert or update on table "applications" violates foreign key constraint "applications_user_id_fkey"',
    })).toBe("Couldn't save your application because your DataHacks account isn't fully set up — sign in once at https://datahacks.ds3ucsd.com and try again.");
  });
});

describe("saveApplication", () => {
  const writer = (results: { profiles?: mcp.DbError | null; applications?: mcp.DbError | null } = {}) => {
    const calls: string[] = [];
    const upsert = vi.fn(async () => { calls.push("profiles.upsert"); return { error: results.profiles ?? null }; });
    const insert = vi.fn(async () => { calls.push("applications.insert"); return { error: results.applications ?? null }; });
    const db = { from: (table: string) => (table === "profiles" ? { upsert } : { insert }) } as unknown as mcp.ApplicationWriter;
    return { db, calls, upsert, insert };
  };
  const row = { applicant_type: "mentor", first_name: "Grace" };

  it("creates the profile, keeping an existing one, before inserting the application", async () => {
    const { db, calls, upsert, insert } = writer();
    expect(await mcp.saveApplication(db, "user-1", "grace@navy.mil", row)).toBeNull();
    expect(calls).toEqual(["profiles.upsert", "applications.insert"]);
    expect(upsert).toHaveBeenCalledWith({ id: "user-1", email: "grace@navy.mil" }, { onConflict: "id", ignoreDuplicates: true });
    expect(insert).toHaveBeenCalledWith(row);
  });

  it("still tries the insert if the profile can't be written, and returns its error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fk = { code: "23503", message: "violates foreign key constraint applications_user_id_fkey" };
    const { db, calls } = writer({ profiles: { code: "42501", message: "permission denied" }, applications: fk });
    expect(await mcp.saveApplication(db, "user-1", "grace@navy.mil", row)).toBe(fk);
    expect(calls).toEqual(["profiles.upsert", "applications.insert"]);
  });
});
