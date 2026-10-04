// Everything that depends on the visitor's clock or time zone. The HTML is
// built in UTC (correct, and clearly labelled "UTC", without JavaScript);
// this script then:
//   1. rewrites times in the visitor's own time zone,
//   2. regroups match cards by the visitor's local date,
//   3. turns the "Updated" line into a warning if the data is stale,
//   4. marks upcoming matches that have kicked off since the page was built.
// Clock boxes have a fixed width and tabular figures, so nothing moves.
import {
  STALE_AFTER_HOURS,
  formatAge,
  formatClock,
  formatDateTime,
  formatDayHeading,
  hoursSince,
  localDateKey,
  timeZoneLabel,
} from "../format/time.ts";
import { labelText, statusLabel } from "../format/match-status.ts";

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const now = new Date();

// 1. Times. Run again when the favourite team changes: the home page's
// "Your team" card is copied in fresh, with its times in UTC.
function localTimes(): void {
  for (const el of document.querySelectorAll<HTMLTimeElement>("time[data-format]")) {
    const utc = el.dateTime;
    el.textContent =
      el.dataset["format"] === "clock" ? formatClock(utc, timeZone) : formatDateTime(utc, timeZone);
  }
}
localTimes();
document.addEventListener("tabletalk:favourite", localTimes);
for (const el of document.querySelectorAll<HTMLElement>("[data-tz-label]")) {
  el.textContent = `your time zone (${timeZoneLabel(timeZone, now)})`;
}

// 2. Regroup match cards by local date
for (const list of document.querySelectorAll<HTMLElement>("[data-match-list]")) {
  const cards = [...list.querySelectorAll<HTMLElement>("[data-match]")];
  const groups = new Map<string, HTMLElement[]>();
  for (const card of cards) {
    const kickoff = card.dataset["kickoff"];
    const key = kickoff ? localDateKey(kickoff, timeZone) : (card.dataset["date"] ?? "unknown");
    const group = groups.get(key) ?? [];
    group.push(card);
    groups.set(key, group);
  }
  const fragment = document.createDocumentFragment();
  for (const [key, group] of groups) {
    const day = document.createElement("div");
    day.className = "day";
    const heading = document.createElement(list.dataset["headingLevel"] === "4" ? "h4" : "h3");
    heading.className = "day-heading";
    heading.textContent = key === "unknown" ? "Date to be confirmed" : formatDayHeading(key);
    day.append(heading, ...group);
    fragment.append(day);
  }
  list.replaceChildren(fragment);
}

// 3. Stale data
for (const el of document.querySelectorAll<HTMLElement>("[data-generated]")) {
  const generated = el.dataset["generated"];
  if (!generated) continue;
  const age = hoursSince(generated, now);
  if (age > STALE_AFTER_HOURS) {
    el.dataset["stale"] = "true";
    const line = el.querySelector<HTMLElement>("[data-stale-message]");
    if (line) line.textContent = `Last updated ${formatAge(age)}: these numbers may be out of date.`;
  }
}

// 4. Upcoming matches that have kicked off since the page was built. The
//    nightly update hasn't locked them yet, so say what will happen. The
//    words come from the same file the build uses.
for (const card of document.querySelectorAll<HTMLElement>(
  '[data-match][data-status="upcoming"][data-kickoff]',
)) {
  const kickoff = card.dataset["kickoff"];
  const predictedAt = card.dataset["predictedAt"];
  if (!kickoff || !predictedAt || new Date(kickoff) > now) continue;
  const label = statusLabel({
    kind: "kicked_off",
    predictedAt,
    predictedBeforeKickoff: new Date(predictedAt) < new Date(kickoff),
  });
  card.dataset["status"] = "kicked_off";
  const badge = card.querySelector<HTMLElement>("[data-status-badge]");
  const line = card.querySelector<HTMLElement>("[data-status-line]");
  if (badge) badge.textContent = label.badge;
  if (line) line.textContent = labelText(label.parts, (utc) => formatDateTime(utc, timeZone));
}

export {};
