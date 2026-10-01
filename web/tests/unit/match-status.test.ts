import { describe, expect, it } from "vitest";
import type { MatchStatus } from "../../src/data/models.ts";
import { earlierVoidedNote, labelText, statusLabel } from "../../src/format/match-status.ts";

// Times written as "<utc>" so the wording itself is what's checked.
const text = (status: MatchStatus) => {
  const label = statusLabel(status);
  return `${label.badge} | ${labelText(label.parts, (utc) => `<${utc}>`)}`;
};

describe("the words for each match status", () => {
  it.each<[string, MatchStatus, string]>([
    [
      "upcoming",
      { kind: "upcoming", predictedAt: "P", fixtureStatus: "TIMED" },
      "Upcoming | Prediction as of <P> · locks at kick-off",
    ],
    [
      "locked",
      { kind: "locked", predictedAt: "P" },
      "Locked | Prediction made <P> · locked at kick-off · awaiting result",
    ],
    [
      "played",
      { kind: "played", predictedAt: "P", score: { home: 2, away: 1 } },
      "Full time | Prediction made <P>",
    ],
    [
      "voided (postponed)",
      { kind: "voided", predictedAt: "P", reason: "postponed" },
      "Postponed | Postponed · this prediction won't be scored",
    ],
    [
      "voided (removed)",
      { kind: "voided", predictedAt: "P", reason: "removed from the fixture list" },
      "Removed from the fixture list | Removed from the fixture list · this prediction won't be scored",
    ],
    [
      "invalid",
      { kind: "invalid", predictedAt: "P", actualKickoffUtc: "K" },
      "Not counted | Not counted: this prediction was made after the match actually kicked off (<K>), so it is never scored.",
    ],
    [
      "missed",
      { kind: "missed" },
      "Not counted | Not counted: no prediction was made before kick-off, so there is nothing to score.",
    ],
    [
      "kicked off, prediction made before",
      { kind: "kicked_off", predictedAt: "P", predictedBeforeKickoff: true },
      "Kicked off | Kicked off · the prediction shown was made before kick-off and will be recorded as locked in the next nightly update",
    ],
  ])("%s", (_name, status, expected) => {
    expect(text(status)).toBe(expected);
  });

  it("an upcoming match the fixture source lists as postponed says so", () => {
    expect(statusLabel({ kind: "upcoming", predictedAt: "P", fixtureStatus: "POSTPONED" }).badge).toBe(
      "Postponed",
    );
  });

  it("the note for an earlier voided prediction", () => {
    const note = earlierVoidedNote({ predictedAt: "P", reason: "postponed" });
    expect(labelText(note, (utc) => `<${utc}>`)).toBe(
      "An earlier prediction (made <P>) was voided: postponed. It won't be scored.",
    );
  });
});
