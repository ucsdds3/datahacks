import { supabase } from "@/lib/supabaseClient";

/**
 * Makes sure the signed-in account has its profiles row, just before an
 * application is saved: applications.user_id references profiles(id).
 *
 * The sign-in callback (pages/AuthCallback.tsx) normally makes that row, but a
 * sign-in whose one write never landed (a dropped connection, a tab closed on
 * "Signing you in…") leaves a working session with no profile, and "Continue
 * as …" never goes back through the callback. Every submit then failed with a
 * foreign key error (23503), shown as "Something went wrong on our side".
 *
 * Inserts the row only if it's missing, the way the callback does, so the
 * profile triggers still run on it (link_staff_applications links a mentor or
 * judge application sent from this email); an existing row is left alone.
 * Never throws: if this fails, the application insert still runs and its error
 * says what to do. The MCP server does the same before its insert
 * (supabase/functions/mcp/application.ts saveApplication).
 */
export async function ensureProfile(userId: string, email: string | undefined): Promise<void> {
  try {
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, email }, { onConflict: "id", ignoreDuplicates: true });
    if (error) console.error("Couldn't create the profile before submitting:", error);
  } catch (e) {
    console.error("Couldn't create the profile before submitting:", e);
  }
}
