// Choices for the application forms' dropdowns. Lists are alphabetical, with
// the likeliest answer pinned first where that saves scrolling.
//
// The database only accepts these exact options (application_*_check in
// supabase/migrations/*_application_checks.sql, see docs/untrusted-input.md):
// adding, renaming or removing one needs a migration that updates the matching
// constraint. COUNTRIES and SCHOOLS aren't checked there.

export const GENDERS = ["Woman", "Man", "Non-binary", "Prefer to self-describe", "Prefer not to say"];

export const RACES = [
  "American Indian or Alaska Native",
  "Asian",
  "Black or African American",
  "Hispanic or Latino",
  "Middle Eastern or North African",
  "Native Hawaiian or Other Pacific Islander",
  "White",
  "Other",
  "Prefer not to say",
];

export const LEVELS_OF_STUDY = [
  "High school",
  "Undergraduate (2-year: community college, associate's)",
  "Undergraduate (3+ year: bachelor's)",
  "Graduate (master's, doctoral)",
  "Post-doctorate",
  "Code school or bootcamp",
  "Other vocational or trade program",
  "Not currently a student",
  "Other",
];

/**
 * Suggestions for the school field: every US and Canadian college and university
 * in the open Hipo university-domains-list (MIT licensed,
 * github.com/Hipo/university-domains-list), A–Z. Anything else can be typed in.
 */
export { default as SCHOOLS } from "./schools.json";

const thisYear = new Date().getFullYear();
export const GRADUATION_YEARS = [...Array.from({ length: 8 }, (_, i) => String(thisYear + i)), "Already graduated", "Not applicable"];

export const HACKATHON_EXPERIENCE = ["This will be my first", "1–2 hackathons", "3–5 hackathons", "6 or more"];

export const HEARD_ABOUT = [
  "DS3 club or event",
  "Email newsletter",
  "Friend or word of mouth",
  "Instagram",
  "LinkedIn",
  "Major League Hacking (MLH)",
  "Past DataHacks",
  "Professor or class",
  "Tabling on campus",
  "Other",
];

export const TRAVEL_METHODS = ["Car", "Bus", "Train", "Plane", "Other"];

export const TRAVEL_DISTANCES = ["Under 50 miles", "50–200 miles", "200–500 miles", "Over 500 miles", "From outside the US"];

/** Countries, United States first, then alphabetical. */
export const COUNTRIES = ["United States", ...[
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia",
  "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin",
  "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
  "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia",
  "Comoros", "Congo", "Costa Rica", "Côte d'Ivoire", "Croatia", "Cuba", "Cyprus", "Czechia",
  "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt",
  "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon",
  "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti",
  "Honduras", "Hong Kong", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy",
  "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia",
  "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Macao", "Madagascar", "Malawi",
  "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova",
  "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands",
  "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau",
  "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania",
  "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino",
  "São Tomé and Príncipe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia",
  "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan",
  "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo",
  "Tonga", "Trinidad and Tobago", "Tunisia", "Türkiye", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine",
  "United Arab Emirates", "United Kingdom", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam",
  "Yemen", "Zambia", "Zimbabwe",
]];
