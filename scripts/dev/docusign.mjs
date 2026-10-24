// Dev only: set up and test the DocuSign waiver outside the portal.
//
//   node scripts/dev/docusign.mjs check
//       JWT sign-in as the API user; lists the account's templates.
//       "consent_required" means the consent step in docs/docusign-waiver.md is still to do.
//   node scripts/dev/docusign.mjs template path/to/waiver.pdf ["Template name"]
//       Creates the waiver template (one "Signer" role; Sign Here, Date Signed, Full Name
//       and Email tabs anchored to the PDF's labels) and prints its id.
//   node scripts/dev/docusign.mjs sign-test you@example.com "Your Name"
//       Does what the docusign-waiver function does (envelope from the template, embedded
//       signer, focused-view URL), serves the same embed the portal uses on
//       http://localhost:8080, and waits until DocuSign says the envelope is completed.
//
// Reads DOCUSIGN_ENV, DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, DOCUSIGN_ACCOUNT_ID,
// DOCUSIGN_BASE_PATH, DOCUSIGN_TEMPLATE_ID and DOCUSIGN_TEMPLATE_ROLE from .env.local, and
// the private key from DOCUSIGN_PRIVATE_KEY_FILE (default ~/.datahacks/docusign-private-pkcs8.pem).
// Never prints them.

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { createSign, randomUUID } from "node:crypto";
import { homedir } from "node:os";

const env = Object.fromEntries(
  readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split("\n")
    .map(line => line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/))
    .filter(Boolean)
    .map(([, k, v]) => [k, v.trim().replace(/^["']|["']$/g, "")]),
);
const production = env.DOCUSIGN_ENV === "production";
const OAUTH_HOST = production ? "account.docusign.com" : "account-d.docusign.com";
const APPS_ORIGIN = production ? "https://apps.docusign.com" : "https://apps-d.docusign.com";
const BUNDLE = production ? "https://js.docusign.com/bundle.js" : "https://js-d.docusign.com/bundle.js";
const PORT = 8080;

async function accessToken() {
  const key = readFileSync(env.DOCUSIGN_PRIVATE_KEY_FILE || `${homedir()}/.datahacks/docusign-private-pkcs8.pem`, "utf8");
  const part = o => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${part({ alg: "RS256", typ: "JWT" })}.${part({
    iss: env.DOCUSIGN_INTEGRATION_KEY, sub: env.DOCUSIGN_USER_ID, aud: OAUTH_HOST,
    iat: now, exp: now + 3600, scope: "signature impersonation",
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(key).toString("base64url");
  const res = await fetch(`https://${OAUTH_HOST}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  });
  const body = await res.json();
  if (!body.access_token) throw new Error(`DocuSign sign-in failed (${res.status}): ${body.error ?? "unknown error"}`);
  return body.access_token;
}

let token;
async function docusign(path, init = {}) {
  token ??= await accessToken();
  const res = await fetch(`${env.DOCUSIGN_BASE_PATH}/v2.1/accounts/${env.DOCUSIGN_ACCOUNT_ID}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) throw new Error(`DocuSign ${path} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

// Tabs sit on the line above each label; offsets are in points.
const anchored = (anchorString, yOffset, tabLabel) => ({
  anchorString, anchorUnits: "pixels", anchorXOffset: "0", anchorYOffset: String(yOffset),
  anchorIgnoreIfNotPresent: "false", anchorMatchWholeWord: "true", tabLabel,
});

const [command, ...args] = process.argv.slice(2);

if (command === "check") {
  const { envelopeTemplates = [] } = await docusign("/templates");
  console.log("Signed in. Templates:");
  for (const t of envelopeTemplates) console.log(`  ${t.templateId}  ${t.name}`);
} else if (command === "template") {
  const [pdfPath, name = "DataHacks 2027 Liability Waiver (DRAFT)"] = args;
  if (!pdfPath) throw new Error("Usage: template path/to/waiver.pdf [name]");
  const template = await docusign("/templates", {
    method: "POST",
    body: JSON.stringify({
      name,
      description: "Mentor/judge liability waiver, signed inside the portal (focused view).",
      emailSubject: "DataHacks liability waiver",
      documents: [{ documentId: "1", name: "Liability waiver.pdf", fileExtension: "pdf", documentBase64: readFileSync(pdfPath).toString("base64") }],
      recipients: {
        signers: [{
          recipientId: "1", roleName: env.DOCUSIGN_TEMPLATE_ROLE || "Signer", routingOrder: "1",
          tabs: {
            signHereTabs: [anchored("Participant signature", -20, "signature")],
            dateSignedTabs: [anchored("Date signed", -16, "date_signed")],
            fullNameTabs: [anchored("Participant full name", -16, "full_name")],
            emailAddressTabs: [anchored("Email", -16, "email")],
          },
        }],
      },
      status: "created",
    }),
  });
  console.log(`Template created: ${template.templateId}\nPut it in .env.local as DOCUSIGN_TEMPLATE_ID.`);
} else if (command === "sign-test") {
  const [email, name] = args;
  if (!email || !name) throw new Error('Usage: sign-test you@example.com "Your Name"');
  const origin = `http://localhost:${PORT}`;
  const clientUserId = randomUUID(); // stands in for the Supabase user id
  const { envelopeId } = await docusign("/envelopes", {
    method: "POST",
    body: JSON.stringify({
      templateId: env.DOCUSIGN_TEMPLATE_ID,
      templateRoles: [{ roleName: env.DOCUSIGN_TEMPLATE_ROLE || "Signer", name, email, clientUserId }],
      status: "sent",
    }),
  });
  const { url } = await docusign(`/envelopes/${envelopeId}/views/recipient`, {
    method: "POST",
    body: JSON.stringify({
      returnUrl: `${origin}/done`, authenticationMethod: "none", email, userName: name, clientUserId,
      frameAncestors: [origin, APPS_ORIGIN], messageOrigins: [APPS_ORIGIN],
    }),
  });
  // Same embed as src/staff-portal/Waiver.tsx.
  const page = `<!doctype html><meta charset="utf-8"><title>Waiver signing test</title>
<p id="log">Loading DocuSign…</p><div id="sp-docusign" style="width:900px;height:85vh"></div>
<script src="${BUNDLE}"></script><script>
const log = m => document.getElementById("log").textContent = m;
window.DocuSign.loadDocuSign(${JSON.stringify(env.DOCUSIGN_INTEGRATION_KEY)}).then(docusign => {
  const signing = docusign.signing({ url: ${JSON.stringify(url)}, displayFormat: "focused" });
  signing.on("ready", () => log("Ready: sign below."));
  signing.on("sessionEnd", e => log("Session ended: " + e.sessionEndType));
  signing.mount("#sp-docusign");
}).catch(e => log("Error: " + e.message));
</script>`;
  const server = createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(req.url === "/" ? page : "Signing finished; this tab can close.");
  }).listen(PORT, "127.0.0.1");
  console.log(`Envelope ${envelopeId}. Open ${origin}/ within 5 minutes and sign.`);
  for (;;) {
    await new Promise(r => setTimeout(r, 5000));
    const { status } = await docusign(`/envelopes/${envelopeId}`);
    if (status === "completed" || status === "declined" || status === "voided") {
      console.log(`Envelope ${envelopeId}: ${status}`);
      server.close();
      process.exit(status === "completed" ? 0 : 1);
    }
  }
} else {
  console.log("Usage: node scripts/dev/docusign.mjs check | template <pdf> [name] | sign-test <email> <name>");
}
