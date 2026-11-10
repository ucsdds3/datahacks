import { useEffect, useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  APPLICANT_GOAL, MIN_GROUP, REFRESH_MS, STATS_EVENT_CODE, StatsPausedError, chartPoints, fetchPublicStats, formatCount,
  formatDay, formatPercent, formatUpdated, goalProgress, sortGraduationYears, type Bucket, type DayPoint, type PublicStats,
} from "./statsData";
import "./stats.css";

export const STATS_TITLE = "DataHacks 2027 · Live stats";
const PAGE_BACKGROUND = "#1a0a0b";
const APPLY = "/apply/";

const plural = (n: number, one: string, many: string) => `${formatCount(n)} ${n === 1 ? one : many}`;

/**
 * The public live stats page (/stats): how many people have applied to
 * DataHacks 2027 and, in counts only, where they're from. The numbers come from
 * the database's public_event_stats() (see statsData.ts), refreshed every
 * minute while the page is on screen. Drawn in the portal's Nether look, with
 * none of the portal's own stylesheets.
 */
export default function Stats() {
  useEffect(() => {
    const before = document.title;
    const html = document.documentElement;
    const background = html.style.backgroundColor;
    document.title = STATS_TITLE;
    // No white past the page's edges when it's overscrolled.
    html.style.backgroundColor = PAGE_BACKGROUND;
    return () => {
      document.title = before;
      html.style.backgroundColor = background;
    };
  }, []);

  const { data, error, isPending, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["public-stats", STATS_EVENT_CODE],
    queryFn: ({ signal }) => fetchPublicStats(signal),
    refetchInterval: REFRESH_MS,
    // Only while the page is on screen; coming back to the tab fetches straight away.
    refetchIntervalInBackground: false,
    staleTime: REFRESH_MS / 2,
    retry: (failures, err) => !(err instanceof StatsPausedError) && failures < 1,
  });

  const paused = error instanceof StatsPausedError;
  const pill = paused ? "Paused" : error && !data ? "Offline" : "Live";

  return (
    <div className="dh-stats">
      <header className="dh-stats-top">
        <a className="dh-stats-brand" href="/">DataHacks <span>2027</span></a>
        <nav className="dh-stats-nav" aria-label="DataHacks">
          <a className="dh-stats-home-link" href="/">Home</a>
          <Link className="dh-stats-button primary" to={APPLY}>Apply now</Link>
        </nav>
      </header>

      <main className="dh-stats-board" aria-busy={isFetching}>
        <div className="dh-stats-head">
          <div>
            <h1>
              DataHacks 2027 live stats{" "}
              <span className={pill === "Live" ? "dh-stats-live" : "dh-stats-live off"}>{pill}</span>
            </h1>
            <p className="dh-stats-intro">Hacker applications to DataHacks 2027 so far, counted as they come in.</p>
          </div>
          <div className="dh-stats-refresh">
            <button type="button" className="dh-stats-button" onClick={() => refetch()} disabled={isFetching}>
              <svg viewBox="0 0 16 16" aria-hidden="true" className={isFetching ? "spin" : undefined}>
                <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
              </svg>
              {isFetching ? "Refreshing…" : "Refresh"}
            </button>
            <p>
              {dataUpdatedAt > 0 && <>Last updated {formatUpdated(dataUpdatedAt)} · </>}
              refreshes every {REFRESH_MS / 1000} seconds
            </p>
          </div>
        </div>

        {isPending ? (
          <Loading />
        ) : !data || paused ? (
          <Problem paused={paused} retrying={isFetching} onRetry={() => refetch()} />
        ) : (
          <>
            {error && (
              <p className="dh-stats-stale" role="status">
                Couldn't refresh just now. These are the numbers from {formatUpdated(dataUpdatedAt)}.
              </p>
            )}
            {data.hackers === 0 ? <Empty /> : <Dashboard stats={data} />}
          </>
        )}
      </main>

      <footer className="dh-stats-foot">
        <p>
          Counts only: no names or other personal details. Any school, major, level of study or graduation year with
          fewer than {MIN_GROUP} applicants is counted in "Other". Submitted applications only, not drafts.
        </p>
        <p>
          <a href="/">DataHacks home</a> · <Link to={APPLY}>Apply</Link> · Questions? <a href="mailto:info@ds3.club">info@ds3.club</a>
        </p>
      </footer>
      <div className="dh-stats-lava" aria-hidden="true" />
    </div>
  );
}

function Dashboard({ stats }: { stats: PublicStats }) {
  const goal = goalProgress(stats.hackers);
  const goalText = `${formatCount(stats.hackers)} of ${formatCount(APPLICANT_GOAL)} applicants (${goal.label})`;
  return (
    <>
      <section className="dh-stats-section" aria-labelledby="dh-stats-overview">
        <h2 id="dh-stats-overview">Overview</h2>
        <div className="dh-stats-cards">
          <Card featured label="Applications" value={formatCount(stats.hackers)} note="hacker applications so far" />
          <Card label="Goal progress" value={goal.label} note={`of the ${formatCount(APPLICANT_GOAL)}-applicant goal`} />
          <Card label="Schools" value={formatCount(stats.schools)} note={stats.schools === 1 ? "school represented" : "schools represented"} />
          <Card
            label="First-time hackers"
            value={formatPercent(stats.firstTime, stats.hackers)}
            note={`${plural(stats.firstTime, "applicant is", "applicants are")} new to hackathons`}
          />
          <Card label="Mentors & judges" value={formatCount(stats.mentorsJudges)} note="applied to mentor or judge" />
        </div>

        <div className="dh-stats-panel dh-stats-goal">
          <div className="dh-stats-goal-row">
            <span className="dh-stats-goal-label">Goal: {formatCount(APPLICANT_GOAL)} applicants</span>
            <span className="dh-stats-goal-value">{goalText}</span>
          </div>
          <div
            className={goal.reached ? "dh-stats-meter reached" : "dh-stats-meter"}
            role="progressbar"
            aria-label="Progress toward the applicant goal"
            aria-valuemin={0}
            aria-valuemax={APPLICANT_GOAL}
            aria-valuenow={Math.min(stats.hackers, APPLICANT_GOAL)}
            aria-valuetext={goalText}
          >
            <span style={{ width: `${goal.fill}%` }} />
          </div>
          <p className="dh-stats-facts">
            From {plural(stats.countries, "country", "countries")} · {formatCount(stats.attendedBefore)} have been to DataHacks before
          </p>
        </div>
      </section>

      <section className="dh-stats-section" aria-labelledby="dh-stats-growth">
        <h2 id="dh-stats-growth">Applications over time</h2>
        <div className="dh-stats-panel">
          <p className="dh-stats-panel-note">Running total of hacker applications, by day (Pacific time).</p>
          <GrowthChart perDay={stats.perDay} />
        </div>
      </section>

      <section className="dh-stats-section" aria-labelledby="dh-stats-who">
        <h2 id="dh-stats-who">Who's applying</h2>
        <div className="dh-stats-lists">
          <BarList title="Top schools" items={stats.topSchools} />
          <BarList title="Level of study" items={stats.levels} />
          <BarList title="Majors" items={stats.majors} />
          <BarList title="Graduation year" items={sortGraduationYears(stats.graduationYears)} />
        </div>
      </section>
    </>
  );
}

function Card({ label, value, note, featured = false }: { label: string; value: string; note: string; featured?: boolean }) {
  return (
    <div className={featured ? "dh-stats-card featured" : "dh-stats-card"}>
      <p className="dh-stats-card-label">{label}</p>
      <p className="dh-stats-card-value">{value}</p>
      <p className="dh-stats-card-note">{note}</p>
    </div>
  );
}

/** A ranked list as horizontal bars, longest first; "Other" in grey. */
function BarList({ title, items }: { title: string; items: Bucket[] }) {
  const id = useId();
  const max = Math.max(1, ...items.map(item => item.count));
  return (
    <section className="dh-stats-panel dh-stats-list" aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      {items.length === 0 ? (
        <p className="dh-stats-panel-note">Not enough applications yet to show this without naming groups smaller than {MIN_GROUP}.</p>
      ) : (
        <ol>
          {items.map(item => (
            <li key={item.label} className={item.label === "Other" ? "other" : undefined}>
              <span className="dh-stats-list-label">{item.label}</span>
              <span className="dh-stats-list-count">{formatCount(item.count)}</span>
              <span className="dh-stats-list-bar" aria-hidden="true">
                <span style={{ width: `${(item.count / max) * 100}%` }} />
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

const CHART_W = 600;
const CHART_H = 200;

/** The running total as a line over a soft fill. Hover, touch or the arrow keys pick a day. */
function GrowthChart({ perDay }: { perDay: DayPoint[] }) {
  const [picked, setPicked] = useState<number | null>(null);
  if (perDay.length === 0) return null;

  const { top, points } = chartPoints(perDay, CHART_W, CHART_H);
  const last = points.length - 1;
  const active = points[picked ?? last];
  const line = points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${points[last].x.toFixed(1)} ${CHART_H} L${points[0].x.toFixed(1)} ${CHART_H} Z`;
  const left = (x: number) => `${(x / CHART_W) * 100}%`;
  const topPct = (y: number) => `${(y / CHART_H) * 100}%`;

  const pick = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const share = Math.min(1, Math.max(0, (event.clientX - box.left) / Math.max(1, box.width)));
    setPicked(Math.round(share * last));
  };
  const step = (event: KeyboardEvent<HTMLDivElement>) => {
    const from = picked ?? last;
    const to = event.key === "ArrowLeft" ? from - 1 : event.key === "ArrowRight" ? from + 1
      : event.key === "Home" ? 0 : event.key === "End" ? last : null;
    if (to === null) return;
    event.preventDefault();
    setPicked(Math.min(last, Math.max(0, to)));
  };

  // Keep the label inside the chart: to one side near its edges, under the point near its top.
  const share = active.x / CHART_W;
  const anchor = share < 0.2 ? "start" : share > 0.8 ? "end" : "middle";
  const below = active.y < CHART_H * 0.3 ? " below" : "";

  return (
    <figure className="dh-stats-chart">
      <div
        className="dh-stats-plot"
        tabIndex={0}
        role="group"
        aria-label={`Running total by day. ${formatDay(active.date)}: ${formatCount(active.total)} applications. Use the arrow keys to pick a day.`}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setPicked(null)}
        onKeyDown={step}
        onBlur={() => setPicked(null)}
      >
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none" aria-hidden="true">
          {[0, 0.5, 1].map(f => (
            <line key={f} className="grid" x1="0" x2={CHART_W} y1={CHART_H * f} y2={CHART_H * f} vectorEffect="non-scaling-stroke" />
          ))}
          <path className="area" d={area} />
          <path className="line" d={line} vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="dh-stats-axis" style={{ top: 0 }}>{formatCount(top)}</span>
        <span className="dh-stats-axis" style={{ top: "50%" }}>{formatCount(top / 2)}</span>
        {picked !== null && <span className="dh-stats-crosshair" style={{ left: left(active.x) }} aria-hidden="true" />}
        <span className="dh-stats-dot" style={{ left: left(active.x), top: topPct(active.y) }} aria-hidden="true" />
        <span className={`dh-stats-tip ${anchor}${below}`} style={{ left: left(active.x), top: topPct(active.y) }} aria-hidden="true">
          <strong>{formatCount(active.total)}</strong> {picked === null ? "so far" : `by ${formatDay(active.date)}`}
          {picked !== null && active.count > 0 && <> · +{formatCount(active.count)} that day</>}
        </span>
      </div>
      <div className="dh-stats-x" aria-hidden="true">
        <span>{formatDay(perDay[0].date)}</span>
        {perDay.length > 2 && <span>{formatDay(perDay[Math.floor(last / 2)].date)}</span>}
        {perDay.length > 1 && <span>{formatDay(perDay[last].date)}</span>}
      </div>
      <table className="dh-stats-sr">
        <caption>Hacker applications by day</caption>
        <thead><tr><th scope="col">Day</th><th scope="col">New</th><th scope="col">Running total</th></tr></thead>
        <tbody>
          {perDay.map(d => (
            <tr key={d.date}><th scope="row">{formatDay(d.date)}</th><td>{d.count}</td><td>{d.total}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function Empty() {
  return (
    <section className="dh-stats-panel dh-stats-message">
      <h2>Applications just opened</h2>
      <p>No hacker applications yet, so be one of the first. This page fills in as applications come in.</p>
      <p className="dh-stats-goal-label">Goal: {formatCount(APPLICANT_GOAL)} applicants</p>
      <div className="dh-stats-actions">
        <Link className="dh-stats-button primary" to={APPLY}>Apply now</Link>
      </div>
    </section>
  );
}

function Problem({ paused, retrying, onRetry }: { paused: boolean; retrying: boolean; onRetry: () => void }) {
  return paused ? (
    <section className="dh-stats-panel dh-stats-message">
      <h2>Live stats are paused</h2>
      <p>The DataHacks team has turned this page's numbers off for now. Check back soon.</p>
      <div className="dh-stats-actions">
        <Link className="dh-stats-button primary" to={APPLY}>Apply now</Link>
        <a className="dh-stats-button" href="/">DataHacks home</a>
      </div>
    </section>
  ) : (
    <section className="dh-stats-panel dh-stats-message">
      <h2>Couldn't load the stats</h2>
      <p>We couldn't reach our database just now. Check your connection and try again.</p>
      <div className="dh-stats-actions">
        <button type="button" className="dh-stats-button primary" onClick={onRetry} disabled={retrying}>
          {retrying ? "Trying again…" : "Try again"}
        </button>
        <a className="dh-stats-button" href="/">DataHacks home</a>
      </div>
    </section>
  );
}

function Loading() {
  return (
    <div className="dh-stats-loading">
      <p className="dh-stats-panel-note">Loading the latest numbers…</p>
      <div className="dh-stats-cards" aria-hidden="true">
        {[0, 1, 2, 3, 4].map(i => <div key={i} className={i === 0 ? "dh-stats-card featured skeleton" : "dh-stats-card skeleton"} />)}
      </div>
    </div>
  );
}
