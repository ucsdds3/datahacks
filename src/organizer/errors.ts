/**
 * Error text for organizers. Supabase hands back plain objects for database
 * errors ({ message, code, details }), so String(e) would print
 * "[object Object]"; this finds the message in whatever was thrown.
 */
export function errorText(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "string" && e) return e;
  if (e && typeof e === "object") {
    const { message, error, error_description, code } = e as Record<string, unknown>;
    const text = [message, error, error_description].find(v => typeof v === "string" && v.trim());
    if (typeof text === "string") return typeof code === "string" && code && !text.includes(code) ? `${text} (${code})` : text;
    try {
      const json = JSON.stringify(e);
      if (json && json !== "{}") return json;
    } catch { /* circular */ }
  }
  return "Something went wrong, with no details. Check your connection and try again.";
}

/** A network failure: the request may or may not have reached the server. */
export const isNetworkError = (e: unknown) => {
  const name = (e as { name?: string } | null)?.name;
  const message = errorText(e);
  return name === "FunctionsFetchError" || name === "TypeError" || /failed to fetch|network|load failed|fetch failed/i.test(message);
};

type FunctionsError = { name?: string; message?: string; context?: unknown };

/**
 * What a failed edge function call means, in words. Only a 404 means the
 * function isn't deployed; anything else says what actually went wrong, and
 * for a send, that anyone already emailed is recorded (so sending again is safe).
 */
export async function functionErrorMessage(error: FunctionsError, service: "email" | "passes"): Promise<{ message: string; status: number | null; code: string | null }> {
  const what = service === "email" ? "email" : "wallet pass";
  const fn = service === "email" ? "send-email" : "send-wallet-passes";
  const context = error.context as (Partial<Response> & { status?: number }) | undefined;
  const status = typeof context?.status === "number" ? context.status : null;
  let detail: { error?: string; code?: string } | null = null;
  try {
    if (context && typeof (context as Response).json === "function") detail = await (context as Response).clone().json();
  } catch { /* not JSON */ }

  if (status === 404) {
    return { message: `${service === "email" ? "Email sending" : "Wallet passes"} isn't set up yet: the ${fn} function isn't deployed. Nothing was sent.`, status, code: "not_deployed" };
  }
  if (detail?.error) return { message: detail.error, status, code: detail.code ?? null };
  if (status === 504 || status === 546 || error.name === "FunctionsRelayError") {
    return {
      message: `The ${what} service took too long and was stopped (HTTP ${status ?? "relay"}). Some ${what}s in that batch may have gone out; they're recorded, so sending again only reaches people who haven't had one.`,
      status, code: "timeout",
    };
  }
  if (error.name === "FunctionsFetchError" || status === null) {
    return {
      message: `Couldn't reach the ${what} service (a network problem, or it timed out). Anyone already sent to is recorded, so sending again only reaches the rest.`,
      status, code: "network",
    };
  }
  return { message: `The ${what} service failed (HTTP ${status}): ${error.message ?? "no details"}.`, status, code: null };
}
