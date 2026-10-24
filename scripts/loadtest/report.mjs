// Prints a Markdown table from the k6 summaries in .data/results/.
//   node scripts/loadtest/report.mjs
import { readdirSync, readFileSync } from "node:fs";

const dir = new URL(".data/results/", import.meta.url);
const files = readdirSync(dir).filter(f => f.endsWith(".json")).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
const ms = v => (v == null ? "-" : v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`);

console.log("| Stage | Requests | Req/s | Iterations | Iter/min | p50 | p95 | p99 | Errors |");
console.log("|---|---|---|---|---|---|---|---|---|");
for (const f of files) {
  const m = JSON.parse(readFileSync(new URL(f, dir), "utf8")).metrics;
  const d = m.http_req_duration ?? {};
  const failed = m.http_req_failed ?? {};
  const rate = failed.value ?? (failed.passes != null ? failed.passes / (failed.passes + failed.fails || 1) : 0);
  console.log(`| ${f.replace(".json", "")} | ${m.http_reqs?.count ?? 0} | ${(m.http_reqs?.rate ?? 0).toFixed(1)} | ${m.iterations?.count ?? 0} | ${((m.iterations?.rate ?? 0) * 60).toFixed(0)} | ${ms(d.med)} | ${ms(d["p(95)"])} | ${ms(d["p(99)"])} | ${(rate * 100).toFixed(2)}% |`);
}

console.log("\nPer step (p50 / p95):\n");
for (const f of files) {
  const m = JSON.parse(readFileSync(new URL(f, dir), "utf8")).metrics;
  const steps = Object.entries(m)
    .filter(([k]) => k.startsWith("http_req_duration{name:"))
    .map(([k, v]) => `${k.slice(23, -1)} ${ms(v.med)} / ${ms(v["p(95)"])}`);
  console.log(`- ${f.replace(".json", "")}: ${steps.join("; ")}`);
}
