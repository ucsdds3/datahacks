# MCP server: apply through an AI assistant

Hackers, mentors and judges can connect an AI assistant (Claude, ChatGPT, Cursor, VS Code, Claude Code…) to DataHacks and fill out their application by chatting instead of using the form. The assistant asks the form's questions, reads the answers back, and submits once the person says yes.

- **Server:** `supabase/functions/mcp` (a Supabase Edge Function).
- **URL:** `https://yrxjhrrphhbmqejresvy.supabase.co/functions/v1/mcp` (production), `https://gpoqlosneoicpzrluilj.supabase.co/functions/v1/mcp` (staging).
- **Tools:**
  - `get_my_application`: who's signed in and their application's type and status.
  - `submit_hacker_application`: the hacker form.
  - `submit_mentor_judge_application`: the mentor / judge / both form.

## How the auth gate works

Nothing works without signing in. It's the standard MCP authorization flow (OAuth 2.1), with Supabase Auth as the authorization server:

1. The assistant calls the server with no token and gets a `401` whose `WWW-Authenticate` header points at the server's protected-resource metadata, which names Supabase Auth as the authorization server.
2. The assistant registers itself with Supabase Auth (dynamic client registration) and opens the sign-in page in the browser.
3. Supabase Auth sends the person to **`/oauth/consent`** on the site (`src/pages/OAuthConsent.tsx`). If they aren't signed in, they sign in with Google there (which creates their account if they're new) and come back to the same page.
4. They see which assistant is asking and what it can do, then choose **Allow** or **Deny**.
5. Allow sends them back to the assistant with a code, which it exchanges for a Supabase access token for that person.

The function checks every token against the project's signing keys (`@supabase/server`, `withSupabase({ auth: 'user' })`) and runs every query as that person. Row-level security applies exactly as it does in the portal. An assistant can read and submit only that person's own application. It can't see anyone else's, change an application after it's submitted, or set a decision. `get_my_application` shows a submitted application as "under review" until decisions are released, the same as the Status page.

People can see and revoke the assistants they've allowed. Organizers can see registered clients in the dashboard under **Authentication → OAuth Apps**.

## One-time setup (staging first, then production)

`config.toml` is never pushed (see the note at its top), so these are dashboard settings. Until step 1 is done, both projects answer the discovery URL in step 5 with `"OAuth server is disabled"` and no assistant can sign in (the function itself is harmless: without a token it only returns `401`).

1. **OAuth server** (`https://supabase.com/dashboard/project/<ref>/auth/oauth-server`, Authentication → OAuth Server): turn on the Supabase OAuth server, set **Authorization Path** to `/oauth/consent`, and turn on **Allow Dynamic OAuth Apps** (dynamic client registration: MCP clients register themselves). Save.
2. **Site URL** (`https://supabase.com/dashboard/project/<ref>/auth/url-configuration`, Authentication → URL Configuration): Supabase sends people to *Site URL + Authorization Path*, so the Site URL has to be the site that serves `/oauth/consent`: `https://datahacks.ds3ucsd.com` on production (on staging, wherever the staging site runs, e.g. `http://localhost:8080` for `npm run dev`). Production's currently points at the check-in app. **Check with Evan before changing it.** The Site URL is also where an auth email or a sign-in without its own `redirectTo` lands, so the check-in app's sign-in must pass its own `redirectTo`, and its URL must stay in **Redirect URLs**, before the switch.
3. **Redirect URLs** (same page): the site's callback (`https://datahacks.ds3ucsd.com/auth/callback`, with query strings) must stay allowed. Signing in from the consent page adds `&next=/oauth/consent?...` to it.
4. **Deploy the function.** Merging to `main` does it, because `mcp` is in `FUNCTIONS` in `.github/workflows/supabase-deploy.yml`. By hand: `npx supabase@2.121.0 functions deploy mcp --project-ref <ref> --use-api`. It needs `verify_jwt = false` (`config.toml`, which the deploy reads), because the gateway would otherwise refuse the unauthenticated discovery request before the function can answer it.
5. Check that both of these return JSON:
   - `https://<ref>.supabase.co/.well-known/oauth-authorization-server/auth/v1`
   - `https://<ref>.supabase.co/functions/v1/mcp/oauth-protected-resource` (the path the server's `401` names)

Both projects already use ES256 JWT signing keys and new-style API keys, which `@supabase/server` requires.

## Connecting an assistant

Give applicants the production URL above.

- **Claude (web, desktop or mobile):** Settings → Connectors → Add custom connector, then paste the URL.
- **Claude Code:** `claude mcp add --transport http datahacks https://yrxjhrrphhbmqejresvy.supabase.co/functions/v1/mcp`, then `/mcp` to sign in.
- **ChatGPT, Cursor, VS Code:** add a remote MCP server with that URL. Each signs in through the same consent page.
- **Testing:** `npx -y @modelcontextprotocol/inspector`, transport "Streamable HTTP", with the staging URL.

## What it checks before submitting

The same as the forms, so an application from an assistant is indistinguishable from one typed in:

- **Answers** (`supabase/functions/mcp/application.ts`): the forms' required fields, the 18+ birthdate range, https-only links, the forms' length limits (`MAX_LENGTH`), the exact dropdown values (including the country list), and the same cleaning (`cleanLine` for one-line answers, `cleanText` for long ones). Every problem comes back at once, for the assistant to go through with the person. The database's `application_*_check` constraints apply again on insert, and a refusal names the column.
- **Applications open:** `get_my_application` reports the event's `applications_open` switch (and `applications_open_at`, as "aren't open yet. They open on November 3, 2026"). Submitting while it's off returns that message without trying the insert. The database trigger `applications_require_open_event` refuses it anyway, and its message is passed through as is.
- **One event:** every read and the insert are for the event `EVENT_CODE` names (the event's row by code, then `applications` by user and that event id), as in `docs/event-isolation.md`. Change `EVENT_CODE` in `application.ts` together with `src/portal/event.ts`; the test fails until both match.
- **Applicant text is data** (`docs/untrusted-input.md`): the only person-written text a tool returns is the signed-in person's own name and the organizers' event name. The server's instructions tell the model that anything in a tool result is data, never instructions, and to ask the person rather than guess a fix. The model has no more power than the person: it acts as them, under row-level security, and sees nobody else's data.

## Keeping it in step with the forms

The function can't import the portal's files (Supabase bundles only `supabase/functions`), so `application.ts` keeps copies of `src/lib/applicantInput.ts` (`MAX_LENGTH`, `isHttpsLink`, `isValidEmail`, `cleanLine`, `cleanText`, `birthdateBounds`) and of the option lists in `src/staff-portal/formOptions.ts` (the countries are in `countries.ts`). It builds the same row the forms insert. `src/portal/mcpApplication.test.ts` fails, so `npm test` catches it, when:

- an option list, `MAX_LENGTH` or `EVENT_CODE` differs from the portal's;
- a copied rule gives a different answer from the original on any of a set of awkward inputs (`javascript:` and `http:` links, quotes, control characters, header-injection emails, leap days);
- an option the server sends isn't one the database's CHECK constraints accept (it reads them from `supabase/migrations`).

When a form question changes, change `application.ts` and the tool's input schema in `index.ts` as well.

## Testing it locally

Set up a throwaway local stack with Docker and Supabase CLI 2.121+, in its own folder, not this repo's `config.toml`:

- Copy `supabase/migrations` into it and link `supabase/functions`.
- Add a seed that inserts the `DH27BETA` event.
- Configure `[auth] site_url = "http://localhost:8080"` and `signing_keys_path` (make the key file with `supabase gen signing-key --algorithm ES256`).
- Configure `[auth.oauth_server] enabled = true`, `authorization_url_path = "/oauth/consent"` and `allow_dynamic_registration = true`.
- Set `[functions.mcp] verify_jwt = false`.

Then run `supabase start` and `supabase functions serve`. Point `npm run dev` at the local URL and anon key, and connect the inspector to `http://127.0.0.1:54321/functions/v1/mcp`.
