import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { isPreview } from "./preview";

type Organizer = { email: string; status: "active" | "invited"; added_at: string };

const PREVIEW_ORGANIZERS: Organizer[] = [
  { email: "mprakash@ucsd.edu", status: "active", added_at: "2026-10-22T00:00:00Z" },
  { email: "abhatnagar@ucsd.edu", status: "invited", added_at: "2026-10-22T00:00:00Z" },
  { email: "tchhabra@ucsd.edu", status: "invited", added_at: "2026-10-22T00:00:00Z" },
];

const rpcError = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

/**
 * Who can open this console and the check-in desk. Adding someone who has
 * never signed in leaves an invite that becomes access on their first sign-in.
 */
export default function OrganizersPanel({ eventId, myEmail }: { eventId: string; myEmail: string }) {
  const preview = isPreview();
  const client = useQueryClient();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const list = useQuery({
    queryKey: ["organizers", eventId],
    queryFn: async () => {
      if (preview) return PREVIEW_ORGANIZERS;
      const { data, error } = await supabase.rpc("list_organizers", { p_event_id: eventId });
      rpcError(error);
      return (data ?? []) as Organizer[];
    },
  });

  const refresh = () => client.invalidateQueries({ queryKey: ["organizers", eventId] });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (preview) throw new Error("Preview only: nobody is added.");
      const { data, error } = await supabase.rpc("add_organizer", { p_event_id: eventId, p_email: email });
      rpcError(error);
      const address = email.trim().toLowerCase();
      setMessage({
        ok: true,
        text: data === "added"
          ? `${address} is now an organizer.`
          : `${address} will become an organizer the first time they sign in at the organizer sign-in page.`,
      });
      setEmail("");
      refresh();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (address: string) => {
    if (!window.confirm(`Remove ${address} as an organizer? They lose access to this console and the check-in desk.`)) return;
    setMessage(null);
    try {
      if (preview) throw new Error("Preview only: nobody is removed.");
      const { error } = await supabase.rpc("remove_organizer", { p_event_id: eventId, p_email: address });
      rpcError(error);
      refresh();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <div className="og-organizers">
      <section className="sp-card">
        <div className="sp-card-header"><h2>Add an organizer</h2></div>
        <form className="og-add-organizer" onSubmit={add}>
          <label>
            Google account email
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@ucsd.edu" disabled={busy} />
          </label>
          <button className="sp-button primary" disabled={busy || !email.trim()}><UserPlus size={15} aria-hidden /> Add</button>
        </form>
        <p className="og-hint">
          Organizers can see every application, release decisions, send email, and use the check-in desk. They sign in at{" "}
          <code>{window.location.origin}/organizer</code>.
        </p>
        {message && <p className={message.ok ? "og-success" : "sp-error"}>{message.text}</p>}
      </section>

      <section className="sp-card">
        <div className="sp-card-header"><h2>Organizers</h2></div>
        {list.isPending && <p>Loading…</p>}
        {list.isError && <p className="sp-error">{(list.error as Error).message}</p>}
        <ul className="og-organizer-list">
          {(list.data ?? []).map(o => (
            <li key={o.email}>
              <span>{o.email}</span>
              <span className={`og-organizer-status ${o.status}`}>{o.status === "active" ? "Active" : "Invited · hasn't signed in"}</span>
              {o.email !== myEmail.toLowerCase() && (
                <button className="og-icon-button" onClick={() => remove(o.email)} aria-label={`Remove ${o.email}`}><X size={16} /></button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
