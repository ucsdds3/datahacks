// Turns a DH26 Google Form answer into the value the DH27 applications columns
// accept (supabase/migrations/*_hacker_logistics.sql). Each normalizer returns
// { value, unmapped }: value is what to store (null = nothing), and unmapped is
// true when there was an answer we couldn't turn into a valid value, so the
// import can count those instead of guessing.

// Zero-width and bidi marks that copy-paste leaves in phone numbers and names.
const INVISIBLE = /[​-‏‪-‮⁠-⁩﻿]/g;

/** One line: no invisible marks, control characters or runs of spaces. */
export function oneLine(raw, max = 200) {
  const text = String(raw ?? "").replace(INVISIBLE, "").replace(/[\x00-\x1f\x7f]+/g, " ").replace(/\s+/g, " ").trim();
  return text.slice(0, max);
}

const SHIRT_ALIASES = { XXXL: "3XL", "2XL": "XXL" };
const SHIRTS = new Set(["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL"]);

/** "M", "xxl", "3XL (or 2XL)" -> "M", "XXL", "3XL". The first size named wins. */
export function shirtSize(raw) {
  const text = oneLine(raw).toUpperCase();
  if (!text) return { value: null, unmapped: false };
  const first = text.match(/^(XXXL|3XL|2XL|XXL|XL|XXS|XS|S|M|L)\b/)?.[1];
  const size = first && (SHIRT_ALIASES[first] ?? first);
  return SHIRTS.has(size) ? { value: size, unmapped: false } : { value: null, unmapped: true };
}

/** Yes / No / Maybe -> yes / no / maybe. */
export function overnightStay(raw) {
  const text = oneLine(raw).toLowerCase().replace(/[^a-z]/g, "");
  if (!text) return { value: null, unmapped: false };
  return ["yes", "no", "maybe"].includes(text) ? { value: text, unmapped: false } : { value: null, unmapped: true };
}

const TEAM = {
  "yes, i am looking for a team.": "looking_for_team",
  "yes, i have a team that is still looking for members.": "team_needs_members",
  "no, i already have a team and we're set.": "have_full_team",
};

/** The DH26 form's three team-matching options -> their DH27 codes. */
export function teamMatching(raw) {
  const text = oneLine(raw).toLowerCase().replace(/[‘’]/g, "'");
  if (!text) return { value: null, unmapped: false };
  return text in TEAM ? { value: TEAM[text], unmapped: false } : { value: null, unmapped: true };
}

// Answers that mean "nothing to accommodate", compared letters only.
const NONE = new Set(["", "no", "none", "na", "nope", "noallergies", "nothing", "nil", "norestrictions", "nodietaryrestrictions"]);

/** Allergies or diet as typed, on one line; null when the answer means none. */
export function dietaryRestrictions(raw) {
  const text = oneLine(raw, 1000);
  return NONE.has(text.toLowerCase().replace(/[^a-z]/g, "")) ? { value: null, unmapped: false } : { value: text, unmapped: false };
}

/**
 * A phone number as the column takes it: US numbers as "(858) 534-2230", others
 * as "+" and their digits. Handles numbers a spreadsheet saved as decimals
 * ("8585342230.0"). Text that isn't a number (a name in the phone box) is unmapped.
 */
export function phone(raw) {
  let text = oneLine(raw, 100);
  if (!text) return { value: null, unmapped: false };
  if (/^\d+\.0$/.test(text)) text = text.slice(0, -2);
  if (/[a-z]/i.test(text)) return { value: null, unmapped: true };
  const digits = text.replace(/\D/g, "");
  const plus = text.startsWith("+");
  const us = (!plus && digits.length === 10) ? digits : (digits.length === 11 && digits[0] === "1") ? digits.slice(1) : null;
  if (us) return { value: `(${us.slice(0, 3)}) ${us.slice(3, 6)}-${us.slice(6)}`, unmapped: false };
  if (digits.length >= 7 && digits.length <= 15) return { value: `+${digits}`, unmapped: false };
  return { value: null, unmapped: true };
}

/**
 * Every logistics column for one DH26 row ({ ec_name, ec_phone, ec_rel,
 * allergies, shirt, overnight, team }). No emergency contact name means no
 * emergency contact at all. Returns { values, unmapped }, where values has only
 * the columns with something to store and unmapped lists the fields that had
 * an answer we couldn't use.
 */
export function logisticsFromDh26(row) {
  const values = {};
  const unmapped = [];
  const name = oneLine(row.ec_name, 200);
  if (name) {
    values.emergency_contact_name = name;
    const relation = oneLine(row.ec_rel, 100);
    if (relation) values.emergency_contact_relation = relation;
    const p = phone(row.ec_phone);
    if (p.value) values.emergency_contact_phone = p.value;
    if (p.unmapped) unmapped.push("emergency_contact_phone");
  }
  for (const [column, field, fn] of [
    ["dietary_restrictions", "allergies", dietaryRestrictions],
    ["shirt_size", "shirt", shirtSize],
    ["overnight_stay", "overnight", overnightStay],
    ["team_matching", "team", teamMatching],
  ]) {
    const r = fn(row[field]);
    if (r.value) values[column] = r.value;
    if (r.unmapped) unmapped.push(column);
  }
  return { values, unmapped };
}

export const LOGISTICS_COLUMNS = [
  "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relation",
  "dietary_restrictions", "shirt_size", "overnight_stay", "team_matching",
];
