// Everything that depends on the visitor's clock or time zone. The HTML is
// built in UTC (correct, and clearly labelled "UTC", without JavaScript);
// this script then:
//   1. rewrites times in the visitor's own time zone,
//   2. regroups match cards by the visitor's local date,
//   3. turns the "Updated" line into a warning if the data is stale,
//   4. marks matches that have kicked off since the page was built.
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

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const now = new Date();

// 1. Times
for (const el of document.querySelectorAll<HTMLTimeElement>("time[data-format]")) {
  const utc = el.dateTime;
  el.textContent =
    el.dataset["format"] === "clock" ? formatClock(utc, timeZone) : formatDateTime(utc, timeZone);
}
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
    const heading = document.createElement("h3");
    heading.className = "day-heading";
    heading.textContent = key === "unknown" ? "Date to be confirmed" : formatDayHeading(key);
    fragment.append(heading, ...group);
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

// 4. Matches that have kicked off since the page was built
for (const card of document.querySelectorAll<HTMLElement>("[data-match][data-kickoff]")) {
  const kickoff = card.dataset["kickoff"];
  if (!kickoff || new Date(kickoff) > now) continue;
  card.dataset["kickedOff"] = "true";
  const badge = card.querySelector<HTMLElement>("[data-status-badge]");
  const note = card.querySelector<HTMLElement>("[data-lock-note]");
  if (badge) badge.textContent = "Kicked off";
  if (note) note.textContent = "This prediction is locked in the next nightly update.";
}

export {};
