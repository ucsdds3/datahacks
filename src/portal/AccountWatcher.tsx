import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

/**
 * The site shares one session per browser, and Supabase passes a sign-in in one
 * tab to every other open tab. Signing in on this tab always reloads it (Google
 * sends it back to /auth/callback), so when the account changes under an open
 * page it was another tab: say so, and reload this page's data for the new
 * account instead of leaving the old account's on screen.
 */
export function AccountWatcher() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id ?? null;
  const email = session?.user.email ?? "";
  // The last account this page showed. Kept through a sign-out, so out-then-in
  // as someone else (Use a different account, in another tab) still counts.
  const shown = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    if (shown.current && shown.current !== userId) {
      toast(`Signed in as ${email || "a different account"} in another tab`, {
        description: "This page now shows that account.",
      });
      queryClient.invalidateQueries();
    }
    shown.current = userId;
  }, [userId, email, queryClient]);

  return null;
}
