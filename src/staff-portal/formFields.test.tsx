import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { INTERNATIONAL_PHONES, LimitedTextarea, formatPhone, isInternationalPhone, isValidPhone, phoneProblem } from "./formFields";

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

describe("international phone numbers", () => {
  it("keeps a +44 or +91 number as typed instead of turning it into a fake US one", () => {
    expect(formatPhone("+44 20 7946 0958")).toBe("+44 20 7946 0958");
    expect(formatPhone("+91 98765 43210")).toBe("+91 98765 43210");
    expect(formatPhone("+52 (664) 123-4567")).toBe("+52 664 123 4567");
    // Typing it: the + survives, and spaces can be typed.
    expect(formatPhone("+")).toBe("+");
    expect(formatPhone("+4")).toBe("+4");
    expect(formatPhone("+44 ")).toBe("+44 ");
    // At most 15 digits (E.164).
    expect(formatPhone("+44 1234 5678 9012 3456").replace(/\D/g, "")).toHaveLength(15);
  });

  it("still formats +1 and 10-digit numbers the US way", () => {
    expect(formatPhone("+1 858 555 0123")).toBe("(858) 555-0123");
    expect(formatPhone("8585550123")).toBe("(858) 555-0123");
  });

  it("checks an international number is + and 8 to 15 digits", () => {
    expect(isInternationalPhone("+44 20 7946 0958")).toBe(true);
    expect(isInternationalPhone("+91 98765 43210")).toBe(true);
    expect(isInternationalPhone("+44 1234")).toBe(false);
    expect(isInternationalPhone("+44 1234 5678 9012 3456")).toBe(false);
    expect(isInternationalPhone("+1 858 555 0123")).toBe(false);
  });

  it("explains what's wrong instead of accepting a mangled number", () => {
    expect(phoneProblem("(858) 555-0123")).toBeNull();
    expect(phoneProblem("(858) 555")).toBe("Enter a 10-digit phone number.");
    // The database only stores US-format numbers until its check is widened (INTERNATIONAL_PHONES).
    expect(isValidPhone("+44 20 7946 0958")).toBe(INTERNATIONAL_PHONES);
    expect(phoneProblem("+44 20 7946 0958")).toEqual(INTERNATIONAL_PHONES ? null : expect.stringMatching(/US or Canadian \(\+1\)/));
  });
});

describe("LimitedTextarea", () => {
  const Harness = ({ max = 20, initial = "" }) => {
    const [value, setValue] = useState(initial);
    return <label>Essay <LimitedTextarea maxLength={max} value={value} onChange={e => setValue(e.target.value)} /></label>;
  };

  it("shows a live character count", () => {
    render(<Harness initial="hello" />);
    expect(screen.getByText("5 / 20 characters")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "hello there" } });
    expect(screen.getByText("11 / 20 characters")).toBeInTheDocument();
    // Screen readers get the count as the field's description, not its name.
    expect(screen.getByRole("textbox")).toHaveAccessibleDescription("11 / 20 characters");
  });

  it("refuses a paste that would go over the limit, saying so, instead of cutting it off", () => {
    render(<Harness initial="0123456789" />);
    const box = screen.getByRole("textbox") as HTMLTextAreaElement;
    box.setSelectionRange(10, 10);
    const allowed = fireEvent.paste(box, { clipboardData: { getData: () => "x".repeat(25) } });
    expect(allowed).toBe(false); // default prevented: nothing pasted
    expect(screen.getByRole("alert")).toHaveTextContent("35 characters, over the 20 limit");
    expect(box.value).toBe("0123456789");
  });

  it("lets a paste that fits through", () => {
    render(<Harness initial="0123456789" />);
    const box = screen.getByRole("textbox") as HTMLTextAreaElement;
    box.setSelectionRange(0, 10); // replacing the whole answer
    expect(fireEvent.paste(box, { clipboardData: { getData: () => "y".repeat(20) } })).toBe(true);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
