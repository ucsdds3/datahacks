import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * The "We've received your application" email, from the browser's side. The
 * send-received-email edge function decides everything (whose application,
 * which address, what it says) from the database and sends at most one per
 * application ever, so asking twice is harmless. The browser only says "now
 * would be a good time":
 *   - the forms ask right after a successful submit, without waiting for it;
 *   - the portal asks again when it loads and the database says the email
 *     hasn't gone out yet (the tab was closed straight away, Gmail failed, or
 *     the day's email limit was reached).
 */
export const RECEIVED_EMAIL_FUNCTION = "send-received-email";

/** One request per account per page load; a failed one is forgotten so a later check can retry. */
const asked = new Map<string, Promise<boolean>>();

/** Asks the server to send the signed-in person's email. Never throws; true if the request went through. */
export function requestReceivedEmail(userId: string): Promise<boolean> {
  const pending = asked.get(userId);
  if (pending) return pending;
  const request = Promise.resolve()
    .then(() => supabase.functions.invoke(RECEIVED_EMAIL_FUNCTION, { body: {} }))
    .then(({ error }) => {
      if (error) throw error;
      return true;
    })
    .catch(() => {
      asked.delete(userId);
      return false;
    });
  asked.set(userId, request);
  return request;
}

/** Tests only: forget which accounts this page load has asked for. */
export const forgetReceivedEmailRequests = () => asked.clear();

/**
 * The portal's fallback. While the application is under review, reads its
 * received_emailed_at and asks for the email if it hasn't gone out. Quiet on
 * any error (before the database change is deployed the column doesn't exist,
 * and that mustn't get in the way of the portal).
 */
export function useReceivedEmailCheck({ applicationId, userId, underReview, preview }: {
  applicationId: string | undefined;
  userId: string | undefined;
  underReview: boolean;
  preview: boolean;
}) {
  useEffect(() => {
    if (preview || !applicationId || !userId || !underReview) return;
    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("applications")
          .select("status, received_emailed_at")
          .eq("id", applicationId)
          .maybeSingle();
        if (!active || error || !data) return;
        const row = data as { status?: string | null; received_emailed_at?: string | null };
        if (row.status === "submitted" && !row.received_emailed_at) await requestReceivedEmail(userId);
      } catch {
        // Never in the way of the portal.
      }
    })();
    return () => { active = false; };
  }, [applicationId, userId, underReview, preview]);
}
