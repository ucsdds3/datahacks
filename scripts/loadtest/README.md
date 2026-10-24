# Portal load test (k6 + Supabase staging)

Load-tests the application portal's backend (Supabase: Auth + PostgREST +
Postgres) by sending exactly the requests the React app sends. Results and
what they mean: [docs/load-test.md](../../docs/load-test.md).

**Only ever run this against staging** (`gpoqlosneoicpzrluilj`). The scripts
refuse the production project and any project other than staging
(`LOADTEST_ALLOW_REF` overrides the allowed one). Never load-test the website
itself: it's static files on GitHub Pages, and hammering it breaks GitHub's terms.

## Files

| File | What it does |
|---|---|
| `portal.js` | The k6 test. `SCENARIO=applicant`, `spike`, `organizer` or `signin`. |
| `run.sh` | Runs a ladder of stages (e.g. 50 → 100 → 200 → 400 applicants), stops at >5% errors. |
| `seed.mjs` | Creates and deletes the test data: events, accounts, sessions, applications. |
| `monitor.mjs` | Prints the staging database's CPU, memory, connections and PostgREST pool while a test runs. |
| `report.mjs` | Turns the k6 summaries in `.data/results/` into a Markdown table. |
| `lib.mjs` | Shared helpers and the staging-only guard. |

`.data/` (sessions, password, results) is git-ignored.

## What each request is

| k6 step | Request | Where the app sends it |
|---|---|---|
| `sign_in` | `POST /auth/v1/token` | Sign-in (Google OAuth in the app; the test uses password, same endpoint and limit) |
| `profile_upsert` | `POST /rest/v1/profiles` (upsert) | `src/pages/AuthCallback.tsx` |
| `event_lookup` | `GET /rest/v1/events?code=eq.…` | `src/portal/event.ts` (once per page load) |
| `application_exists` | `GET /rest/v1/applications?select=id…` | `src/pages/AuthCallback.tsx` |
| `event_roles` | `GET /rest/v1/event_roles?…` | `src/context/AuthContext.tsx` |
| `application_insert` | `POST /rest/v1/applications` | `src/staff-portal/HackerApplication.tsx` |
| `status_query` | `GET /rest/v1/applications?select=first_name,…` | `src/staff-portal/useStaffAccess.ts` |
| `organizer_applications`, `organizer_attendees` | full application list + roster | `src/organizer/data.ts` |

## Running it

Needs [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) (`brew install k6`) and Node 18+.

1. **Credentials.** Create `scripts/loadtest/staging.env.local` (git-ignored by
   `*.local`) with staging's URL and keys from Supabase → staging project →
   Project Settings → API Keys:

   ```
   SUPABASE_URL=https://gpoqlosneoicpzrluilj.supabase.co
   SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```

2. **Seed** (from the repo root):

   ```sh
   node scripts/loadtest/seed.mjs setup --users 500 --events 80  # accounts lt00001@loadtest.example.com…, events LOADTEST00..79 (open for applications)
   node scripts/loadtest/seed.mjs sessions --rate 30              # signs every account in; ~17 min for 500
   node scripts/loadtest/seed.mjs apps --count 1500               # applications for the organizer console
   node scripts/loadtest/seed.mjs own-apps                        # a LOADTEST00 application per account (status spike)
   ```

   `sessions` is paced because Supabase Auth allows only about 30 sign-ins
   a minute from one IP address (see docs/load-test.md). Signing in ahead of
   time keeps that limit out of the database measurements. Access tokens last
   an hour, so run the tests soon after; rerunning `sessions` only renews
   tokens with less than 15 minutes left.

   No email is ever sent: accounts are created already confirmed, on the
   reserved `example.com` domain. Seeded applications use the exact dropdown
   values from `src/staff-portal/formOptions.ts`, so they pass the database's
   application checks.

3. **Run**, with the monitor in a second terminal:

   ```sh
   node scripts/loadtest/monitor.mjs                # Ctrl-C when done
   scripts/loadtest/run.sh applicant                # 50, 100, 200, 400, 800 concurrent applicants
   scripts/loadtest/run.sh spike                    # 500, 2000, 3500, 5000 status-page loads in ~1 minute
   EXPECT_ROWS=1500 scripts/loadtest/run.sh organizer  # 1, 5, 20 organizers refreshing every 5 s
   scripts/loadtest/run.sh signin                   # 2 sign-ins/s from this machine: Auth's per-IP limit
   node scripts/loadtest/report.mjs                 # Markdown table of every stage
   ```

   Override a ladder with `VUS_LADDER="25 50"` or `USERS_LADDER="300"`. One
   stage can also be run directly, e.g.
   `k6 run -e SCENARIO=applicant -e VUS=100 -e HOLD=2m scripts/loadtest/portal.js`.

4. **Clean up** — always, and before anyone runs a migration check on staging:

   ```sh
   node scripts/loadtest/seed.mjs cleanup   # deletes LOADTEST* events, their applications and roles, and every @loadtest.example.com account
   node scripts/loadtest/seed.mjs status    # should print zeros
   ```

## How the applicant test avoids duplicates

Each account can apply once per event (`applications_user_event_key`). With
500 signed-in accounts and 79 extra events (`LOADTEST01..79`), every k6
iteration gets its own (account, event) pair: 39,500 brand-new inserts per
stage (a 400-user stage makes about 6,500). `run.sh` empties those events (`seed.mjs reset`) before each stage. The
event lookup costs the same whichever code is asked for, so this doesn't
change what's measured.

## Other free tools

k6 was picked (see docs/load-test.md for the comparison). The same scenarios
could be written for Artillery (`npx artillery run`, YAML), Locust (Python) or
Vegeta (fixed-rate single endpoints); autocannon is good for a quick
one-endpoint check, e.g.
`npx autocannon -c 50 -d 20 -H "apikey: $ANON" "$URL/rest/v1/events?select=id&code=eq.LOADTEST00"`.
