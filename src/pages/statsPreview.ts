import { StatsPausedError, type Bucket, type PublicStats } from "./statsData";

/**
 * `npm run dev` with `?preview`: made-up numbers for the live stats page, so it
 * can be looked at without a database. Each refresh adds an application or two,
 * so the refresh can be seen working. Other modes act out the page's states:
 *   ?preview=empty    no applications yet
 *   ?preview=error    the request fails
 *   ?preview=paused   the event's stats are switched off (stats_public = false)
 *   ?preview=slow     takes 3 seconds, to see the loading state
 * Only loaded in development (statsData.fetchPublicStats); never in a build.
 */

const DAILY = [64, 41, 23, 29, 18, 33, 21, 26, 12];

let arrivals = 0;

/** Today's date in Pacific time, as the database gives it ("2026-11-09"). */
const pacificToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());

const daysBefore = (date: string, n: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
};

/** Shares of `total` for the named groups, the rest in "Other" (as the database folds groups under 5). */
const split = (total: number, shares: [string, number][]): Bucket[] => {
  const named = shares.map(([label, share]) => ({ label, count: Math.round(total * share) })).filter(b => b.count >= 5);
  const other = total - named.reduce((sum, b) => sum + b.count, 0);
  return other >= 5 ? [...named, { label: "Other", count: other }] : named;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function previewStats(mode: string): Promise<PublicStats> {
  await sleep(mode === "slow" ? 3000 : 250);
  if (mode === "error") throw new Error("Preview: the stats request failed.");
  if (mode === "paused") throw new StatsPausedError();
  if (mode === "empty") {
    return {
      hackers: 0, schools: 0, firstTime: 0, attendedBefore: 0, countries: 0, mentorsJudges: 2,
      topSchools: [], levels: [], majors: [], graduationYears: [], perDay: [{ date: pacificToday(), count: 0, total: 0 }],
    };
  }

  arrivals += 1 + Math.floor(Math.random() * 2);
  const today = pacificToday();
  const counts = DAILY.map((n, i) => (i === DAILY.length - 1 ? n + arrivals : n));
  let total = 0;
  const perDay = counts.map((count, i) => {
    total += count;
    return { date: daysBefore(today, counts.length - 1 - i), count, total };
  });
  const hackers = total;

  return {
    hackers,
    schools: 41,
    firstTime: Math.round(hackers * 0.46),
    attendedBefore: Math.round(hackers * 0.18),
    countries: 6,
    mentorsJudges: 37,
    topSchools: split(hackers, [
      ["University of California, San Diego", 0.52],
      ["University of California, Irvine", 0.07],
      ["San Diego State University", 0.06],
      ["University of California, Los Angeles", 0.05],
      ["University of California, Berkeley", 0.04],
      ["University of Southern California", 0.03],
      ["University of California, Santa Cruz", 0.025],
      ["California Polytechnic State University, San Luis Obispo", 0.02],
    ]),
    levels: split(hackers, [
      ["Undergraduate (3+ year: bachelor's)", 0.71],
      ["Graduate (master's, doctoral)", 0.17],
      ["Undergraduate (2-year: community college, associate's)", 0.06],
      ["High school", 0.025],
    ]),
    majors: split(hackers, [
      ["Data Science", 0.31],
      ["Computer Science", 0.24],
      ["Cognitive Science", 0.08],
      ["Mathematics-Computer Science", 0.06],
      ["Mathematics", 0.05],
      ["Electrical Engineering", 0.04],
      ["Economics", 0.035],
      ["Bioengineering", 0.03],
    ]),
    graduationYears: split(hackers, [
      ["2026", 0.08],
      ["2027", 0.29],
      ["2028", 0.27],
      ["2029", 0.22],
      ["2030", 0.08],
      ["Already graduated", 0.03],
    ]),
    perDay,
  };
}
