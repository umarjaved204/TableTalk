// Dates and times, all through the browser's Intl API. These functions run
// twice: at build time (with timeZone "UTC", so the HTML is correct without
// JavaScript) and in the visitor's browser (with their own time zone).
//
// Inputs follow the contract: instants are UTC "YYYY-MM-DDTHH:MM:SSZ";
// listed match dates and "results up to" are plain dates "YYYY-MM-DD" with
// no time zone, so they are shown as they are, never converted.

export const LOCALE = "en-GB";

/** A league's numbers are "stale" when its snapshot is older than this.
 *  Runs are daily (04:37 UTC, backup 07:37), so 30 hours means one was missed. */
export const STALE_AFTER_HOURS = 30;

// Creating an Intl.DateTimeFormat is slow (it loads locale and time zone
// data); using one is fast. A matches page formats over a hundred times, so
// each formatter is made once and reused (measured: this keeps the page's
// script well inside Lighthouse's blocking-time budget on a slow phone).
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${timeZone}|${JSON.stringify(options)}`;
  let made = formatters.get(key);
  if (!made) {
    made = new Intl.DateTimeFormat(LOCALE, { timeZone, ...options });
    formatters.set(key, made);
  }
  return made;
}

function parts(utc: string, timeZone: string, options: Intl.DateTimeFormatOptions) {
  return formatter(timeZone, options).formatToParts(new Date(utc));
}

function part(list: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return list.find((p) => p.type === type)?.value ?? "";
}

/** "12:30" (24-hour clock). */
export function formatClock(utc: string, timeZone: string): string {
  const p = parts(utc, timeZone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${part(p, "hour")}:${part(p, "minute")}`;
}

/** "29 Sep, 18:56". */
export function formatDateTime(utc: string, timeZone: string): string {
  const p = parts(utc, timeZone, { day: "numeric", month: "short" });
  return `${part(p, "day")} ${part(p, "month")}, ${formatClock(utc, timeZone)}`;
}

/** The calendar date of an instant in a time zone, as "YYYY-MM-DD" (for grouping). */
export function localDateKey(utc: string, timeZone: string): string {
  const p = parts(utc, timeZone, { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${part(p, "year")}-${part(p, "month")}-${part(p, "day")}`;
}

/** "Sat 10 October" for a plain date "YYYY-MM-DD" (no time zone conversion). */
export function formatDayHeading(date: string): string {
  const p = parts(`${date}T12:00:00Z`, "UTC", { weekday: "short", day: "numeric", month: "long" });
  return `${part(p, "weekday")} ${part(p, "day")} ${part(p, "month")}`;
}

/** "20 Sep" for a plain date "YYYY-MM-DD". */
export function formatShortDate(date: string): string {
  const p = parts(`${date}T12:00:00Z`, "UTC", { day: "numeric", month: "short" });
  return `${part(p, "day")} ${part(p, "month")}`;
}

/** Short name of the time zone at that instant, e.g. "BST", "UTC", "GMT+2". */
export function timeZoneLabel(timeZone: string, at: Date): string {
  const p = formatter(timeZone, { timeZoneName: "short" }).formatToParts(at);
  return part(p, "timeZoneName") || timeZone;
}

export function hoursSince(utc: string, now: Date): number {
  return (now.getTime() - new Date(utc).getTime()) / 3_600_000;
}

export function isStale(generatedAt: string, now: Date, thresholdHours = STALE_AFTER_HOURS): boolean {
  return hoursSince(generatedAt, now) > thresholdHours;
}

/** "31 hours ago", "2 days ago". */
export function formatAge(hours: number): string {
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  return hours < 48 ? rtf.format(-Math.round(hours), "hour") : rtf.format(-Math.floor(hours / 24), "day");
}
