import type { Quota } from "./data";

const time = (iso: string) => new Date(iso).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });

/**
 * The Gmail account's room left today: the console stops at the daily limit
 * (public.email_daily_limit, under Google Workspace's 2,000 a day), counting
 * every email from the last 24 hours across decisions, blasts and passes.
 * `need`: how many the action on screen would send, to warn before it's too many.
 */
export default function QuotaNote({ quota, need }: { quota: Quota | null; need?: number }) {
  if (!quota) return null;
  const tight = need !== undefined ? need > quota.remaining : quota.remaining < quota.limit * 0.1;
  return (
    <p className={`og-quota${tight ? " tight" : ""}`} role="status">
      Gmail sending: <strong>{quota.remaining.toLocaleString()}</strong> of {quota.limit.toLocaleString()} left in the last 24 hours
      {quota.remaining < quota.limit && quota.frees_at ? ` (more frees up from ${time(quota.frees_at)})` : ""}.
    </p>
  );
}
