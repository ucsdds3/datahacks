import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useRefreshQuota } from "./data";
import { errorText } from "./errors";
import { ReceivedSendError, countReceivedDue, sendReceivedDue, type ReceivedSendResult } from "./receivedEmails";

const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

function summary(result: ReceivedSendResult): string {
  const parts = [`Sent ${plural(result.sent, "email", "emails")}.`];
  if (result.failed.length) parts.push(`${result.failed.length} failed: ${result.failed.slice(0, 3).map(f => f.error).join("; ")}`);
  if (result.stopped === "daily_limit") parts.push("Gmail's daily limit is reached, so the rest wait. Press it again once it frees up; nobody gets it twice.");
  return parts.join(" ");
}

/**
 * On the Email page: submitted applications whose "We've received your
 * application" email hasn't gone out yet, and a button to send them. Shows
 * nothing while there are none (or they can't be counted).
 */
export default function ReceivedEmailsCard({ eventId }: { eventId: string }) {
  const client = useQueryClient();
  const refreshQuota = useRefreshQuota();
  const due = useQuery({ queryKey: ["received-due", eventId], queryFn: () => countReceivedDue(eventId), staleTime: 30_000, retry: false });
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const n = due.data ?? 0;
  if (n === 0 && !outcome) return null;

  const send = async () => {
    setSending(true);
    setOutcome(null);
    setProgress(0);
    try {
      const result = await sendReceivedDue(eventId, setProgress);
      setOutcome({ ok: result.failed.length === 0 && result.stopped === null, text: summary(result) });
    } catch (e) {
      const partial = e instanceof ReceivedSendError && e.partial.sent > 0 ? ` ${summary(e.partial)}` : "";
      setOutcome({ ok: false, text: `${errorText(e)}${partial}` });
    } finally {
      setSending(false);
      void client.invalidateQueries({ queryKey: ["received-due", eventId] });
      refreshQuota();
    }
  };

  return (
    <section className="sp-card" aria-labelledby="og-received-heading">
      <div className="sp-card-header"><h2 id="og-received-heading">"We've received your application" emails</h2></div>
      {n > 0 && (
        <p>
          <strong>{plural(n, "submitted application hasn't", "submitted applications haven't")}</strong> had it yet. It goes out by itself
          when someone applies, and again when they next open the portal; any left here are waiting on Gmail's daily limit or a
          failed send (or went in the last few seconds).
        </p>
      )}
      {outcome && <p className={outcome.ok ? "og-success" : "sp-error"} role="status">{outcome.text}</p>}
      {n > 0 && (
        <div className="og-send-row">
          <button className="sp-button" onClick={send} disabled={sending}>
            <Send size={15} aria-hidden /> {sending ? `Sending… ${progress ? `(${progress} sent)` : ""}` : n === 1 ? "Send it now" : "Send them now"}
          </button>
        </div>
      )}
    </section>
  );
}
