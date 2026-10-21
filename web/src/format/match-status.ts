// The words for each match status. Kept in one place, and used both at build
// time (MatchCard.astro) and in the browser (local-times.ts, for a match that
// kicks off after the page was built), so the two can't drift apart.
//
// A label is a list of parts: plain text, or a time to show as a <time>
// element (so the browser can rewrite it in the visitor's time zone).
import type { MatchStatus } from "../data/models.ts";

export type LabelPart = string | { time: string };

export interface StatusLabel {
  /** The short badge, e.g. "Locked". */
  badge: string;
  /** The status line next to it. */
  parts: LabelPart[];
}

/** Why a prediction was voided, as the badge and the start of the line. */
const VOID_REASONS: Record<string, string> = {
  postponed: "Postponed",
  suspended: "Suspended",
  cancelled: "Cancelled",
  "removed from the fixture list": "Removed from the fixture list",
};

/** A map's own entry for a key from the data (never Object's built-ins, such as "constructor"). */
function own(map: Record<string, string>, key: string): string | undefined {
  return Object.hasOwn(map, key) ? map[key] : undefined;
}

export function voidReason(reason: string): string {
  return own(VOID_REASONS, reason) ?? reason.charAt(0).toUpperCase() + reason.slice(1);
}

/** The fixture source's status for a match still to play, in words. */
const FIXTURE_STATUS: Record<string, string> = {
  POSTPONED: "Postponed",
  SUSPENDED: "Suspended",
  CANCELLED: "Cancelled",
  IN_PLAY: "In play",
  PAUSED: "In play",
};

/**
 * Fixture statuses for a match that is off the schedule: it won't kick off
 * at its listed time, so it is never shown as "kicked off" (at build time or
 * in the browser), even once that time has passed, and nothing locks until
 * it is rescheduled. (A cancelled match can stay in `upcoming_matches` with
 * its old kick-off: Rayo Vallecano v Athletic Bilbao, 10 Oct 2026.)
 */
export function isOffSchedule(fixtureStatus: string | null): boolean {
  return fixtureStatus === "POSTPONED" || fixtureStatus === "CANCELLED";
}

export const KICKED_OFF_BEFORE =
  "Kicked off · the prediction shown was made before kick-off and will be recorded as locked in the next nightly update";
export const KICKED_OFF_AFTER =
  "Kicked off · the prediction shown was made after the listed kick-off, so it won't be the one recorded. The locked prediction appears after the next nightly update";

export function statusLabel(status: MatchStatus): StatusLabel {
  switch (status.kind) {
    case "upcoming":
      return {
        badge: (status.fixtureStatus && own(FIXTURE_STATUS, status.fixtureStatus)) || "Upcoming",
        parts: [
          "Prediction as of ",
          { time: status.predictedAt },
          isOffSchedule(status.fixtureStatus)
            ? " · nothing locks until the match is rescheduled"
            : " · locks at kick-off",
        ],
      };
    case "kicked_off":
      return {
        badge: "Kicked off",
        parts: [status.predictedBeforeKickoff ? KICKED_OFF_BEFORE : KICKED_OFF_AFTER],
      };
    case "locked":
      return {
        badge: "Locked",
        parts: ["Prediction made ", { time: status.predictedAt }, " · locked at kick-off · awaiting result"],
      };
    case "played":
      return { badge: "Full time", parts: ["Prediction made ", { time: status.predictedAt }] };
    case "voided":
      return {
        badge: voidReason(status.reason),
        parts: [`${voidReason(status.reason)} · this prediction won't be scored`],
      };
    case "invalid":
      return {
        badge: "Not counted",
        parts: status.actualKickoffUtc
          ? [
              "Not counted: this prediction was made after the match actually kicked off (",
              { time: status.actualKickoffUtc },
              "), so it is never scored.",
            ]
          : [
              "Not counted: this prediction was made after the match actually kicked off, so it is never scored.",
            ],
      };
    case "missed":
      return {
        badge: "Not counted",
        parts: ["Not counted: no prediction was made before kick-off, so there is nothing to score."],
      };
  }
}

/** The note under a match whose earlier prediction was voided (a postponed match). */
export function earlierVoidedNote(voided: { predictedAt: string; reason: string }): LabelPart[] {
  return [
    "An earlier prediction (made ",
    { time: voided.predictedAt },
    `) was voided: ${voidReason(voided.reason).toLowerCase()}. It won't be scored.`,
  ];
}

/** A label as plain text, with times written by `formatTime` (used in tests). */
export function labelText(parts: LabelPart[], formatTime: (utc: string) => string): string {
  return parts.map((part) => (typeof part === "string" ? part : formatTime(part.time))).join("");
}
