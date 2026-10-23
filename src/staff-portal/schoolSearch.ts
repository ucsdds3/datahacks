// Forgiving search for the school field: nicknames ("UCSD"), shorthand ("uc san
// diego" → University of California, San Diego), any word order, and a typo or
// two ("standford").

/** Whole-query nicknames → the school's name as it appears in the list. */
const NICKNAMES: Record<string, string[]> = {
  ucsd: ["University of California, San Diego"],
  ucla: ["University of California, Los Angeles"],
  ucb: ["University of California, Berkeley"],
  cal: ["University of California, Berkeley"],
  berkeley: ["University of California, Berkeley"],
  uci: ["University of California, Irvine"],
  ucsb: ["University of California, Santa Barbara"],
  ucsc: ["University of California, Santa Cruz"],
  ucd: ["University of California, Davis"],
  ucr: ["University of California, Riverside"],
  ucm: ["University of California, Merced"],
  ucsf: ["University of California, San Francisco"],
  sdsu: ["San Diego State University"],
  usd: ["University of San Diego"],
  csusm: ["California State University, San Marcos", "California State University San Marcos"],
  sjsu: ["San Jose State University"],
  sfsu: ["San Francisco State University"],
  csulb: ["California State University, Long Beach"],
  csuf: ["California State University, Fullerton"],
  csun: ["California State University, Northridge"],
  "cal poly": ["California Polytechnic State University, San Luis Obispo", "California Polytechnic State University, Pomona"],
  cpp: ["California Polytechnic State University, Pomona"],
  slo: ["California Polytechnic State University, San Luis Obispo"],
  usc: ["University of Southern California"],
  caltech: ["California Institute of Technology"],
  mit: ["Massachusetts Institute of Technology"],
  cmu: ["Carnegie Mellon University"],
  nyu: ["New York University"],
  gt: ["Georgia Institute of Technology"],
  "georgia tech": ["Georgia Institute of Technology"],
  gatech: ["Georgia Institute of Technology"],
  uiuc: ["University of Illinois at Urbana-Champaign", "University of Illinois Urbana-Champaign"],
  umich: ["University of Michigan"],
  uw: ["University of Washington"],
  ut: ["University of Texas at Austin"],
  "ut austin": ["University of Texas at Austin"],
  asu: ["Arizona State University"],
  upenn: ["University of Pennsylvania"],
  penn: ["University of Pennsylvania"],
  ubc: ["University of British Columbia"],
  uoft: ["University of Toronto"],
  "u of t": ["University of Toronto"],
  mcgill: ["McGill University"],
  waterloo: ["University of Waterloo"],
};

/** Shorthand inside a query, expanded before matching. */
const EXPANSIONS: [RegExp, string][] = [
  [/\buc\b/g, "university of california"],
  [/\bcal state\b/g, "california state university"],
  [/\bcsu\b/g, "california state university"],
  [/\bu of\b/g, "university of"],
  [/\buniv\b/g, "university"],
  [/\bst\b/g, "state"],
  [/\bcc\b/g, "community college"],
];

const STOPWORDS = new Set(["of", "the", "at", "and", "in", "a"]);

export const normalize = (text: string) =>
  text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ").trim();

const words = (text: string) => normalize(text).split(" ").filter(w => w && !STOPWORDS.has(w));

/** Edit distance, stopping early once it's clearly over the limit. */
function within(a: string, b: string, limit: number) {
  if (Math.abs(a.length - b.length) > limit) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, row[j]);
    }
    if (best > limit) return false;
    prev = row;
  }
  return prev[b.length] <= limit;
}

/** 0 = the word starts with the token, 1 = a near-miss typo, null = no match. */
function tokenScore(token: string, word: string): number | null {
  if (word.startsWith(token)) return 0;
  const limit = token.length >= 8 ? 2 : token.length >= 4 ? 1 : 0;
  if (limit && (within(token, word, limit) || within(token, word.slice(0, token.length), limit))) return 1;
  return null;
}

export type SchoolIndex = { name: string; words: string[] }[];

export const indexSchools = (names: string[]): SchoolIndex => names.map(name => ({ name, words: words(name) }));

/** Best matches first: nicknames, then names containing every word typed (in any order), fewest typos. */
export function searchSchools(index: SchoolIndex, query: string, limit = 60): string[] {
  const q = normalize(query);
  if (!q) return [];
  const pinned = NICKNAMES[q] ?? [];

  const variants = new Set([q]);
  let expanded = q;
  for (const [pattern, replacement] of EXPANSIONS) expanded = expanded.replace(pattern, replacement);
  variants.add(expanded);
  const tokenSets = [...variants].map(words).filter(t => t.length > 0);

  const scored: { name: string; score: number }[] = [];
  for (const school of index) {
    let best: number | null = null;
    for (const tokens of tokenSets) {
      let total = 0;
      for (const token of tokens) {
        let tokenBest: number | null = null;
        for (const word of school.words) {
          const s = tokenScore(token, word);
          if (s !== null && (tokenBest === null || s < tokenBest)) tokenBest = s;
          if (tokenBest === 0) break;
        }
        if (tokenBest === null) { total = -1; break; }
        total += tokenBest;
      }
      if (total >= 0) {
        // Prefer names that start with what was typed, then shorter names.
        const leading = school.words[0]?.startsWith(tokens[0]) ? 0 : 0.5;
        const score = total + leading + school.words.length / 100;
        if (best === null || score < best) best = score;
      }
    }
    if (best !== null) scored.push({ name: school.name, score: best });
  }

  scored.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  const names = index.map(s => s.name);
  const results = [...pinned.filter(p => names.includes(p)), ...scored.map(s => s.name)];
  return [...new Set(results)].slice(0, limit);
}
