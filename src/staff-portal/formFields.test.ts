import { describe, expect, it } from "vitest";
import { formatPhone, isValidPhone } from "./formFields";

describe("phone numbers", () => {
  it("formats 10 digits as (858) 370-2478", () => {
    expect(formatPhone("8583702478")).toBe("(858) 370-2478");
  });

  it("formats as you type", () => {
    expect(formatPhone("858")).toBe("(858");
    expect(formatPhone("858370")).toBe("(858) 370");
    expect(formatPhone("8583702")).toBe("(858) 370-2");
  });

  it("drops anything that isn't a digit, and stops at 10", () => {
    expect(formatPhone("858-370-2478")).toBe("(858) 370-2478");
    expect(formatPhone("(858) 370 2478 99")).toBe("(858) 370-2478");
    expect(formatPhone("abc")).toBe("");
  });

  it("drops a pasted +1 country code instead of shifting the number", () => {
    expect(formatPhone("+1 858 370 2478")).toBe("(858) 370-2478");
    expect(formatPhone("1-858-370-2478")).toBe("(858) 370-2478");
    // Typed digit by digit with the 1 first, it still ends up right.
    expect(formatPhone(formatPhone("1858370247") + "8")).toBe("(858) 370-2478");
  });

  it("only accepts all 10 digits", () => {
    expect(isValidPhone("(858) 370-2478")).toBe(true);
    expect(isValidPhone("(858) 370-247")).toBe(false);
    expect(isValidPhone("858-370-2478")).toBe(false);
  });
});
