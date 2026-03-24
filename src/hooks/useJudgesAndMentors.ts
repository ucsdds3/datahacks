import { useQuery } from "@tanstack/react-query";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS-rBG0znKuERnIsYqSnSC9g2Idu-_-gLjHkAa1aOL8oXoeriN28h_OMEo-2Tb9OXC_uR-c9MH5W668/pub?output=csv";

const FULL_NAME_COLUMN = "Full Name";
const AFFILIATION_COLUMN = "Current Employer/Affiliation (e.g. Apple or HDSI)";
const TITLE_COLUMN = "Current Job Title";
const INTEREST_COLUMN =
  "Are you interested in mentorship, judging, or both?";

export interface TeamMember {
  id: string;
  name: string;
  title: string;
  affiliation: string;
  logoSrc?: string;
}

interface JudgesAndMentorsData {
  judges: TeamMember[];
  mentors: TeamMember[];
}

const normalizeCell = (value: string | undefined) => value?.trim() ?? "";

const logoMatchers: Array<{ terms: string[]; logoSrc: string }> = [
  { terms: ["netflix"], logoSrc: "/judges/netflix.png" },
  { terms: ["apple"], logoSrc: "/judges/apple.png" },
  { terms: ["amazon"], logoSrc: "/judges/amazon.png" },
  { terms: ["doordash", "door dash"], logoSrc: "/judges/doordash.png" },
  { terms: ["oracle"], logoSrc: "/judges/oracle.png" },
  { terms: ["sonos"], logoSrc: "/judges/sonos.png" },
  { terms: ["microsoft"], logoSrc: "/judges/microsoft.png" },
  { terms: ["hyundai"], logoSrc: "/judges/hyundai.png" },
  { terms: ["bill"], logoSrc: "/judges/bill.png" },
  { terms: ["google"], logoSrc: "/judges/google.png" },
  { terms: ["lyft"], logoSrc: "/judges/lyft.png" },
  { terms: ["nvidia"], logoSrc: "/judges/nvidia.png" },
  { terms: ["qualcomm"], logoSrc: "/judges/qualcomm.png" },
  { terms: ["capital"], logoSrc: "/judges/capital-one.png" },
  { terms: ["walmart"], logoSrc: "/judges/walmart.png" },

];

const resolveLogoSrc = (affiliation: string) => {
  const normalizedAffiliation = affiliation.toLowerCase();

  return logoMatchers.find(({ terms }) =>
    terms.some((term) => normalizedAffiliation.includes(term)),
  )?.logoSrc;
};

const toKey = (person: Omit<TeamMember, "id">) =>
  `${person.name.toLowerCase()}|${person.title.toLowerCase()}|${person.affiliation.toLowerCase()}`;

const parseCsv = (input: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const nextChar = input[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows.filter((parsedRow) => parsedRow.some((cell) => cell.trim() !== ""));
};

const includesJudging = (interest: string) => {
  const normalizedInterest = interest.toLowerCase();
  return normalizedInterest.includes("judg") || normalizedInterest.includes("both");
};

const includesMentorship = (interest: string) => {
  const normalizedInterest = interest.toLowerCase();
  return normalizedInterest.includes("mentor") || normalizedInterest.includes("both");
};

const parseRoster = (csvText: string): JudgesAndMentorsData => {
  const rows = parseCsv(csvText);

  if (rows.length === 0) {
    return { judges: [], mentors: [] };
  }

  const [headerRow, ...dataRows] = rows;
  const columnIndexes = new Map(
    headerRow.map((header, index) => [normalizeCell(header), index]),
  );

  const judges = new Map<string, TeamMember>();
  const mentors = new Map<string, TeamMember>();

  for (const dataRow of dataRows) {
    const name = normalizeCell(dataRow[columnIndexes.get(FULL_NAME_COLUMN) ?? -1]);
    const affiliation = normalizeCell(
      dataRow[columnIndexes.get(AFFILIATION_COLUMN) ?? -1],
    );
    const title = normalizeCell(dataRow[columnIndexes.get(TITLE_COLUMN) ?? -1]);
    const interest = normalizeCell(
      dataRow[columnIndexes.get(INTEREST_COLUMN) ?? -1],
    );

    if (!name || !affiliation || !title || !interest) {
      continue;
    }

    const personBase = {
      name,
      title,
      affiliation,
      logoSrc: resolveLogoSrc(affiliation),
    };
    const id = toKey(personBase);
    const person: TeamMember = { id, ...personBase };

    if (includesJudging(interest)) {
      judges.set(id, person);
    }

    if (includesMentorship(interest)) {
      mentors.set(id, person);
    }
  }

  return {
    judges: Array.from(judges.values()),
    mentors: Array.from(mentors.values()),
  };
};

const fetchJudgesAndMentors = async (): Promise<JudgesAndMentorsData> => {
  const response = await fetch(SHEET_CSV_URL, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load roster (${response.status})`);
  }

  const csvText = await response.text();
  return parseRoster(csvText);
};

export const useJudgesAndMentors = () =>
  useQuery({
    queryKey: ["judges-and-mentors"],
    queryFn: fetchJudgesAndMentors,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
  });
