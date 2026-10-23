import { describe, expect, it } from "vitest";
import { portalTitle } from "./titles";

describe("portal tab titles", () => {
  it("names each portal page", () => {
    expect(portalTitle("/portal/hacker")).toBe("Status · DataHacks Application Portal");
    expect(portalTitle("/portal/mentor/handbook")).toBe("Handbook · DataHacks Application Portal");
    expect(portalTitle("/portal/hacker/tracks")).toBe("Tracks & challenges · DataHacks Application Portal");
    expect(portalTitle("/portal/hacker/schedule")).toBe("Run of Show · DataHacks Application Portal");
    expect(portalTitle("/portal/hybrid/judging")).toBe("Judging · DataHacks Application Portal");
    expect(portalTitle("/portal/apply/hacker")).toBe("Hacker Application · DataHacks Application Portal");
    expect(portalTitle("/login/mentor")).toBe("Sign In · DataHacks Application Portal");
  });

  it("names the organizer pages", () => {
    expect(portalTitle("/portal/organizer")).toBe("Organizer Console · DataHacks");
    expect(portalTitle("/organizer")).toBe("Organizer Sign In · DataHacks");
  });
});
