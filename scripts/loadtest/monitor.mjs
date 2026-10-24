// Watches the staging database while a test runs, from Supabase's Prometheus
// endpoint (/customer/v1/privileged/metrics, basic auth with the service key).
//
//   node scripts/loadtest/monitor.mjs [seconds between samples, default 10]
//
// Prints one line per sample and appends it to .data/results/monitor.csv:
// DB CPU %, load, free memory, Postgres connections and the PostgREST pool.
import { appendFileSync, mkdirSync } from "node:fs";
import { SERVICE, URL_ } from "./lib.mjs";

const every = Number(process.argv[2] ?? 10) * 1000;
const out = new URL(".data/results/monitor.csv", import.meta.url);
mkdirSync(new URL(".", out), { recursive: true });

async function scrape() {
  const res = await fetch(`${URL_}/customer/v1/privileged/metrics`, {
    headers: { Authorization: `Basic ${Buffer.from(`service_role:${SERVICE}`).toString("base64")}` },
  });
  const lines = (await res.text()).split("\n").filter(l => l && !l.startsWith("#"));
  const sum = (name, where = () => true) =>
    lines.filter(l => l.startsWith(`${name}{`) || l.startsWith(`${name} `)).filter(where).reduce((a, l) => a + Number(l.split(" ").pop()), 0);
  return {
    cpuIdle: sum("node_cpu_seconds_total", l => l.includes('mode="idle"')),
    cpuAll: sum("node_cpu_seconds_total"),
    load1: sum("node_load1"),
    memMB: sum("node_memory_MemAvailable_bytes") / 1e6,
    backends: sum("pg_stat_database_num_backends"),
    pgrstAvail: sum("pgrst_db_pool_available"),
    pgrstMax: sum("pgrst_db_pool_max"),
    pgrstWaiting: sum("pgrst_db_pool_waiting"),
    pgrstTimeouts: sum("pgrst_db_pool_timeouts_total"),
  };
}

let prev = await scrape();
console.log("time      cpu%  load1  freeMB  pg_conns  postgrest_pool(avail/max) waiting timeouts");
for (;;) {
  await new Promise(r => setTimeout(r, every));
  let cur;
  try { cur = await scrape(); } catch (e) { console.log(`scrape failed: ${e.message}`); continue; }
  // The exporter refreshes CPU counters every few seconds; no change means no new sample yet.
  const span = cur.cpuAll - prev.cpuAll;
  const busy = span > 0 ? ((1 - (cur.cpuIdle - prev.cpuIdle) / span) * 100).toFixed(0) : "-";
  const row = [new Date().toTimeString().slice(0, 8), busy, cur.load1.toFixed(2), cur.memMB.toFixed(0), cur.backends, `${cur.pgrstAvail}/${cur.pgrstMax}`, cur.pgrstWaiting, cur.pgrstTimeouts];
  console.log(`${row[0]}  ${row[1].padStart(4)}  ${row[2].padStart(5)}  ${row[3].padStart(6)}  ${String(row[4]).padStart(8)}  ${row[5].padStart(24)}  ${String(row[6]).padStart(7)}  ${row[7]}`);
  appendFileSync(out, row.join(",") + "\n");
  if (span > 0) prev = cur;
}
