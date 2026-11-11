import { GRADUATION_YEARS, HACKATHON_EXPERIENCE, HEARD_ABOUT, LEVELS_OF_STUDY, RACES, STAFF_HEARD_ABOUT, TRAVEL_DISTANCES } from "@/staff-portal/formOptions";
import type { StatsData } from "./data";
import type { StatsRow } from "./stats";
import type { ApplicantType, Decision } from "./types";

/**
 * `npm run dev` with `?preview`: a made-up application season for the Stats
 * page, so it can be looked at without real applicants. About 900 hackers
 * from November 3 to the December 15 deadline (busy on launch day and at each
 * deadline), 45 drafts, and 75 mentors and judges, with free text typed the
 * way people do ("UCSD", "data science "). Each reload adds a submission or
 * two, so the live parts move. Same seed every time; loaded only in the
 * preview, and nothing here touches the database.
 */

// mulberry32: a tiny seeded random, so the preview looks the same on every load.
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Weighted<T> = readonly (readonly [T, number])[];

const SCHOOLS: Weighted<string | null> = [
  ["University of California, San Diego", 330], ["UCSD", 40], ["UC San Diego", 25], ["ucsd", 8],
  ["San Diego State University", 50], ["SDSU", 10], ["University of California, Irvine", 35], ["UC Irvine", 8],
  ["University of California, Los Angeles", 30], ["UCLA", 10], ["University of San Diego", 20],
  ["University of California, Berkeley", 18], ["University of Southern California", 15], ["San Diego Mesa College", 14],
  ["University of California, Santa Cruz", 12], ["University of California, Riverside", 10],
  ["California State University San Marcos", 9], ["Stanford University", 8], ["Arizona State University", 8],
  ["San Jose State University", 6], ["Purdue University", 6], ["University of Washington", 6],
  ["Georgia Institute of Technology", 5], ["MiraCosta College", 4], ["Carnegie Mellon University", 2],
  ["University of Michigan", 2], ["Cornell University", 1], ["Rice University", 1], ["University of Toronto", 1],
  ["Northeastern University", 1], ["Grossmont College", 2], ["Southwestern College", 2], ["Point Loma Nazarene University", 2],
  ["Cal Poly Pomona", 1], ["University of Arizona", 1], ["Oregon State University", 1], ["Universidad Autónoma de Baja California", 1],
  [null, 3],
];

const SAN_DIEGO = new Set(["University of California, San Diego", "UCSD", "UC San Diego", "ucsd", "San Diego State University", "SDSU",
  "University of San Diego", "San Diego Mesa College", "California State University San Marcos", "MiraCosta College",
  "Grossmont College", "Southwestern College", "Point Loma Nazarene University"]);

const MAJORS: Weighted<string> = [
  ["Data Science", 260], ["data science", 20], ["Data Science ", 10], ["DATA SCIENCE", 5], ["Computer Science", 200],
  ["computer science", 15], ["Cognitive Science", 60], ["Mathematics-Computer Science", 50], ["Math-CS", 10],
  ["Mathematics", 40], ["Computer Engineering", 40], ["Bioengineering", 35], ["Electrical Engineering", 30], ["Economics", 25],
  ["Business Analytics", 20], ["Bioinformatics", 18], ["Statistics", 18], ["Biology", 12], ["Mechanical Engineering", 12],
  ["Physics", 10], ["Applied Mathematics", 9], ["Chemistry", 6], ["Political Science", 6], ["Undeclared", 5],
];

const LEVELS: Weighted<string> = [
  [LEVELS_OF_STUDY[2], 75], [LEVELS_OF_STUDY[1], 6], [LEVELS_OF_STUDY[3], 12], [LEVELS_OF_STUDY[0], 2],
  [LEVELS_OF_STUDY[4], 0.5], [LEVELS_OF_STUDY[5], 1], [LEVELS_OF_STUDY[7], 2], [LEVELS_OF_STUDY[8], 0.5],
];

const YEARS: Weighted<string> = [
  ["2026", 10], ["2027", 25], ["2028", 25], ["2029", 22], ["2030", 10], ["2031", 2],
  [GRADUATION_YEARS[GRADUATION_YEARS.length - 2], 4], [GRADUATION_YEARS[GRADUATION_YEARS.length - 1], 2],
];

const EXPERIENCE: Weighted<string> = [[HACKATHON_EXPERIENCE[0], 42], [HACKATHON_EXPERIENCE[1], 32], [HACKATHON_EXPERIENCE[2], 17], [HACKATHON_EXPERIENCE[3], 9]];

const COUNTRIES: Weighted<string> = [
  ["United States", 900], ["India", 15], ["Canada", 8], ["Mexico", 8], ["China", 6], ["South Korea", 4], ["Taiwan", 3],
  ["Japan", 2], ["Vietnam", 2], ["Brazil", 1], ["Germany", 1], ["United Kingdom", 1],
];

const HEARD: Weighted<string> = [
  [HEARD_ABOUT[2], 40], [HEARD_ABOUT[3], 30], [HEARD_ABOUT[0], 25], [HEARD_ABOUT[8], 15], [HEARD_ABOUT[1], 12],
  [HEARD_ABOUT[6], 12], [HEARD_ABOUT[4], 10], [HEARD_ABOUT[7], 8], [HEARD_ABOUT[5], 5], [HEARD_ABOUT[9], 3],
];

const REGIONS: Weighted<readonly [string, string]> = [
  [["Los Angeles, CA", TRAVEL_DISTANCES[1]], 30], [["los angeles", TRAVEL_DISTANCES[1]], 6], [["Irvine, CA", TRAVEL_DISTANCES[1]], 22],
  [["Bay Area", TRAVEL_DISTANCES[2]], 14], [["San Francisco, CA", TRAVEL_DISTANCES[2]], 8], [["Riverside, CA", TRAVEL_DISTANCES[1]], 8],
  [["Santa Cruz, CA", TRAVEL_DISTANCES[2]], 8], [["San Jose, CA", TRAVEL_DISTANCES[2]], 6], [["Phoenix, AZ", TRAVEL_DISTANCES[2]], 6],
  [["Seattle, WA", TRAVEL_DISTANCES[3]], 5], [["West Lafayette, IN", TRAVEL_DISTANCES[3]], 4], [["Atlanta, GA", TRAVEL_DISTANCES[3]], 4],
  [["Tijuana, Mexico", TRAVEL_DISTANCES[0]], 3], [["Orange County", TRAVEL_DISTANCES[1]], 3], [["Toronto, Canada", TRAVEL_DISTANCES[4]], 1],
  [["Bangalore, India", TRAVEL_DISTANCES[4]], 1],
];

const GENDER: Weighted<string> = [["Man", 52], ["Woman", 40], ["Non-binary", 3], ["Prefer to self-describe", 1], ["Prefer not to say", 4]];

const RACE: Weighted<string> = [
  [RACES[1], 55], [RACES[6], 18], [RACES[3], 15], [RACES[2], 4], [RACES[4], 3], [RACES[0], 1], [RACES[5], 1], [RACES[7], 2], [RACES[8], 3],
];

const FOODS: Weighted<string> = [
  ["Boba", 120], ["boba", 30], ["Boba tea", 25], ["Poke bowls", 60], ["poke", 15], ["Tacos", 70], ["tacos", 12],
  ["Pizza", 55], ["Sushi", 40], ["Korean BBQ", 30], ["Ramen", 28], ["Acai bowls", 20], ["Ice cream", 18], ["Dumplings", 15],
  ["Burritos", 15], ["Mango sticky rice", 8], ["Vegan options!", 10], ["Hot Cheetos", 6], ["Matcha", 9], ["Churros", 7],
];

const ACTIVITIES: Weighted<string> = [
  ["Smash tournament", 90], ["smash bros tournament", 20], ["Super Smash Bros", 15], ["5K", 35], ["5k run", 10],
  ["Karaoke", 45], ["Trivia night", 35], ["trivia", 10], ["Board games", 30], ["Yoga", 22], ["Cup stacking", 12],
  ["Mario Kart", 25], ["Chess tournament", 18], ["Nap room", 10], ["Typing speed contest", 12], ["Ping pong", 14],
  ["Beach cleanup", 6], ["Kahoot", 15], ["Rubik's cube race", 5], ["Dance party", 8],
];

const TRACKS: Weighted<string> = [["social_good", 20], ["biotech_life_sciences", 25], ["defense_cybersecurity", 15], ["finance", 25], ["entertainment", 15]];
const AFFILIATIONS: Weighted<string> = [["none", 55], ["alumni", 25], ["student", 10], ["faculty", 10]];
const STAFF_HEARD: Weighted<string> = [
  [STAFF_HEARD_ABOUT[6], 30], [STAFF_HEARD_ABOUT[1], 25], [STAFF_HEARD_ABOUT[4], 22], [STAFF_HEARD_ABOUT[0], 20], [STAFF_HEARD_ABOUT[3], 18],
  [STAFF_HEARD_ABOUT[2], 6], [STAFF_HEARD_ABOUT[7], 6], [STAFF_HEARD_ABOUT[5], 5], [STAFF_HEARD_ABOUT[8], 4],
];

// Mentors' and judges' companies and job titles, typed the way people do.
const ORGANIZATIONS: Weighted<string> = [
  ["Qualcomm", 9], ["qualcomm", 2], ["Qualcomm Inc.", 2], ["UC San Diego", 5], ["UCSD", 4], ["University of California, San Diego", 2],
  ["Intuit", 5], ["Apple", 4], ["Apple Inc", 1], ["Google", 4], ["Amazon", 3], ["Amazon (AWS)", 2], ["Illumina", 4], ["Microsoft", 3],
  ["Meta", 3], ["Dexcom", 3], ["NVIDIA", 2], ["Nvidia", 1], ["General Atomics", 2], ["Scripps Research", 2], ["ServiceNow", 2],
  ["Salesforce", 2], ["Northrop Grumman", 2], ["Sony Interactive Entertainment", 1], ["Visa", 1], ["LPL Financial", 1],
  ["Rady Children's Hospital", 1], ["Booz Allen Hamilton", 1], ["Stealth startup", 1], ["Viasat", 1], ["Teradata", 1],
];

const JOB_TITLES: Weighted<string> = [
  ["Software Engineer", 10], ["Senior Software Engineer", 6], ["SWE II", 2], ["Data Scientist", 8], ["Senior Data Scientist", 3],
  ["Machine Learning Engineer", 6], ["ML Engineer", 2], ["Applied Scientist", 2], ["Data Engineer", 3], ["Data Analyst", 2],
  ["Product Manager", 4], ["Technical Program Manager", 1], ["Research Scientist", 3], ["Engineering Manager", 3],
  ["Staff Software Engineer", 2], ["Co-founder & CEO", 2], ["Director of Data Science", 1], ["Security Engineer", 2],
  ["PhD Student", 4], ["Assistant Professor", 2], ["Lecturer", 1], ["Venture Partner", 1], ["Consultant", 1], ["Bioinformatician", 1],
];

/** Submissions per day from November 3: a launch spike, a quiet middle, a rush at each deadline. */
function perDay(day: number, rand: () => number) {
  const launch = 70 * Math.exp(-day / 2.2);
  const priority = 95 * Math.exp(-Math.abs(day - 26) / 1.4) * (day <= 26 ? 1 : 0.15);
  const regular = 85 * Math.exp(-Math.abs(day - 42) / 1.3);
  return Math.round(launch + priority + regular + 7 + rand() * 6);
}

const OPENED = Date.parse("2026-11-03T08:00:00Z"); // midnight Pacific
const DAYS = 43; // to December 15

let fixture: StatsRow[] | null = null;
let reloads = 0;

function build(): StatsRow[] {
  const rand = seeded(1500);
  // Their own streams for the suggestions and for mentors' companies and job titles, so the rest of the sample
  // stays as it was before those were asked or counted.
  const ideas = seeded(2027);
  const work = seeded(2028);
  const pickWith = <T,>(stream: () => number, options: Weighted<T>): T => {
    let r = stream() * options.reduce((s, [, w]) => s + w, 0);
    for (const [value, w] of options) if ((r -= w) < 0) return value;
    return options[options.length - 1][0];
  };
  const pick = <T,>(options: Weighted<T>): T => pickWith(rand, options);
  const pickIdea = (options: Weighted<string>) => pickWith(ideas, options);
  const pickWork = (options: Weighted<string>) => pickWith(work, options);
  const pickSome = <T,>(options: Weighted<T>, most: number): T[] => {
    const n = 1 + Math.floor(Math.pow(rand(), 2.2) * most);
    return [...new Set(Array.from({ length: n }, () => pick(options)))];
  };
  const blank = (id: string, type: ApplicantType): StatsRow => ({
    id, applicant_type: type, status: "submitted", submitted_at: null, school: null, major: null, level_of_study: null,
    graduation_year: null, hackathon_experience: null, attended_before: null, country_of_residence: null, heard_about: null,
    suggested_food: null, suggested_activity: null, wants_travel_stipend: null, travel_region: null, travel_distance: null, gender: null, race_ethnicity: null,
    judging_track: null, ucsd_affiliation: null, organization: null, role_title: null, decision: null, checkedIn: false,
  });
  /** Earlier applications are likelier to have a decision by now; some released, some only staged. */
  const decide = (row: StatsRow, chance: number, weights: Weighted<Decision>) => {
    if (rand() >= chance) return;
    const decision = pick(weights);
    row.decision = decision;
    if (rand() < 0.6) row.status = decision;
  };

  const rows: StatsRow[] = [];
  let n = 0;
  for (let day = 0; day < DAYS; day++) {
    const count = perDay(day, rand);
    for (let i = 0; i < count; i++) {
      const school = pick(SCHOOLS);
      const travel = school !== null && !SAN_DIEGO.has(school) ? rand() < 0.35 : rand() < 0.03;
      const [region, distance] = travel ? pick(REGIONS) : [null, null];
      const row: StatsRow = {
        ...blank(`ph${++n}`, "hacker"),
        submitted_at: new Date(OPENED + day * 86_400_000 + Math.floor(rand() * 1440) * 60_000).toISOString(),
        school, major: pick(MAJORS), level_of_study: pick(LEVELS), graduation_year: pick(YEARS),
        hackathon_experience: pick(EXPERIENCE), attended_before: rand() < 0.22, country_of_residence: pick(COUNTRIES),
        heard_about: pickSome(HEARD, 3), wants_travel_stipend: travel, travel_region: region, travel_distance: distance,
        gender: pick(GENDER), race_ethnicity: pickSome(RACE, 2).join("; "),
        // Asked from the second week on: the launch-week applicants have no answer.
        ...(day >= 7 ? { suggested_food: pickIdea(FOODS), suggested_activity: pickIdea(ACTIVITIES) } : {}),
      };
      if (day <= 26) decide(row, 0.75, [["accepted", 60], ["waitlisted", 20], ["rejected", 12]]);
      rows.push(row);
    }
  }
  // Started, not submitted.
  for (let i = 0; i < 45; i++) rows.push({ ...blank(`pd${i}`, "hacker"), status: "draft", school: pick(SCHOOLS) });

  const roles: Weighted<ApplicantType> = [["mentor", 30], ["judge", 20], ["hybrid", 25]];
  for (let i = 0; i < 75; i++) {
    const type = pick(roles);
    const row: StatsRow = {
      ...blank(`ps${i}`, type),
      submitted_at: new Date(OPENED + Math.floor(rand() * DAYS) * 86_400_000).toISOString(),
      judging_track: type === "mentor" ? null : pick(TRACKS), ucsd_affiliation: pick(AFFILIATIONS),
      organization: pickWork(ORGANIZATIONS), role_title: pickWork(JOB_TITLES),
      // A few applied before the question was asked.
      heard_about: i < 8 ? null : pickSome(STAFF_HEARD, 2),
    };
    decide(row, 0.55, [["accepted", 80], ["waitlisted", 8], ["rejected", 8]]);
    rows.push(row);
  }
  for (let i = 0; i < 6; i++) rows.push({ ...blank(`psd${i}`, pick(roles)), status: "draft" });
  return rows;
}

export function previewStats(): StatsData {
  fixture ??= build();
  // A new application or two with every reload, on the last day.
  const rand = seeded(reloads + 7);
  if (reloads++ > 0) {
    const submitted = fixture.filter(r => r.applicant_type === "hacker" && r.status !== "draft");
    for (let i = 0, k = 1 + Math.floor(rand() * 2); i < k; i++) {
      const like = submitted[Math.floor(rand() * submitted.length)];
      // December 15, between 1 and 11 PM Pacific: before the deadline, in the regular batch.
      const at = new Date(Date.parse("2026-12-16T07:00:00Z") - Math.floor(rand() * 600) * 60_000).toISOString();
      fixture.push({ ...like, id: `pn${reloads}-${i}`, submitted_at: at, status: "submitted", decision: null, checkedIn: false });
    }
  }
  return { rows: fixture.map(r => ({ ...r })), hasRoster: true };
}
