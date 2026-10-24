# Load test: how much traffic the portal can take

Run on 2026-10-23 against **staging** (`gpoqlosneoicpzrluilj`, us-east-1, Free
plan), which has the same schema as production. Production and the live
website were not load-tested. The scripts and how to rerun them are in
[scripts/loadtest/](../scripts/loadtest/README.md).

## In plain terms

- **Applying:** the portal comfortably handles about **2,000 people submitting
  an application in the same minute**, with every request answered in under
  0.2 s for 95% of requests. The hard ceiling is about **4,000 a minute**
  (roughly 490 database requests a second). Past that it doesn't slow down
  gradually. It falls over: requests take 8 to 30 seconds and throughput halves.
- **Decisions released:** **3,500 people opening their status page within one
  minute** was fine (95% under 0.14 s). 5,000 in one minute overloaded it
  (95% took over 40 s) and it took about a minute to recover.
- **Organizers:** one organizer loads the console in about 0.45 s. Twenty
  organizers each refreshing every 5 seconds pushes p95 to 3 s. Real use is
  lighter than that. **But the console only ever shows the first 1,000
  applications** (see below). That needs fixing before the event passes 1,000
  applicants.
- **Sign-in is the real bottleneck for crowds on one network.** Supabase Auth
  allows about **30 sign-ins in a burst, then about 30 a minute, from one IP
  address**. Each person at home has their own IP, so that's fine. A lecture
  hall or club meeting all signing in at once from campus Wi-Fi may share a
  few public IPs, so some of them will get "rate limited" errors.

For scale: DataHacks gets on the order of 1–2 thousand applications over
several weeks, so even a deadline-night rush of a few hundred an hour is
**more than 50× below** what the database handled.

## What was tested

k6 sent exactly the requests the app sends (each one is mapped to its source
file in the [README](../scripts/loadtest/README.md#what-each-request-is)):

| Scenario | One "user" does | Load shape |
|---|---|---|
| (a) Applicants | `/auth/callback` (profile upsert, event lookup, "already applied?", roles) → 1 s → apply page (applications-open check, insert application) → 1 s → status page query. 7 requests. | 50 → 100 → 200 → 400 → 800 concurrent users, each 20 s ramp + 60 s hold, clicking through again and again |
| (b) Decisions released | `/auth/callback` + status page: profile upsert, event lookup, "already applied?", roles, status query. 5 requests. | 500 / 2,000 / 3,500 / 5,000 / 10,000 people arriving within ~60 s (10 s ramp, 40 s peak, 10 s down) |
| (c) Organizer console | event lookup, then every application (all 40 columns) + the attendee roster | 1 / 5 / 20 organizers refreshing every 5 s, with 1,500 applications in the event |
| Sign-in | `POST /auth/v1/token` from this one machine | 2 a second for 60 s |

Setup: 500 accounts and an organizer, signed in ahead of time (paced under
the Auth limit) so the database tests measure the database, not the sign-in
limit. Each applicant insert used a fresh (account, event) pair, so every
insert was a real new row. Seeded applications used the form's exact dropdown
values, so they pass the database's application checks. Requests came from
one laptop in California (about 110 ms round trip to us-east-1, which is the
floor for every number below). Staging's own metrics (CPU, memory,
connections, PostgREST pool) were read during the runs with
`scripts/loadtest/monitor.mjs`. Everything was deleted afterwards.

## Results

Latency is per request. DB CPU was sampled about once a minute, so it's
approximate. "Iter/min" is completed applicants (a), status-page
visits (b) or console loads (c) per minute.

| Stage | Requests | Req/s | Iter/min | p50 | p95 | p99 | Errors | DB CPU | PostgREST queue |
|---|---|---|---|---|---|---|---|---|---|
| applicant-50 | 7,056 | 75 | 641 | 112 ms | 138 ms | 192 ms | 0% | ~25% | 0 |
| applicant-100 | 13,636 | 146 | 1,256 | 114 ms | 150 ms | 871 ms | 0% | ~40% | 0–2 |
| applicant-200 | 25,501 | 273 | 2,339 | 115 ms | 180 ms | 1.90 s | 0% | ~60% | 0 |
| applicant-400 | 45,486 | **488** | **4,181** | 131 ms | 701 ms | 2.57 s | 0% | ~60% | up to 191 waiting |
| applicant-800 | 22,787 | 228 | 1,745 | 1.05 s | 7.89 s | 30.5 s | 0% | 86% | up to 782 waiting |
| spike-500 | 2,495 | 42 | 499 | 115 ms | 200 ms | 692 ms | 0% | ~30% | 0 |
| spike-2,000 | 9,995 | 167 | 1,999 | 110 ms | 139 ms | 187 ms | 0% | ~45% | 0 |
| spike-3,500 | 17,495 | 291 | 3,498 | 108 ms | 140 ms | 502 ms | 0% | n/a | n/a |
| spike-5,000 | 7,305 | 81 | 517 (2,367 never started) | 3.10 s | 41.0 s | 43.2 s | 0% | n/a | pool timeouts |
| spike-10,000 | 711 | 11 | 0 (7,999 never started) | 22.1 s | 59.9 s | 59.9 s | **15%** (aborted) | n/a | pool timeouts |
| organizer-1 | 33 | 0.5 | 11 | 136 ms | 460 ms | 483 ms | 0% | low | 0 |
| organizer-5 | 162 | 2.5 | 51 | 133 ms | 785 ms | 1.21 s | 0% | low | 0 |
| organizer-20 | 531 | 8.2 | 164 | 141 ms | 3.13 s | 10.9 s | 0% | ~30% | pool full (10/10 busy) |
| sign-in (2/s) | 121 | 2.0 | – | 140 ms | 232 ms | 998 ms | **62 of 121 got 429** | – | – |

The organizer list query alone: p50 433 ms / p95 478 ms for one organizer,
p95 10.5 s with twenty. Each console load downloads about 3 MB.

An earlier applicant run, made before the "applications open" migration
(#18) reached staging, agreed: 400 users → 493 req/s, p95 297 ms. 800 → 455
req/s, p95 2.8 s, with 543 requests queued for the pool. 1,600 → collapsed
to 52 req/s, p50 6.5 s, 2% timeouts. That migration adds one request and one
trigger per application. It made no measurable difference below the ceiling.

## Where it broke, and why

1. **PostgREST's database pool (10 connections) on a Nano machine.** Every
   API call goes through PostgREST, which talks to Postgres over a pool of 10
   connections. At about 490 requests a second all 10 are busy. New requests
   queue: 191 waiting at 400 users, 543–782 at 800. Then they start timing
   out (PostgREST counted 2,368 pool timeouts across the overload runs). Database
   CPU (2 shared cores) peaked at 86% and free memory fell to about 60 MB of
   450 MB. Postgres itself was never short of connections: 15–18 of its 60
   were in use. The queries are cheap single-row lookups on indexed columns.
   The limit is the size of the machine, not slow SQL.
2. **Overload makes it collapse, not just slow down.** Once demand passes the
   ceiling, queued requests make everything slower, so throughput *drops*
   (488 → 228 req/s from 400 to 800 users, and 81 req/s in the 5,000 spike).
   Staging took about a minute to answer quickly again after the 10,000 spike.
3. **Supabase Auth's per-IP limit on `/auth/v1/token`.** Every sign-in ends at
   this endpoint: Google OAuth's code exchange as well as passwords. In a fresh
   burst, about 30 sign-ins went through, then 429 "Too Many Requests". After
   that about 30 a minute were allowed, which matches Supabase's default of
   1,800 an hour per IP. At 2 a second for a minute, 59 succeeded and 62 were
   refused. Seeding 500 sessions at 30 a minute never hit it. This limit is
   per IP address, so it only matters when many people share one (campus Wi-Fi
   NAT, a room at a workshop). It can be raised in the dashboard under
   Authentication → Rate Limits.

### Bug found: the organizer console stops at 1,000 applications

`src/organizer/data.ts` loads every application with one `select` and no
paging. Supabase's API returns at most **1,000 rows** per request by default
(`max_rows`). With 1,500 applications in the event, the organizer got 1,000
(`Content-Range: 0-999/1500`) and no error. The rest silently don't appear,
so they can't be reviewed or decided. Fix: fetch in pages with `.range()`
until a short page comes back (or raise *Max rows* in API settings, which
only moves the cliff). Loading the long essay columns only when an
application is opened would also cut the ~3 MB per refresh.

**Fixed** on branch `console-paging`: the console pages through applications
and the attendee roster 1,000 at a time, loads 14 list columns instead of 39
(essays load one application at a time when it's opened), stages decisions
100 ids per request (a URL past about 16 KB, roughly 430 ids, gets a 400),
and finds everyone a large release covered even though `release_decisions`'
reply is capped at 1,000 rows too.

## Supabase Free vs Pro, for this

| | Free (staging today) | Pro ($25/month) |
|---|---|---|
| Compute | Nano: shared CPU, 0.5 GB RAM, PostgREST pool of 10 | Micro included (1 GB RAM); paid upgrades: Small 2 GB, Medium 4 GB, Large and up with dedicated CPU. Bigger compute gets a bigger pool and more connections |
| Postgres connections | 60 direct, 200 through the pooler | 60 on Micro, rising with compute size |
| Database size | 500 MB | 8 GB included, then pay as you go |
| Egress | 5 GB/month | 250 GB/month |
| Monthly active users | 50,000 | 100,000 |
| Pausing | Paused after a week without activity | Never paused |
| Backups | None you can restore from the dashboard | Daily, kept 7 days (point-in-time restore is an add-on) |
| Auth rate limits | Same defaults, adjustable | Same defaults, adjustable |

Check [supabase.com/pricing](https://supabase.com/pricing) before deciding.
These were the published limits when this was written.

For DataHacks' traffic the Free plan's *capacity* is enough. Pro is worth it
for the other reasons: no pausing, real backups, and headroom to move to a
bigger machine in a minute if a spike ever does matter. If production stays
on Free, keep the pause rule in mind: a project with no activity for a week
goes offline until someone restores it.

## The website itself

Not load-tested: it's static files on GitHub Pages (CDN, `cache-control:
max-age=600`), and load-testing it would break GitHub's terms. A first visit
downloads `index.html` (2.4 KB), one JS bundle (232 KB gzipped, 756 KB raw),
one CSS file (49 KB gzipped), Google Fonts (9 families requested in one
stylesheet) and Google Analytics. The bundle references about 29 more assets
that load as needed. Nothing there limits how many people can apply.

## Recommendations

1. **Fix the 1,000-row cap in the organizer console** before applications pass 1,000.
2. **Don't run "everyone sign in now" on shared Wi-Fi** (or raise the token
   rate limit for that day). Tell people to apply from their own connection
   or phone data.
3. **Stagger decision emails** if more than ~3,000 people would get them in
   the same minute. At DataHacks' size, sending them all at once is fine.
4. **Rerun this test** after big changes to the apply flow, or before an event
   much bigger than DataHacks. It takes about 40 minutes, most of it
   pre-signing-in accounts.

## Tools: which free load tester to use

| Tool | Scripts in | Good at | Less good at |
|---|---|---|---|
| **k6** (Grafana, AGPL) | JavaScript | Multi-step user flows, per-step metrics, ramping/arrival-rate shapes, pass/fail thresholds, abort on error rate. One Go binary (`brew install k6`). Thousands of virtual users from a laptop | It isn't Node: no npm packages inside a test |
| **Artillery** (MPL) | YAML + JS hooks | Quick scenario files, `npx artillery run` with no install, Playwright browser tests | Heavier per user (Node); detailed reports are in the paid cloud |
| **Locust** (MIT) | Python | Flows in plain Python, live web UI, distributed workers | Slower per machine; needs a Python environment |
| **Vegeta** (MIT) | CLI + targets file | Constant-rate hammering of a fixed list of requests, honest latency histograms | No per-user flows or state (can't sign in and then use that token) |
| **autocannon** (MIT) | CLI / Node | Instant `npx autocannon` check of one endpoint | Single endpoint, no scenarios |

**k6 fits best**, and it's what `scripts/loadtest/` uses. The portal's load is
multi-step per user (sign in → callback → apply → status), and k6 models that
directly. It gives per-step p95s and can abort a stage at 5% errors. It installs
from Homebrew in seconds and needs no Docker, cloud account or Python. Keep
autocannon or Vegeta for one-off "how fast is this one endpoint" checks, and
Artillery if someone wants a real browser in the loop.
