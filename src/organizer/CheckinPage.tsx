import { useEffect, useMemo, useRef, useState } from "react";
import { Download, RefreshCw, Search } from "lucide-react";
import ArrivalsChart from "./ArrivalsChart";
import {
  activityFeed, activityFromLog, arrivalBuckets, arrivalsFromLog, buildPeople, checkinsByOrganizer, findUndos, groupBySchool,
  isCheckedIn, isUcsd, noShows, roleTallies, scanCounts, travelRequests, ucsdSplit, waiverStats,
  type Activity, type CheckinRole, type LogEvent, type Person, type RosterEntry, type Tally, type Undo,
} from "./checkin";
import { organizerName, useCheckinApplications, useCheckinLog, useCheckinRoster, useOrganizers, type Organizer } from "./checkinData";
import { SCAN_KIND_LABEL, useScanTypes, type ScanType } from "./scanTypes";
import { csvFilename, downloadCsv } from "./csv";
import { isPreview } from "./preview";
import { TYPE_LABEL } from "./types";
import "./checkin.css";

/**
 * The console's Check-in section, for organizers watching the day: who's
 * here per role, arrivals over time, who hasn't come (by school, UCSD or
 * not), travel reimbursement requests, waivers, and who checked whom in.
 *
 * It only reads. Check-ins happen in the check-in app (check_in_by_code),
 * which writes public.attendees and the check-in log (public.checkin_events);
 * this section follows both over Realtime, or reloads them every 30 seconds
 * when Realtime isn't connected. The feed, arrivals and meal/swag counts read
 * the log; on a database without it they fall back to the roster.
 */

type RoleFilter = "all" | CheckinRole;

const ROLE_TABS: { id: RoleFilter; label: string }[] = [
  { id: "all", label: "Everyone" },
  { id: "hacker", label: "Hackers" },
  { id: "mentor", label: "Mentors" },
  { id: "judge", label: "Judges" },
];

const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const stamp = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

const matches = (p: Person, q: string) => !q || [p.name, p.email, p.affiliation, p.code].some(v => v?.toLowerCase().includes(q));
const hasRole = (p: Person, role: RoleFilter) => role === "all" || p.roles.includes(role);

export default function CheckinPage({ eventId }: { eventId: string }) {
  const roster = useCheckinRoster(eventId);
  const apps = useCheckinApplications(eventId);
  const log = useCheckinLog(eventId);
  const scanTypes = useScanTypes(eventId);
  const entries = roster.data?.entries;
  // null: no log on this database (or not loaded yet) -> the roster-based fallbacks.
  const logEvents = Array.isArray(log.data) ? log.data : null;

  const people = useMemo(() => buildPeople(entries ?? [], apps.data ?? []), [entries, apps.data]);
  const byId = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);

  // Undos aren't stored anywhere, so they're noticed by comparing each load with the last one.
  const previous = useRef<RosterEntry[] | null>(null);
  const [undos, setUndos] = useState<Undo[]>([]);
  useEffect(() => {
    if (!entries) return;
    if (previous.current) {
      const found = findUndos(previous.current, entries, new Date().toISOString(), byId);
      if (found.length) setUndos(prev => [...prev, ...found.filter(u => !prev.some(p => p.key === u.key))]);
    }
    previous.current = entries;
  }, [entries, byId]);

  const checkerIds = useMemo(() => [...new Set(people.map(p => p.checkedInBy).filter((id): id is string => !!id))], [people]);
  const organizers = useOrganizers(checkerIds);
  const organizerById = useMemo(() => new Map((organizers.data ?? []).map(o => [o.id, o])), [organizers.data]);

  if (roster.isPending) return <p className="og-empty">Loading the check-in roster…</p>;
  if (roster.isError) return <p className="sp-error">Couldn't load the check-in roster: {(roster.error as Error).message}</p>;

  const updated = roster.dataUpdatedAt ? new Date(roster.dataUpdatedAt).toLocaleTimeString() : "";

  return (
    <div className="og-checkin">
      <div className="og-ci-status" aria-live="polite">
        <span className={`og-ci-live ${roster.live}`}>
          <span className="og-ci-live-dot" aria-hidden />
          {roster.live === "live" ? "Live" : roster.live === "connecting" ? "Connecting…" : isPreview() ? "Preview (sample data)" : "Updating every 30 s"}
        </span>
        <span>Updated {updated}</span>
        <button className="sp-button" onClick={() => { roster.refetch(); apps.refetch(); log.refetch(); scanTypes.refetch(); }} disabled={roster.isFetching}>
          <RefreshCw size={14} aria-hidden /> Refresh
        </button>
      </div>
      {apps.isError && <p className="sp-error">Couldn't load schools and travel answers: {(apps.error as Error).message}</p>}
      {log.isError && <p className="sp-error">Couldn't load the check-in log: {(log.error as Error).message}</p>}

      <Headline people={people} />

      <div className="og-ci-grid">
        <section className="sp-card og-ci-card">
          <h2>Arrivals</h2>
          <Arrivals people={people} log={logEvents} />
        </section>
        <Feed people={people} byId={byId} log={logEvents} undos={undos} organizers={organizerById} loadingNames={organizers.isPending && checkerIds.length > 0} />
      </div>

      {Array.isArray(scanTypes.data) && logEvents && <Scans types={scanTypes.data} log={logEvents} people={people} />}

      <div className="og-ci-grid">
        <UcsdSplit people={people} />
        <Waivers people={people} hasWaiver={!!roster.data?.hasWaiver} />
      </div>

      <NoShows people={people} />
      <Travel people={people} />
    </div>
  );
}

function Headline({ people }: { people: Person[] }) {
  const t = roleTallies(people);
  const both = people.filter(p => p.roles.includes("mentor") && p.roles.includes("judge")).length;
  const tiles: { label: string; tally: Tally; note?: string }[] = [
    { label: "Everyone", tally: t.all },
    { label: "Hackers", tally: t.hacker },
    { label: "Mentors", tally: t.mentor, note: both ? `Includes ${both} mentor & judge` : undefined },
    { label: "Judges", tally: t.judge, note: both ? `Includes ${both} mentor & judge` : undefined },
  ];
  return (
    <ul className="og-ci-tiles" aria-label="Checked in by role">
      {tiles.map(({ label, tally, note }) => (
        <li key={label} className="sp-card og-ci-tile">
          <span className="og-ci-tile-label">{label}</span>
          <span className="og-ci-big">
            {tally.checkedIn}<span className="og-ci-of"> / {tally.accepted}</span>
          </span>
          <span className="og-ci-sub">checked in of accepted</span>
          <span className="og-ci-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={tally.percent} aria-label={`${label} arrived`}>
            <span style={{ width: `${tally.percent}%` }} />
          </span>
          <span className="og-ci-sub"><strong>{tally.percent}%</strong> arrived · <strong>{tally.expected}</strong> still expected</span>
          {note && <span className="og-ci-note">{note}</span>}
        </li>
      ))}
    </ul>
  );
}

function Arrivals({ people, log }: { people: Person[]; log: LogEvent[] | null }) {
  const [role, setRole] = useState<RoleFilter>("all");
  // Re-render each minute so the axis reaches "now" while the doors are open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const fromLog = useMemo(() => (log ? arrivalsFromLog(log) : null), [log]);
  const times = people.filter(p => hasRole(p, role)).map(p => (fromLog ? fromLog.get(p.id) ?? null : p.checkedInAt));
  const latest = Math.max(...times.map(t => (t ? Date.parse(t) : 0)));
  // Only stretch to now if the last check-in was within the last 3 hours (not for a finished event).
  const { buckets, minutes } = arrivalBuckets(times, { until: now - latest < 3 * 3_600_000 ? now : undefined });
  return (
    <>
      <RoleTabs value={role} onChange={setRole} label="Arrivals for" />
      <ArrivalsChart buckets={buckets} minutes={minutes} />
    </>
  );
}

function RoleTabs({ value, onChange, label, counts }: { value: RoleFilter; onChange: (r: RoleFilter) => void; label: string; counts?: Record<RoleFilter, number> }) {
  return (
    <div className="sp-tabs og-ci-tabs" role="group" aria-label={label}>
      {ROLE_TABS.map(t => (
        <button key={t.id} aria-pressed={t.id === value} className={t.id === value ? "active" : ""} onClick={() => onChange(t.id)}>
          {t.label}{counts && <span className="og-count">{counts[t.id]}</span>}
        </button>
      ))}
    </div>
  );
}

const FEED_STEP = 20;

function Feed({ people, byId, log, undos, organizers, loadingNames }: {
  people: Person[]; byId: Map<string, Person>; log: LogEvent[] | null; undos: Undo[]; organizers: Map<string, Organizer>; loadingNames: boolean;
}) {
  const [shown, setShown] = useState(FEED_STEP);
  const feed = useMemo(() => (log ? activityFromLog(log, byId) : activityFeed(people, undos)), [log, byId, people, undos]);
  const byOrganizer = useMemo(() => checkinsByOrganizer(people), [people]);
  const who = (id: string | null) =>
    !id ? "unknown" : organizerName(organizers.get(id)) ?? (loadingNames ? "…" : `organizer ${id.slice(0, 8)}`);

  return (
    <section className="sp-card og-ci-card">
      <h2>Recent check-ins</h2>
      {byOrganizer.length > 0 && (
        <p className="og-ci-by">
          By organizer:{" "}
          {byOrganizer.map((o, i) => (
            <span key={o.by ?? "none"}>{i > 0 && " · "}{who(o.by)} <strong>{o.count}</strong></span>
          ))}
        </p>
      )}
      {feed.length === 0 ? <p className="og-empty">Nobody has checked in yet.</p> : (
        <>
          <ol className="og-ci-feed">
            {feed.slice(0, shown).map((a: Activity) => (
              <li key={a.key} className={a.kind}>
                <time dateTime={a.at}>{clock(a.at)}</time>
                <span className="og-ci-feed-who">
                  <strong>{a.person.name}</strong>
                  <span className="og-ci-feed-role">
                    {a.kind === "undo" && <span className="og-badge rejected og-ci-undone">Undone</span>}
                    {a.person.type ? TYPE_LABEL[a.person.type] : `${a.person.code} · not on the roster now`}
                  </span>
                </span>
                <span className="og-ci-feed-by">
                  {a.kind === "undo" && !a.by ? null : <>by {who(a.by)}</>}
                  {a.source === "offline" && <span className="og-ci-feed-offline" title="Scanned while the phone was offline; this is the scan time">offline</span>}
                </span>
              </li>
            ))}
          </ol>
          {feed.length > shown && (
            <button className="sp-button og-ci-more" onClick={() => setShown(s => s + 50)}>Show more ({feed.length - shown} older)</button>
          )}
          {log
            ? <p className="og-hint">Times are when the desk scanned; a phone that was offline sends its check-ins when it reconnects.</p>
            : <p className="og-hint">Undos only show if they happened while this page was open; the database doesn't keep them.</p>}
        </>
      )}
    </section>
  );
}

function Scans({ types, log, people }: { types: ScanType[]; log: LogEvent[]; people: Person[] }) {
  const here = useMemo(() => people.filter(isCheckedIn).length, [people]);
  const counts = useMemo(() => scanCounts(log, types.map(t => t.id), here), [log, types, here]);
  return (
    <section className="sp-card og-ci-card" aria-labelledby="og-ci-scans">
      <h2 id="og-ci-scans">Meals &amp; swag</h2>
      {types.length === 0 ? (
        <p className="og-empty">No meal or swag scans set up. Add them under Day of; the check-in desk can then switch to them.</p>
      ) : (
        <>
          <div className="sp-table-wrap og-ci-scans-wrap">
            <table className="sp-table og-ci-plain og-ci-scans">
              <thead><tr><th>Scan</th><th>Scanned</th><th><abbr title="Of the people checked in now">% here</abbr></th><th>Before check-in</th></tr></thead>
              <tbody>
                {types.map((t, i) => {
                  const c = counts[i];
                  return (
                    <tr key={t.id} className={t.active ? "" : "og-ci-off"}>
                      <td>
                        {t.label}
                        <span className="og-ci-feed-role">{SCAN_KIND_LABEL[t.kind]}{!t.active && " · switched off"}</span>
                      </td>
                      <td>{c.scanned}</td>
                      <td>{c.percentOfHere === null ? "–" : `${c.percentOfHere}%`}</td>
                      <td>{c.notCheckedIn}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="og-hint">One scan per person per type. “Before check-in” were scanned before they'd checked in (recorded anyway). Add, rename or switch them off under Day of.</p>
        </>
      )}
    </section>
  );
}

function UcsdSplit({ people }: { people: Person[] }) {
  const hackers = people.filter(p => p.roles.includes("hacker"));
  const split = ucsdSplit(hackers);
  const rows: [string, Tally][] = [["UCSD", split.ucsd], ["Not UCSD", split.other]];
  if (split.unknown.accepted) rows.push(["No school given", split.unknown]);
  return (
    <section className="sp-card og-ci-card">
      <h2>Hackers: UCSD vs not</h2>
      <div className="sp-table-wrap">
        <table className="sp-table og-ci-plain">
          <thead><tr><th>School</th><th>Accepted</th><th>Here</th><th>No-show</th><th><abbr title="Arrived">%</abbr></th></tr></thead>
          <tbody>
            {rows.map(([label, t]) => (
              <tr key={label}><td>{label}</td><td>{t.accepted}</td><td>{t.checkedIn}</td><td>{t.expected}</td><td>{t.percent}%</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="og-hint">UCSD is "University of California, San Diego", "UC San Diego" or "UCSD" as typed on the application.</p>
    </section>
  );
}

function Waivers({ people, hasWaiver }: { people: Person[]; hasWaiver: boolean }) {
  const [open, setOpen] = useState(false);
  const stats = hasWaiver ? waiverStats(people) : null;
  if (!stats) return null;
  const exportCsv = () => downloadCsv(csvFilename("checkin", "no-waiver"), [
    ["Name", "Email", "Role", "School / organization", "Check-in code", "Checked in"],
    ...stats.missing.map(p => [p.name, p.email ?? "", TYPE_LABEL[p.type], p.affiliation, p.code, stamp(p.checkedInAt)]),
  ]);
  return (
    <section className="sp-card og-ci-card">
      <h2>Waivers</h2>
      <p className="og-ci-stat">
        <strong>{stats.percent}%</strong> of people checked in have a signed waiver ({stats.signed} of {stats.checkedIn}).
      </p>
      <span className="og-ci-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={stats.percent} aria-label="Checked in with a waiver">
        <span style={{ width: `${stats.percent}%` }} />
      </span>
      {stats.missing.length > 0 ? (
        <>
          <div className="og-ci-row-actions">
            <button className="sp-button" onClick={() => setOpen(o => !o)} aria-expanded={open}>
              {open ? "Hide" : "Show"} {stats.missing.length} without one
            </button>
            <button className="sp-button" onClick={exportCsv}><Download size={15} aria-hidden /> CSV</button>
          </div>
          {open && <PeopleTable people={stats.missing} extra={{ header: "Checked in", value: p => clock(p.checkedInAt!) }} />}
        </>
      ) : stats.checkedIn > 0 && <p className="og-success">Everyone checked in has one.</p>}
    </section>
  );
}

function NoShows({ people }: { people: Person[] }) {
  const [role, setRole] = useState<RoleFilter>("hacker");
  const [query, setQuery] = useState("");
  const [grouped, setGrouped] = useState(true);
  const missing = useMemo(() => noShows(people), [people]);
  const counts = useMemo(() => Object.fromEntries(ROLE_TABS.map(t => [t.id, missing.filter(p => hasRole(p, t.id)).length])) as Record<RoleFilter, number>, [missing]);
  const q = query.trim().toLowerCase();
  const visible = missing.filter(p => hasRole(p, role) && matches(p, q));
  const groups = grouped ? groupBySchool(visible) : null;

  const exportCsv = () => downloadCsv(csvFilename("checkin", `no-shows-${role === "all" ? "everyone" : `${role}s`}`), [
    ["Name", "Email", "Role", "School / organization", "UCSD", "Check-in code"],
    ...visible.map(p => [p.name, p.email ?? "", TYPE_LABEL[p.type], p.affiliation, p.type === "hacker" ? (isUcsd(p.school) === null ? "" : isUcsd(p.school) ? "Yes" : "No") : "", p.code]),
  ]);

  return (
    <section className="sp-card og-ci-card">
      <div className="sp-card-header">
        <h2>Not checked in <span className="og-count">{missing.length}</span></h2>
        <div className="og-toolbar og-ci-toolbar">
          <label className="og-search">
            <Search size={15} aria-hidden />
            <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email, school…" aria-label="Search people not checked in" />
          </label>
          <button className="sp-button" onClick={exportCsv} disabled={visible.length === 0}><Download size={15} aria-hidden /> CSV</button>
        </div>
      </div>
      <div className="og-ci-row-actions">
        <RoleTabs value={role} onChange={setRole} label="Show" counts={counts} />
        <label className="og-ci-check"><input type="checkbox" checked={grouped} onChange={e => setGrouped(e.target.checked)} /> Group by school</label>
      </div>
      {visible.length === 0
        ? <p className="og-empty">{q ? "Nobody matches that search." : "Everyone's here."}</p>
        : groups
          ? groups.map(g => (
            <details key={g.school} className="og-pass-role og-ci-group" open={groups.length <= 12 || !!q}>
              <summary><span className="og-pass-role-name">{g.school}</span> <span className="og-pass-count">{g.people.length}</span></summary>
              <PeopleTable people={g.people} hideAffiliation />
            </details>
          ))
          : <PeopleTable people={visible} />}
    </section>
  );
}

function Travel({ people }: { people: Person[] }) {
  const [view, setView] = useState<"all" | "in" | "out">("all");
  const travel = travelRequests(people);
  if (travel.accepted === 0) return null;
  const visible = travel.people.filter(p => view === "all" || (view === "in") === isCheckedIn(p));
  const exportCsv = () => downloadCsv(csvFilename("checkin", "travel"), [
    ["Name", "Email", "Role", "School / organization", "Traveling from", "Method", "Distance", "Checked in", "Checked in at"],
    ...travel.people.map(p => [p.name, p.email ?? "", TYPE_LABEL[p.type], p.affiliation, p.travel?.travel_region ?? "", p.travel?.travel_method ?? "", p.travel?.travel_distance ?? "", isCheckedIn(p) ? "Yes" : "No", stamp(p.checkedInAt)]),
  ]);
  return (
    <section className="sp-card og-ci-card">
      <div className="sp-card-header">
        <h2>Travel reimbursement</h2>
        <button className="sp-button" onClick={exportCsv}><Download size={15} aria-hidden /> CSV</button>
      </div>
      <p className="og-ci-stat">
        <strong>{travel.accepted}</strong> accepted {travel.accepted === 1 ? "person" : "people"} asked for travel reimbursement: <strong>{travel.checkedIn}</strong> checked in, <strong>{travel.expected}</strong> not yet.
      </p>
      <div className="sp-tabs og-ci-tabs" role="group" aria-label="Show">
        {([["all", "All", travel.accepted], ["in", "Checked in", travel.checkedIn], ["out", "Not yet", travel.expected]] as const).map(([id, label, n]) => (
          <button key={id} aria-pressed={view === id} className={view === id ? "active" : ""} onClick={() => setView(id)}>{label}<span className="og-count">{n}</span></button>
        ))}
      </div>
      {visible.length === 0 ? <p className="og-empty">Nobody here.</p> : (
        <PeopleTable
          people={visible}
          extra={{ header: "Traveling from", value: p => [p.travel?.travel_region, p.travel?.travel_method, p.travel?.travel_distance].filter(Boolean).join(" · ") }}
          status
        />
      )}
    </section>
  );
}

function PeopleTable({ people, hideAffiliation, extra, status }: {
  people: Person[];
  hideAffiliation?: boolean;
  extra?: { header: string; value: (p: Person) => string };
  status?: boolean;
}) {
  return (
    <div className="sp-table-wrap">
      <table className="sp-table og-ci-people">
        <thead>
          <tr>
            <th>Name</th>
            {!hideAffiliation && <th>School / org</th>}
            <th>Email</th>
            <th>Code</th>
            {extra && <th>{extra.header}</th>}
            {status && <th>Checked in</th>}
          </tr>
        </thead>
        <tbody>
          {people.map(p => (
            <tr key={p.id}>
              <td data-label="Name"><strong>{p.name}</strong><span className="og-ci-feed-role">{TYPE_LABEL[p.type]}</span></td>
              {!hideAffiliation && <td data-label="School / org">{p.affiliation}</td>}
              <td data-label="Email" className="og-ci-email">{p.email}</td>
              <td data-label="Code" className="og-ci-code">{p.code}</td>
              {extra && <td data-label={extra.header}>{extra.value(p)}</td>}
              {status && <td data-label="Checked in">{p.checkedInAt ? clock(p.checkedInAt) : <span className="og-ci-not">Not yet</span>}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
