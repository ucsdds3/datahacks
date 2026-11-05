// Embedded DocuSign signing for the mentor/judge liability waiver.
//
// POST { action: "start", returnPath, eventCode? }  -> { url, envelopeId }          signing session for the caller
// POST { action: "status", envelopeId, eventCode? } -> { signed, status, recorded } whether the caller has signed
//
// The browser can't be trusted to say "I signed", so the portal only enables Submit
// once this function has asked DocuSign and DocuSign says the signer finished.
// A signer can't finish without completing the template's required Sign Here tab.
//
// When `status` finds the caller's envelope completed, it records the waiver in
// public.waivers (service role; nobody signed in can write that table), which
// the check-in desk reads through attendees.waiver_signed_at. `recorded` says
// whether that worked. eventCode is the portal's EVENT_CODE; without it the
// caller's most recent accepted application decides the event.
// TODO: also accept DocuSign Connect webhooks (envelope-completed), so a waiver
// is recorded even if the signer closes the page before `status` runs.
//
// Secrets (supabase secrets set ...):
//   DOCUSIGN_ENV              "demo" or "production"
//   DOCUSIGN_INTEGRATION_KEY  app's integration key (client id)
//   DOCUSIGN_USER_ID          API user to impersonate (GUID)
//   DOCUSIGN_ACCOUNT_ID       account id (GUID)
//   DOCUSIGN_BASE_PATH        e.g. https://demo.docusign.net/restapi
//   DOCUSIGN_PRIVATE_KEY      RSA key in PKCS#8 PEM ("BEGIN PRIVATE KEY"). DocuSign hands out
//                             PKCS#1; convert with: openssl pkcs8 -topk8 -nocrypt -in key.pem
//   DOCUSIGN_TEMPLATE_ID      template made from the waiver file
//   DOCUSIGN_TEMPLATE_ROLE    signer role name in that template (default "Signer")
// Full setup (consent, template, test script): docs/docusign-waiver.md

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";
import { importPKCS8, SignJWT } from "npm:jose@5.9.6";

const env = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing secret ${name}`);
  return value;
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const isProduction = () => Deno.env.get("DOCUSIGN_ENV") === "production";
const oauthHost = () => (isProduction() ? "account.docusign.com" : "account-d.docusign.com");
const appsOrigin = () => (isProduction() ? "https://apps.docusign.com" : "https://apps-d.docusign.com");

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const key = await importPKCS8(env("DOCUSIGN_PRIVATE_KEY").replace(/\\n/g, "\n"), "RS256");
  const assertion = await new SignJWT({ scope: "signature impersonation" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(env("DOCUSIGN_INTEGRATION_KEY"))
    .setSubject(env("DOCUSIGN_USER_ID"))
    .setAudience(oauthHost())
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);

  const res = await fetch(`https://${oauthHost()}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`DocuSign auth failed (${res.status}): ${await res.text()}`);
  const { access_token, expires_in } = await res.json();
  cachedToken = { value: access_token, expiresAt: Date.now() + expires_in * 1000 };
  return access_token as string;
}

async function docusign(path: string, init: RequestInit = {}) {
  const url = `${env("DOCUSIGN_BASE_PATH")}/v2.1/accounts/${env("DOCUSIGN_ACCOUNT_ID")}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) throw new Error(`DocuSign ${path} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

type Signer = { recipientId: string; clientUserId?: string; email: string; name: string; status: string; signedDateTime?: string };

/** The caller's signer on an envelope; null if the envelope isn't theirs. */
async function signerFor(envelopeId: string, userId: string): Promise<Signer | null> {
  const { signers = [] } = await docusign(`/envelopes/${encodeURIComponent(envelopeId)}/recipients`);
  return (signers as Signer[]).find(s => s.clientUserId === userId) ?? null;
}

/**
 * The event this waiver is for: the caller must have an accepted application there.
 * Uses the caller's own client, so row-level security limits it to their applications.
 */
async function acceptedEventId(supabase: SupabaseClient, userId: string, eventCode: unknown): Promise<string | null> {
  let query = supabase
    .from("applications")
    .select("event_id, events!inner(code)")
    .eq("user_id", userId)
    .eq("status", "accepted")
    .order("submitted_at", { ascending: false })
    .limit(1);
  if (typeof eventCode === "string" && /^[A-Za-z0-9]{2,10}$/.test(eventCode)) {
    query = query.ilike("events.code", eventCode);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data?.[0]?.event_id as string | undefined) ?? null;
}

/**
 * Records a completed waiver. Idempotent: the first signature on file is kept.
 * Returns false (and logs) rather than throwing, so a database hiccup never hides
 * DocuSign's answer from the signer.
 */
async function recordWaiver(supabase: SupabaseClient, userId: string, eventCode: unknown, envelopeId: string, signer: Signer) {
  try {
    const eventId = await acceptedEventId(supabase, userId, eventCode);
    if (!eventId) return false;
    const signedAt = signer.signedDateTime && !Number.isNaN(Date.parse(signer.signedDateTime))
      ? new Date(signer.signedDateTime).toISOString()
      : new Date().toISOString();
    const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
    const { error } = await admin
      .from("waivers")
      .upsert({ event_id: eventId, user_id: userId, signed_at: signedAt, envelope_id: envelopeId },
        { onConflict: "event_id,user_id", ignoreDuplicates: true });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Couldn't record the waiver", error);
    return false;
  }
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Who is asking: the Supabase session the portal sends along.
  const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return json({ error: "Sign in to sign the waiver." }, 401);

  try {
    const body = await req.json();

    if (body.action === "start") {
      const origin = req.headers.get("Origin");
      if (!origin) return json({ error: "Missing origin" }, 400);
      // Only accepted applicants get a waiver; each envelope counts against the DocuSign plan.
      // Row-level security limits this to the caller's own applications.
      const { data: applications, error: applicationError } = await supabase
        .from("applications")
        .select("first_name, last_name")
        .eq("user_id", user.id)
        .eq("status", "accepted")
        .order("submitted_at", { ascending: false })
        .limit(1);
      if (applicationError) throw applicationError;
      const application = applications?.[0];
      if (!application) return json({ error: "Only accepted applicants can sign the waiver." }, 403);
      // Same name the portal greets them with, so the waiver's "Participant full name" matches.
      const name = `${application.first_name ?? ""} ${application.last_name ?? ""}`.trim()
        || (user.user_metadata?.full_name as string | undefined)?.trim()
        || user.email;
      // Back to the waiver page of whichever portal (mentor/judge) started signing.
      const returnPath = typeof body.returnPath === "string" && /^\/portal\/[a-z]+\/waiver$/.test(body.returnPath)
        ? body.returnPath
        : "/portal/mentor/waiver";

      // Reuse an envelope the caller already opened instead of creating a second one.
      let envelopeId: string | undefined = body.envelopeId;
      if (envelopeId && !(await signerFor(envelopeId, user.id))) envelopeId = undefined;
      if (!envelopeId) {
        const envelope = await docusign("/envelopes", {
          method: "POST",
          body: JSON.stringify({
            templateId: env("DOCUSIGN_TEMPLATE_ID"),
            templateRoles: [{
              roleName: Deno.env.get("DOCUSIGN_TEMPLATE_ROLE") ?? "Signer",
              name,
              email: user.email,
              // Marks the signer as embedded, and is how we later check the envelope is theirs.
              clientUserId: user.id,
            }],
            status: "sent",
          }),
        });
        envelopeId = envelope.envelopeId as string;
      }

      const view = await docusign(`/envelopes/${envelopeId}/views/recipient`, {
        method: "POST",
        body: JSON.stringify({
          returnUrl: `${origin}${returnPath}`,
          authenticationMethod: "none",
          email: user.email,
          userName: name,
          clientUserId: user.id,
          frameAncestors: [origin, appsOrigin()],
          messageOrigins: [appsOrigin()],
        }),
      });
      return json({ url: view.url, envelopeId });
    }

    if (body.action === "status") {
      if (typeof body.envelopeId !== "string" || !/^[A-Za-z0-9-]{1,100}$/.test(body.envelopeId)) {
        return json({ error: "Missing envelopeId" }, 400);
      }
      // Also proves the envelope is the caller's: its embedded signer is their user id.
      const signer = await signerFor(body.envelopeId, user.id);
      if (!signer) return json({ error: "Envelope not found" }, 404);
      const signed = signer.status === "completed";
      const recorded = signed && await recordWaiver(supabase, user.id, body.eventCode, body.envelopeId, signer);
      return json({ signed, status: signer.status, recorded });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: "DocuSign request failed." }, 502);
  }
});
