import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { currentEventId } from "@/portal/event";

/**
 * On a waitlisted hacker's dashboard: ask to be emailed if a spot opens on the
 * event day, after check-in closes. Saved on their application
 * (applications.waitlist_opt_in_at, through set_waitlist_opt_in). Spots go to
 * people who asked, earliest first, so switching it off and on again puts
 * you at the back.
 */

async function fetchOptIn(userId: string): Promise<boolean> {
  const eventId = await currentEventId();
  const { data, error } = await supabase
    .from("applications")
    .select("waitlist_opt_in_at")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .eq("applicant_type", "hacker")
    .maybeSingle();
  if (error) throw error;
  return !!(data as { waitlist_opt_in_at: string | null } | null)?.waitlist_opt_in_at;
}

async function saveOptIn(optIn: boolean): Promise<boolean> {
  const eventId = await currentEventId();
  const { data, error } = await supabase.rpc("set_waitlist_opt_in", { p_event_id: eventId, p_opt_in: optIn });
  if (error) throw error;
  return data !== null;
}

export default function WaitlistOptIn({ preview = false }: { preview?: boolean }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const client = useQueryClient();
  const [previewOn, setPreviewOn] = useState(false);
  const query = useQuery({
    queryKey: ["waitlist-opt-in", userId],
    queryFn: () => fetchOptIn(userId!),
    enabled: !preview && !!userId,
  });
  const mutation = useMutation({
    mutationFn: saveOptIn,
    onSuccess: on => client.setQueryData(["waitlist-opt-in", userId], on),
  });

  // Not loaded (or the database doesn't have the waitlist yet): show nothing rather than a broken switch.
  if (!preview && !query.isSuccess) return null;
  const on = preview ? previewOn : mutation.isPending ? !!mutation.variables : query.data!;
  const toggle = (next: boolean) => (preview ? setPreviewOn(next) : mutation.mutate(next));

  return (
    <section className="sp-card sp-waitlist-optin" aria-labelledby="sp-waitlist-heading">
      <h2 id="sp-waitlist-heading">Want a spot if one opens on the day?</h2>
      <p>We'll email you if there's room after check-in closes.</p>
      <label className="sp-waitlist-toggle">
        <input
          type="checkbox"
          role="switch"
          checked={on}
          disabled={mutation.isPending}
          onChange={e => toggle(e.target.checked)}
        />
        <span>Email me if a spot opens</span>
      </label>
      {on && <p className="sp-waitlist-note">You're on the list. Spots go out in the order people asked for one, and the email will say when to check in by.</p>}
      {mutation.isError && <p className="sp-error" role="alert">Couldn't save that: {mutation.error.message}</p>}
    </section>
  );
}
