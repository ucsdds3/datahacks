/**
 * One CSV cell: quoted when it holds a comma, quote or line break, with quotes
 * doubled. Text an applicant typed that starts like a spreadsheet formula
 * (= + - @, tab, CR) gets a leading ' so Excel or Sheets shows it instead of
 * running it ("=HYPERLINK(...)" as a name). Numbers are left alone.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = Array.isArray(value) ? value.join("; ") : String(value);
  if (typeof value !== "number" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map(row => row.map(csvCell).join(",")).join("\r\n");
}

/** e.g. dh-hackers-accepted-2026-10-22.csv */
export function csvFilename(table: string, tab: string, date = new Date()): string {
  const day = date.toISOString().slice(0, 10);
  return `dh-${table}-${tab}-${day}.csv`;
}

export function downloadCsv(filename: string, rows: unknown[][]) {
  // The BOM makes Excel read the file as UTF-8, so accented names survive.
  const blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
