// DataHacks happens in San Diego, so every deadline and date an applicant sees is
// shown in Pacific time, whatever time zone their device is in. Without this,
// 11:59 PM Pacific on November 30 reads as "December 1" east of California.

export const EVENT_TIME_ZONE = "America/Los_Angeles";

/** "November 30, 2026" (or the parts `options` asks for), in Pacific time. */
export const formatPacificDate = (
  value: Date | string,
  options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" },
) => new Date(value).toLocaleDateString("en-US", { ...options, timeZone: EVENT_TIME_ZONE });
