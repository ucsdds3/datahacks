import { describe, expect, it } from "vitest";
import { errorKind, friendlyError } from "./friendlyError";

describe("friendly errors", () => {
  it("recognises a lost connection in every browser's words", () => {
    for (const message of ["TypeError: Failed to fetch", "TypeError: Load failed", "TypeError: NetworkError when attempting to fetch resource.", "FetchError: fetch failed"]) {
      expect(errorKind({ message }), message).toBe("network");
    }
    expect(errorKind(new TypeError("Failed to fetch"))).toBe("network");
  });

  it("recognises an expired or missing sign-in", () => {
    expect(errorKind({ code: "PGRST301", message: "JWT expired" })).toBe("session");
    expect(errorKind({ code: "PGRST303", message: "JWT expired" })).toBe("session");
    expect(errorKind({ code: "42501", message: 'new row violates row-level security policy for table "applications"' })).toBe("session");
    expect(errorKind({ status: 401, message: "Unauthorized" })).toBe("session");
  });

  it("hides the missing-event developer message", () => {
    expect(friendlyError(new Error("No event with code DH27. Add it in Supabase: Table Editor -> events."))).toMatch(/aren't available right now/);
  });

  it("never returns the raw text", () => {
    for (const error of [{ message: "JWT expired" }, new Error("boom"), "weird", null]) {
      const text = friendlyError(error);
      expect(text).not.toMatch(/JWT|boom|weird|TypeError/);
    }
  });
});
