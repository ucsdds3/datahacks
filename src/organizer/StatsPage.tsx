import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { TIMELINE } from "@/staff-portal/config";
import DailyChart from "./DailyChart";
import { STATS_REFRESH_MS, useStats } from "./data";
import { isPreview } from "./preview";
import { computeStats, inScope, pacificDay, share, type Breakdown, type DecisionCount, type SchoolScope, type Stats } from "./stats";
import "./checkin.css";
import "./stats.css";

/**
 * The console's Stats section: how applications are going, live. Counts come
 * from the application rows (stats.ts); the page reloads them every minute
 * while it's open and the browser tab is showing, and on Refresh.
 * It only reads.
 */

const num = (n: number) => n.toLocaleString("en-US");

const SCOPES: [SchoolScope, string][] = [["all", "All"], ["ucsd", "UCSD"], ["other", "Non-UCSD"]];

const PRIORITY_DEADLINE = TIMELINE.priorityDeadline.toLocaleString("en-US", {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles",
});

export default function StatsPage({ eventId }: { eventId: string }) {
  const query = useStats(eventId);
  const [scope, setScope] = useState<SchoolScope>("all");
  const stats = useMemo(() => (query.data ? computeStats(inScope(query.data.rows, scope)) : null), [query.data, scope]);

  if (query.isPending) return <p className="og-empty">Loading stats…</p>;
  if (!stats) return <p className="sp-error">Couldn't load stats: {(query.error as Error | null)?.message ?? "unknown error"}</p>;

  const updated = new Date(query.dataUpdatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
  const stale = query.isError;

  return (
    <div className="og-st-page">
      <div className="og-ci-status og-st-status">
        <span className={`og-ci-live og-st-live ${stale ? "polling" : "live"}`}>
          <span className="og-ci-live-dot" aria-hidden />
          {stale ? "Offline" : "Live"}
        </span>
        <span>
          Last updated {updated} · refreshes every {STATS_REFRESH_MS / 1000} seconds{isPreview() && " · preview (sample data)"}
        </span>
        <div className="og-st-scope" role="group" aria-label="Which hackers to count">
          {SCOPES.map(([value, label]) => (
            <button key={value} className={`sp-button${scope === value ? " primary" : ""}`} aria-pressed={scope === value} onClick={() => setScope(value)}>
              {label}
            </button>
          ))}
        </div>
        <button className="sp-button" onClick={() => query.refetch()} disabled={query.isFetching}>
          <RefreshCw size={14} aria-hidden className={query.isFetching ? "og-st-spin" : undefined} /> {query.isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {stale && (
        <p className="sp-error" role="alert">Couldn't refresh: {(query.error as Error).message}. These are the numbers from {updated}.</p>
      )}

      <Overview stats={stats} />
      <Goal stats={stats} />

      <div className="og-st-grid">
        <section className="sp-card og-st-card">
          <div className="og-st-card-head"><h3>Applications over time</h3></div>
          <DailyChart days={stats.daily} markDay={pacificDay(TIMELINE.priorityDeadline)} markLabel="Priority deadline" />
        </section>
        <section className="sp-card og-st-card">
          <div className="og-st-card-head"><h3>Decisions</h3><span className="og-st-sub">{num(stats.hackers)} submitted</span></div>
          <Decisions counts={stats.decisions} of={stats.hackers} />
          {query.data?.hasRoster && <CheckedIn {...stats.checkin} />}
        </section>
      </div>

      <h2 className="og-st-heading">Hackers <small>submitted applications</small></h2>
      <div className="og-st-columns">
        <BarCard title="Schools" breakdown={stats.hacker.schools} sub={`${num(stats.schoolsRepresented)} schools`}
          foot="Spellings are grouped: UCSD, UC San Diego and University of California, San Diego are one school." />
        <BarCard title="Majors" breakdown={stats.hacker.majors} sub={`${num(stats.hacker.majors.distinct)} majors`}
          foot="Grouped ignoring capitals, spaces and punctuation." />
        <section className="sp-card og-st-card">
          <div className="og-st-card-head"><h3>Level of study</h3></div>
          <Bars breakdown={stats.hacker.level} />
          <h4>Graduation year</h4>
          <Bars breakdown={stats.hacker.graduation} />
          <Missing breakdown={stats.hacker.graduation} what="graduation year" />
        </section>
        <section className="sp-card og-st-card">
          <div className="og-st-card-head"><h3>Hackathon experience</h3></div>
          <Bars breakdown={stats.hacker.experience} />
          <h4>Been to DataHacks before</h4>
          <Bars breakdown={stats.hacker.attendedBefore} />
          <Missing breakdown={stats.hacker.attendedBefore} what="this" />
        </section>
        <BarCard title="Heard about DataHacks" breakdown={stats.hacker.heardAbout} multi />
        <BarCard title="Suggested food" breakdown={stats.hacker.food} sub={`${num(stats.hacker.food.distinct)} ideas`}
          foot="As typed, grouped ignoring capitals, spaces and punctuation." />
        <BarCard title="Suggested activities" breakdown={stats.hacker.activities} sub={`${num(stats.hacker.activities.distinct)} ideas`}
          foot="As typed, grouped ignoring capitals, spaces and punctuation." />
        <BarCard title="Country of residence" breakdown={stats.hacker.country} sub={`${num(stats.hacker.country.distinct)} countries`} />
        <Travel stats={stats} />
        <section className="sp-card og-st-card">
          <div className="og-st-card-head"><h3>Gender</h3><span className="og-st-tag">organizers only</span></div>
          <Bars breakdown={stats.hacker.gender} />
          <h4>Race / ethnicity <span className="og-st-tag">multi-select</span></h4>
          <Bars breakdown={stats.hacker.race} />
          <p className="og-st-foot">
            Race/ethnicity shares are of the {num(stats.hacker.race.answered)} who answered; people can choose more than one.
            Keep these inside the organizing team.
          </p>
        </section>
      </div>

      <h2 className="og-st-heading">Mentors &amp; judges <small>submitted applications</small></h2>
      <div className="og-st-columns">
        <section className="sp-card og-st-card">
          <div className="og-st-card-head"><h3>Roles</h3><span className="og-st-sub">{num(stats.staff.total)} submitted · {num(stats.staff.drafts)} drafts</span></div>
          <Bars breakdown={stats.staff.byRole} tone="teal" />
        </section>
        <section className="sp-card og-st-card">
          <div className="og-st-card-head"><h3>Decisions</h3><span className="og-st-sub">{num(stats.staff.total)} submitted</span></div>
          <Decisions counts={stats.staff.decisions} of={stats.staff.total} />
          {query.data?.hasRoster && <CheckedIn {...stats.staff.checkin} />}
        </section>
        <BarCard title="Judging tracks" breakdown={stats.staff.tracks} tone="teal" foot="Judges and mentor & judges: the track they'd like to judge." />
        <BarCard title="UCSD affiliation" breakdown={stats.staff.affiliation} tone="teal" />
        <BarCard title="How they heard about DataHacks" breakdown={stats.staff.heardAbout} tone="teal" multi />
      </div>
    </div>
  );
}

function Overview({ stats }: { stats: Stats }) {
  const roles = new Map(stats.staff.byRole.items.map(i => [i.key, i.count]));
  const tiles: { label: string; big: string; sub: string; note?: string; meter?: number }[] = [
    {
      label: "Applications", big: num(stats.hackers), sub: `hackers submitted · ${num(stats.hackerDrafts)} drafts`,
      note: `+${num(stats.recent.today)} today · +${num(stats.recent.week)} in 7 days`,
    },
    { label: "Goal progress", big: `${Math.round(stats.progress * 100)}%`, sub: `of the ${num(stats.goal)} applicant goal`, meter: Math.min(stats.progress * 100, 100) },
    { label: "Schools", big: num(stats.schoolsRepresented), sub: "represented" },
    { label: "First-time hackers", big: num(stats.firstTimers), sub: `${share(stats.firstTimers, stats.hackers) || "0%"} of applicants` },
    {
      label: "Mentors & judges", big: num(stats.staff.total),
      sub: `${num(roles.get("mentor") ?? 0)} mentors · ${num(roles.get("judge") ?? 0)} judges · ${num(roles.get("hybrid") ?? 0)} both`,
    },
  ];
  return (
    <ul className="og-st-tiles" aria-label="Overview">
      {tiles.map(t => (
        <li key={t.label} className="sp-card og-ci-tile">
          <span className="og-ci-tile-label">{t.label}</span>
          <span className="og-ci-big">{t.big}</span>
          {t.meter !== undefined && (
            <span className="og-ci-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(t.meter)} aria-label="Applicant goal reached">
              <span style={{ width: `${t.meter}%` }} />
            </span>
          )}
          <span className="og-ci-sub">{t.sub}</span>
          {t.note && <span className="og-ci-sub og-st-recent">{t.note}</span>}
        </li>
      ))}
    </ul>
  );
}

function Goal({ stats }: { stats: Stats }) {
  const { priority, regular } = stats.batch;
  const scale = Math.max(stats.goal, stats.hackers, 1);
  const left = stats.goal - stats.hackers;
  return (
    <section className="sp-card og-st-card og-st-goal">
      <div className="og-st-card-head">
        <h3>Goal: {num(stats.goal)} applicants</h3>
        <span className="og-st-goal-count"><strong>{num(stats.hackers)}</strong> / {num(stats.goal)} · {Math.round(stats.progress * 100)}%</span>
      </div>
      <div
        className="og-st-progress"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={stats.goal}
        aria-valuenow={stats.hackers}
        aria-label={`${num(stats.hackers)} of ${num(stats.goal)} applicants`}
      >
        <span className="priority" style={{ width: `${(priority / scale) * 100}%` }} />
        <span className="regular" style={{ width: `${(regular / scale) * 100}%` }} />
      </div>
      <ul className="og-st-legend">
        <li><span className="og-st-swatch priority" aria-hidden />Priority batch <strong>{num(priority)}</strong> <small>submitted by {PRIORITY_DEADLINE} PT</small></li>
        <li><span className="og-st-swatch regular" aria-hidden />Regular <strong>{num(regular)}</strong></li>
        <li>Drafts in progress <strong>{num(stats.hackerDrafts)}</strong></li>
        <li>{left > 0 ? <><strong>{num(left)}</strong> to go</> : <strong>Goal reached</strong>}</li>
      </ul>
    </section>
  );
}

function Bars({ breakdown, tone = "lava" }: { breakdown: Breakdown; tone?: "lava" | "teal" }) {
  if (breakdown.items.length === 0) return <p className="og-st-none">No answers yet.</p>;
  const max = Math.max(...breakdown.items.map(i => i.count), 1);
  return (
    <ol className={`og-st-bars ${tone}`}>
      {breakdown.items.map(i => (
        <li key={i.key} className={i.rest ? "other" : undefined}>
          <span className="og-st-label">{i.label}{i.rest ? <small> · {num(i.rest)} more</small> : null}</span>
          <span className="og-st-num">{num(i.count)}<small>{share(i.count, breakdown.answered)}</small></span>
          <span className="og-st-bar" aria-hidden><span style={{ width: `${(i.count / max) * 100}%` }} /></span>
        </li>
      ))}
    </ol>
  );
}

function Missing({ breakdown, what }: { breakdown: Breakdown; what: string }) {
  if (breakdown.missing === 0) return null;
  return <p className="og-st-foot">{num(breakdown.missing)} didn't answer {what}.</p>;
}

function BarCard({ title, breakdown, sub, foot, multi, tone }: {
  title: string; breakdown: Breakdown; sub?: string; foot?: string; multi?: boolean; tone?: "lava" | "teal";
}) {
  const top = breakdown.items.some(i => i.rest) ? breakdown.items.length - 1 : 0;
  return (
    <section className="sp-card og-st-card">
      <div className="og-st-card-head">
        <h3>{title}</h3>
        {multi ? <span className="og-st-tag">multi-select</span> : sub && <span className="og-st-sub">{sub}{top > 0 && ` · top ${top}`}</span>}
      </div>
      <Bars breakdown={breakdown} tone={tone} />
      {(multi || foot || breakdown.missing > 0) && (
        <p className="og-st-foot">
          {multi && `Shares are of the ${num(breakdown.answered)} who answered; people can choose more than one. `}
          {foot && `${foot} `}
          {breakdown.missing > 0 && `${num(breakdown.missing)} didn't answer.`}
        </p>
      )}
    </section>
  );
}

function Travel({ stats }: { stats: Stats }) {
  const { travel, travelDistance, travelRegion } = stats.hacker;
  const yes = travel.items.find(i => i.key === "yes")?.count ?? 0;
  return (
    <section className="sp-card og-st-card">
      <div className="og-st-card-head"><h3>Travel reimbursement</h3></div>
      <p className="og-st-big-line"><strong>{num(yes)}</strong> asked for it <small>{share(yes, travel.answered)} of applicants</small></p>
      {yes > 0 && (
        <>
          <h4>How far</h4>
          <Bars breakdown={travelDistance} />
          <h4>Traveling from{travelRegion.items.some(i => i.rest) && " (top 10)"}</h4>
          <Bars breakdown={travelRegion} />
          <p className="og-st-foot">Shares are of the {num(yes)} who asked. Places are as typed, grouped ignoring capitals and punctuation.</p>
        </>
      )}
    </section>
  );
}

function Decisions({ counts, of }: { counts: DecisionCount[]; of: number }) {
  const max = Math.max(...counts.map(c => c.count), 1);
  return (
    <ol className="og-st-bars og-st-decisions">
      {counts.map(c => (
        <li key={c.key} className={c.key}>
          <span className="og-st-label">
            {c.label}
            {c.key !== "undecided" && c.count > 0 && (
              <small> · {num(c.released)} released{c.staged > 0 && `, ${num(c.staged)} staged`}</small>
            )}
          </span>
          <span className="og-st-num">{num(c.count)}<small>{share(c.count, of)}</small></span>
          <span className="og-st-bar" aria-hidden><span style={{ width: `${(c.count / max) * 100}%` }} /></span>
        </li>
      ))}
    </ol>
  );
}

function CheckedIn({ accepted, checkedIn }: { accepted: number; checkedIn: number }) {
  return (
    <p className="og-st-foot og-st-checkin">
      Checked in: <strong>{num(checkedIn)}</strong> of {num(accepted)} accepted (released){checkedIn === 0 && " · check-in opens on the day"}.
    </p>
  );
}
