// The matches page: which matches go in Upcoming and Recent, and each one's status.
//
//   Upcoming = the snapshot's matches still to play, minus any the lock log
//              says have started (those move to Recent).
//   Recent   = every match in the lock log for this league: locked, played,
//              voided, invalid or missed. Matches played before recording
//              started, or never locked, are in no published file (contract
//              request R5), so they can't be shown yet.
//
// Both lists are limited to a window around the snapshot's time, so a page
// stays a sensible length all season (see UPCOMING_DAYS and RECENT_DAYS).
import { replayLockLog, type MatchRecord } from "./match-records.ts";
import type { MatchView, ReadyLeague, UpcomingMatch } from "./models.ts";
import { loadLockLog, loadSummary } from "./track-record.ts";

/** Upcoming shows matches up to this many days after the snapshot. */
export const UPCOMING_DAYS = 28;
/** Recent shows matches from this many days before the snapshot. */
export const RECENT_DAYS = 28;

const DAY_MS = 86_400_000;

export type RecordsResult =
  | { status: "ok"; records: Map<string, MatchRecord>; liveSince: string | null }
  | { status: "unavailable"; reason: "missing" | "unsupported" };

/** Read summary.json and the lock log, and replay it. A missing or newer-format
 *  summary means the track record can't be shown (Recent says so); the rest of
 *  the page still works. Contradictions between the two files stop the build. */
export function loadRecords(): RecordsResult {
  const summary = loadSummary();
  if (summary.status !== "ok") return { status: "unavailable", reason: summary.status };
  const lines = loadLockLog(summary.data);
  const records = replayLockLog(lines, summary.data.matches);
  return { status: "ok", records, liveSince: summary.data.live_since };
}

/** A match the log says has started is no longer "upcoming". A voided one
 *  (postponed) is upcoming again, with a note about the earlier prediction. */
function hasStarted(record: MatchRecord | undefined): boolean {
  return record !== undefined && record.state.kind !== "voided";
}

export function upcomingViews(
  league: ReadyLeague,
  records: Map<string, MatchRecord>,
  days = UPCOMING_DAYS,
): MatchView[] {
  const until = new Date(league.generatedAt).getTime() + days * DAY_MS;
  return league.upcoming
    .filter((m) => !hasStarted(m.id ? records.get(m.id) : undefined))
    .filter((m) => {
      const when = m.kickoffUtc ?? (m.date ? `${m.date}T00:00:00Z` : null);
      return when === null || new Date(when).getTime() <= until;
    })
    .map((m) => upcomingView(m, league.generatedAt, m.id ? records.get(m.id) : undefined));
}

export function upcomingView(match: UpcomingMatch, predictedAt: string, record?: MatchRecord): MatchView {
  // The snapshot can be made after a match's listed kick-off (a late run, or a
  // match still in progress). Its prediction is then not the one that counts.
  const pastKickoff = match.kickoffUtc !== null && predictedAt >= match.kickoffUtc;
  const earlierVoided = record ? allVoided(record) : [];
  return {
    key: match.id ?? `${match.home}-${match.away}-${match.date ?? ""}`,
    home: match.home,
    away: match.away,
    kickoffUtc: match.kickoffUtc,
    date: match.date,
    prediction: {
      probabilities: match.probabilities,
      expectedGoals: match.expectedGoals,
      likelyScorelines: match.likelyScorelines,
    },
    status: pastKickoff
      ? { kind: "kicked_off", predictedAt, predictedBeforeKickoff: false }
      : { kind: "upcoming", predictedAt, fixtureStatus: match.status },
    earlierVoided,
  };
}

/** Every voided prediction for a match, including the current one if it is voided. */
function allVoided(record: MatchRecord): MatchView["earlierVoided"] {
  const earlier = record.earlierVoided.map((v) => ({ predictedAt: v.predictedAt, reason: v.reason }));
  if (record.state.kind === "voided") {
    earlier.push({ predictedAt: record.state.lock.predicted_at, reason: record.state.reason });
  }
  return earlier;
}

/** The kick-off a recorded match is shown and grouped by. */
export function recordKickoff(record: MatchRecord): string | null {
  const state = record.state;
  switch (state.kind) {
    case "played":
      return state.kickoffUtc ?? state.lock.listed_kickoff_utc;
    case "invalid":
      return state.actualKickoffUtc ?? state.lock.listed_kickoff_utc;
    case "missed":
      return state.actualKickoffUtc;
    default:
      return state.lock.listed_kickoff_utc;
  }
}

export function recordView(record: MatchRecord): MatchView {
  const state = record.state;
  const base = {
    key: record.matchId,
    home: record.home,
    away: record.away,
    kickoffUtc: recordKickoff(record),
    date: null,
    earlierVoided: record.earlierVoided.map((v) => ({ predictedAt: v.predictedAt, reason: v.reason })),
  };
  if (state.kind === "missed") return { ...base, prediction: null, status: { kind: "missed" } };

  const lock = state.lock;
  const prediction = {
    probabilities: { ...lock.probabilities },
    expectedGoals: lock.expected_goals ? { ...lock.expected_goals } : null,
    likelyScorelines: (lock.likely_scorelines ?? []).map((s) => ({ ...s })),
  };
  // predicted_at always comes from the data (never from the kick-off time).
  switch (state.kind) {
    case "locked":
      return { ...base, prediction, status: { kind: "locked", predictedAt: lock.predicted_at } };
    case "played":
      return {
        ...base,
        prediction,
        status: { kind: "played", predictedAt: state.predictedAt, score: state.score },
      };
    case "voided":
      return {
        ...base,
        prediction,
        status: { kind: "voided", predictedAt: lock.predicted_at, reason: state.reason },
      };
    case "invalid":
      return {
        ...base,
        prediction,
        status: { kind: "invalid", predictedAt: lock.predicted_at, actualKickoffUtc: state.actualKickoffUtc },
      };
  }
}

/** This league's recorded matches from the last `days` days, newest first. */
export function recentViews(
  league: ReadyLeague,
  records: Map<string, MatchRecord>,
  days = RECENT_DAYS,
): MatchView[] {
  const from = new Date(league.generatedAt).getTime() - days * DAY_MS;
  return [...records.values()]
    .filter((r) => r.competition === league.league.id)
    .filter((r) => {
      const kickoff = recordKickoff(r);
      return kickoff === null || new Date(kickoff).getTime() >= from;
    })
    .map(recordView)
    .sort((a, b) => (b.kickoffUtc ?? "").localeCompare(a.kickoffUtc ?? "") || a.home.localeCompare(b.home));
}
