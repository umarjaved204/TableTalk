import { describe, expect, it } from "vitest";
import {
  formatAge,
  formatClock,
  formatDateTime,
  formatDayHeading,
  formatShortDate,
  isStale,
  localDateKey,
  timeZoneLabel,
} from "../../src/format/time.ts";

describe("kick-off times in the visitor's time zone", () => {
  const kickoff = "2026-10-10T11:30:00Z"; // Arsenal v Leeds

  it("converts UTC to UK summer time (BST, UTC+1)", () => {
    expect(formatClock(kickoff, "Europe/London")).toBe("12:30");
  });

  it("converts UTC to other zones", () => {
    expect(formatClock(kickoff, "UTC")).toBe("11:30");
    expect(formatClock(kickoff, "America/New_York")).toBe("07:30");
    expect(formatClock(kickoff, "Asia/Kolkata")).toBe("17:00"); // half-hour offset
  });

  it("follows the clock change (UK back to GMT on 25 Oct 2026)", () => {
    expect(formatClock("2026-10-24T14:00:00Z", "Europe/London")).toBe("15:00");
    expect(formatClock("2026-10-31T15:00:00Z", "Europe/London")).toBe("15:00");
  });

  it("names the zone", () => {
    expect(timeZoneLabel("Europe/London", new Date(kickoff))).toBe("BST");
    expect(timeZoneLabel("UTC", new Date(kickoff))).toBe("UTC");
  });
});

describe("grouping by the visitor's local date", () => {
  it("moves a late UTC kick-off to the next day in Asia", () => {
    const late = "2026-10-10T19:00:00Z";
    expect(localDateKey(late, "Europe/London")).toBe("2026-10-10");
    expect(localDateKey(late, "Asia/Tokyo")).toBe("2026-10-11");
  });

  it("a 23:30 UTC kick-off is the next morning in Asia, and still the same day in London", () => {
    const late = "2026-10-24T23:30:00Z";
    expect(localDateKey(late, "UTC")).toBe("2026-10-24");
    expect(localDateKey(late, "Europe/London")).toBe("2026-10-25"); // 00:30 BST
    expect(localDateKey(late, "Asia/Singapore")).toBe("2026-10-25");
    expect(formatClock(late, "Asia/Singapore")).toBe("07:30");
    expect(localDateKey(late, "Asia/Kolkata")).toBe("2026-10-25"); // 05:00, half-hour offset
    // A week later the UK is back on GMT (UTC+0), so the same time is the same day.
    expect(localDateKey("2026-10-31T23:30:00Z", "Europe/London")).toBe("2026-10-31");
  });

  it("moves an early UTC kick-off to the previous day in the Americas", () => {
    expect(localDateKey("2026-10-11T02:00:00Z", "America/Los_Angeles")).toBe("2026-10-10");
  });
});

describe("plain dates are never shifted by a time zone", () => {
  it("formats listed dates as they are", () => {
    expect(formatDayHeading("2026-10-10")).toBe("Sat 10 October");
    expect(formatShortDate("2026-09-20")).toMatch(/^20 Sept?$/);
  });

  it("formats an instant with date and time", () => {
    expect(formatDateTime("2026-09-29T17:56:40Z", "Europe/London")).toMatch(/^29 Sept?, 18:56$/);
  });
});

describe("stale data: older than 30 hours", () => {
  const generated = "2026-09-29T04:40:00Z";
  it.each([
    ["2026-09-30T04:40:00Z", false], // 24 h: the next run is due, not missed
    ["2026-09-30T10:40:00Z", false], // exactly 30 h
    ["2026-09-30T10:41:00Z", true],
    ["2026-10-01T09:00:00Z", true],
  ])("at %s -> %s", (now, expected) => {
    expect(isStale(generated, new Date(now))).toBe(expected);
  });

  it("describes the age in words", () => {
    expect(formatAge(31)).toBe("31 hours ago");
    expect(formatAge(60)).toBe("2 days ago");
  });
});
