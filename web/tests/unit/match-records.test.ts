import { describe, expect, it } from "vitest";
import { DataError } from "../../src/data/load.ts";
import { replayLockLog, type ScoredMatch } from "../../src/data/match-records.ts";
import type { LogLine } from "../../src/data/track-record.ts";
import { illustratedLogLines, illustratedSummary } from "../fixtures/illustrated.ts";

const lines = illustratedLogLines() as unknown as LogLine[];
const scored = illustratedSummary()["matches"] as ScoredMatch[];

function lock(matchId: string, attempt: number, extra: Record<string, unknown> = {}): LogLine {
  return {
    event: "lock",
    lock_id: `${matchId}#${attempt}`,
    match_id: matchId,
    competition: "premier_league",
    home_team: "A",
    away_team: "B",
    listed_kickoff_utc: "2026-10-10T14:00:00Z",
    predicted_at: `2026-10-0${attempt}T04:40:00Z`,
    probabilities: { home: 0.5, draw: 0.3, away: 0.2 },
    ...extra,
  } as LogLine;
}

describe("status from replaying the lock log (illustrated events)", () => {
  const records = replayLockLog(lines, scored);
  const kind = (id: string) => records.get(id)?.state.kind;

  it("gives every match its current status", () => {
    expect(kind("fdorg:900001")).toBe("played");
    expect(kind("fdorg:900002")).toBe("played");
    expect(kind("fdorg:900003")).toBe("locked");
    expect(kind("fdorg:900005")).toBe("invalid");
    expect(kind("fdorg:900006")).toBe("missed");
    expect(kind("fdorg:560601")).toBe("voided");
  });

  it("a postponed match that was re-locked shows the current lock, with the voided one as a note", () => {
    const hull = records.get("fdorg:900004")!;
    expect(hull.state.kind).toBe("locked");
    if (hull.state.kind === "locked") expect(hull.state.lock.lock_id).toBe("fdorg:900004#2");
    expect(hull.earlierVoided).toEqual([
      { lockId: "fdorg:900004#1", predictedAt: "2026-09-13T04:40:31Z", reason: "postponed" },
    ]);
  });

  it("played: score and predicted_at come from summary.json", () => {
    const chelsea = records.get("fdorg:900001")!.state;
    expect(chelsea).toMatchObject({
      kind: "played",
      score: { home: 2, away: 1 },
      predictedAt: "2026-09-20T04:41:07Z",
    });
  });

  it("invalid keeps the actual kick-off from the log", () => {
    expect(records.get("fdorg:900005")!.state).toMatchObject({
      kind: "invalid",
      actualKickoffUtc: "2026-09-14T16:30:00Z",
    });
  });
});

describe("unusual but valid sequences", () => {
  it("a suspended match: invalid, then void on the same lock -> voided", () => {
    const records = replayLockLog(
      [
        lock("m", 1),
        { event: "invalid", lock_id: "m#1", actual_kickoff_utc: "2026-10-10T13:30:00Z" },
        { event: "void", lock_id: "m#1", reason: "suspended" },
      ],
      [],
    );
    expect(records.get("m")!.state).toMatchObject({ kind: "voided", reason: "suspended" });
  });

  it("postponed twice: both voided locks are kept as notes, oldest first", () => {
    const records = replayLockLog(
      [
        lock("m", 1),
        { event: "void", lock_id: "m#1", reason: "postponed" },
        lock("m", 2),
        { event: "void", lock_id: "m#2", reason: "postponed" },
        lock("m", 3),
      ],
      [],
    );
    expect(records.get("m")!.earlierVoided.map((v) => v.lockId)).toEqual(["m#1", "m#2"]);
  });

  it("postponed, then the replay was missed", () => {
    const records = replayLockLog(
      [
        lock("m", 1),
        { event: "void", lock_id: "m#1", reason: "postponed" },
        { event: "missed", match_id: "m", competition: "premier_league", home_team: "A", away_team: "B" },
      ],
      [],
    );
    expect(records.get("m")!.state.kind).toBe("missed");
    expect(records.get("m")!.earlierVoided).toHaveLength(1);
  });
});

describe("files that contradict each other stop the build", () => {
  it("a void for a lock that doesn't exist", () => {
    expect(() => replayLockLog([{ event: "void", lock_id: "x#1", reason: "postponed" }], [])).toThrow(
      DataError,
    );
  });

  it("a second lock without the first being voided", () => {
    expect(() => replayLockLog([lock("m", 1), lock("m", 2)], [])).toThrow(/never voided/);
  });

  it("summary.json scores a lock the log doesn't have open", () => {
    const voided: LogLine[] = [lock("m", 1), { event: "void", lock_id: "m#1", reason: "postponed" }];
    const score = {
      lock_id: "m#1",
      kickoff_utc: null,
      predicted_at: "2026-10-01T04:40:00Z",
      home_goals: 1,
      away_goals: 0,
    };
    expect(() => replayLockLog(voided, [score])).toThrow(/no open lock/);
    expect(() => replayLockLog([], [score])).toThrow(DataError);
  });
});
