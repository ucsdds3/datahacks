import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatPacificDate } from "./pacificTime";
import { TIMELINE } from "@/staff-portal/config";

// Run as if the applicant is in India, far east of San Diego.
const originalTz = process.env.TZ;
beforeAll(() => { process.env.TZ = "Asia/Kolkata"; });
afterAll(() => { process.env.TZ = originalTz; });

describe("dates applicants see are in Pacific time", () => {
  it("the priority deadline is November 30 everywhere, not December 1", () => {
    // 11:59 PM Pacific on Nov 30 is already Dec 1 in Kolkata (and in UTC).
    expect(new Date(TIMELINE.priorityDeadline).toLocaleDateString("en-US", { month: "long", day: "numeric" })).toBe("December 1");
    expect(formatPacificDate(TIMELINE.priorityDeadline)).toBe("November 30, 2026");
    expect(formatPacificDate(TIMELINE.priorityDeadline, { month: "long", day: "numeric" })).toBe("November 30");
  });

  it("the regular deadline is December 21", () => {
    expect(formatPacificDate(TIMELINE.regularDeadline)).toBe("December 21, 2026");
  });

  it("takes ISO strings (a submitted_at)", () => {
    expect(formatPacificDate("2026-12-01T05:00:00Z")).toBe("November 30, 2026");
  });
});
