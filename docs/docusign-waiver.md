# DocuSign waiver

Mentors and judges sign the liability waiver inside the portal
(`/portal/<role>/waiver`). DocuSign's "focused view" runs in an iframe on our
page, and the portal enables Submit only after the `docusign-waiver` edge
function has asked DocuSign whether the signer finished.

## How it fits together

1. `src/staff-portal/Waiver.tsx` calls the function with `action: "start"`.
2. The function (`supabase/functions/docusign-waiver`) checks that the caller
   has an accepted application. It then signs in to DocuSign as the API user
   (JWT grant) and creates an envelope from the template. The caller is the
   embedded signer: `clientUserId` is their Supabase user id, and the name
   comes from the application. Finally it asks for a recipient view, with
   `frameAncestors` set to the page's origin plus DocuSign's apps origin.
3. The page loads DocuSign's `bundle.js` and calls
   `DocuSign.loadDocuSign(clientId)`. It mounts the signing session with
   `displayFormat: "focused"` and, when the session ends, calls the function
   with `action: "status"`.

## Demo setup (done October 2026)

| What | Value |
| --- | --- |
| Account | DS3 at UC San Diego (DataHacks), demo, signed in as mprakash@ucsd.edu |
| App | "DataHacks Portal Waiver", integration key `24c6a289-a194-46f9-a5f3-3a13fd5aa71a` (in `src/staff-portal/config.ts`) |
| App settings | Admin > Integrations > Apps and Keys > Actions > Edit |
| RSA keypair | id `d47f58e9-8d52-48a0-9625-3e65099e5e59`. The private key is not in the repo. Mohak has it as PKCS#8 at `~/.datahacks/docusign-private-pkcs8.pem`. |
| Redirect URIs | `https://datahacks.ds3ucsd.com/`, `http://localhost:8080/` |
| CORS origins | `https://datahacks.ds3ucsd.com`, `http://localhost:8080`, `http://localhost:8081` |
| Template | "DataHacks 2027 Liability Waiver (DRAFT)", id `04c6a9d7-42e8-46e5-91aa-de634df3405f`, one role `Signer` |

The template's tabs are anchored to the PDF's labels and sit on the line
above each label:

- Sign Here on "Participant signature"
- Date Signed on "Date signed"
- Full Name on "Participant full name"
- Email on "Email"

A new waiver PDF needs the same four labels, or new anchors.

### Gotchas we hit

- **"There are no redirect URIs registered"** on the consent page. The URIs
  had been typed into "Link to Privacy Policy" and "Link to Terms of Use".
  Redirect URIs only count when added with **Add URI** under Additional
  settings.
- **One-time consent.** The JWT grant returns `consent_required` until the API
  user has opened this URL once and clicked Allow Access:
  `https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=<integration key>&redirect_uri=http%3A%2F%2Flocalhost%3A8080%2F`
  The browser then lands on localhost, and nothing needs to be running there.
- **`bundle.js` exposes `DocuSign.loadDocuSign(integrationKey)`.** There is no
  `DocuSign.loaded()`.
- The first time each signer opens a waiver, DocuSign asks them to agree to
  electronic records and signatures, then shows the document.
- Each recipient-view URL works once and expires after 5 minutes. The portal
  asks for a fresh one every time someone presses Start signing.

## Testing without the portal

`scripts/dev/docusign.mjs` reads `.env.local` and the key file, and never
prints them.

```sh
node scripts/dev/docusign.mjs check                      # JWT works, lists templates
node scripts/dev/docusign.mjs template waiver.pdf "Name"  # make a template from a PDF
node scripts/dev/docusign.mjs sign-test you@example.com "Your Name"
```

`sign-test` creates an envelope the way the function does and serves the
portal's embed on http://localhost:8080. It exits once DocuSign reports the
envelope `completed`. The run on 2026-10-23 completed envelope
`dc952e0b-f483-8e8c-8177-2957efaf17a0`.

`.env.local` needs these keys:

- `DOCUSIGN_ENV`: `demo`
- `DOCUSIGN_INTEGRATION_KEY`
- `DOCUSIGN_USER_ID`
- `DOCUSIGN_ACCOUNT_ID`
- `DOCUSIGN_BASE_PATH`: `https://demo.docusign.net/restapi`
- `DOCUSIGN_TEMPLATE_ID`
- `DOCUSIGN_TEMPLATE_ROLE`: `Signer`

## Edge function secrets

The function deploys with the others (`supabase-deploy.yml`). It needs these
secrets on each project. Run this from the repo root with `.env.local` and the
key file in place. Use the staging ref (`gpoqlosneoicpzrluilj`) or the
production ref (`yrxjhrrphhbmqejresvy`):

```sh
v() { grep "^$1=" .env.local | cut -d= -f2-; }
supabase secrets set --project-ref <project-ref> \
  DOCUSIGN_ENV="$(v DOCUSIGN_ENV)" \
  DOCUSIGN_INTEGRATION_KEY="$(v DOCUSIGN_INTEGRATION_KEY)" \
  DOCUSIGN_USER_ID="$(v DOCUSIGN_USER_ID)" \
  DOCUSIGN_ACCOUNT_ID="$(v DOCUSIGN_ACCOUNT_ID)" \
  DOCUSIGN_BASE_PATH="$(v DOCUSIGN_BASE_PATH)" \
  DOCUSIGN_TEMPLATE_ID="$(v DOCUSIGN_TEMPLATE_ID)" \
  DOCUSIGN_TEMPLATE_ROLE="$(v DOCUSIGN_TEMPLATE_ROLE)" \
  DOCUSIGN_PRIVATE_KEY="$(awk 'BEGIN{ORS="\\n"} 1' ~/.datahacks/docusign-private-pkcs8.pem)"
```

The key goes in as one line with `\n` escapes. The function turns those back
into newlines.

## Going live (production DocuSign)

Production DocuSign needs a paid plan. Then:

1. Pick the app's Integration Type ("Private custom integration" fits us). The
   choice is permanent, so it's still blank.
2. Make 20 successful demo API calls, then submit the app for go-live review.
3. After approval, re-do the consent step on `account.docusign.com` for the
   production user.
4. Recreate the template in the production account.
5. Set `DOCUSIGN_ENV=production` and the production ids in the secrets.
6. Set `environment: "production"` in `src/staff-portal/config.ts`.
