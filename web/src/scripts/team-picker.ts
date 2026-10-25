// The Your team dialog's picker: a row of league buttons, and each league's
// teams as native radio buttons in a <fieldset> with a <legend>. Native on
// purpose: Tab reaches the group in one stop, arrow keys move through the
// teams, and screen readers announce the league and "2 of 18" by themselves.
//
// Arrow keys check each radio as they move, so the picker never saves on its
// own: the dialog's Save button does (src/scripts/favourites.ts).
//
// Built the first time the dialog opens, from the early script's team list,
// so no page carries it. Only createElement and textContent: nothing is
// parsed as HTML, so the Content Security Policy and Trusted Types are
// unchanged. Its styles are in FavouritePicker.astro (:global, because
// elements made here don't get the component's scoped attribute).
//
// All 96 radios share one name, so exactly one team can be checked across
// the leagues. Leagues not shown are `hidden`, and Chromium leaves hidden
// radios out of both the arrow keys and the count ("2 of 18", checked on
// 25 Oct 2026 through Windows UI Automation).

import { byName } from "./team-picker-core.ts";

export type TeamList = [string, string, [string, string][]][];

export interface Picker {
  /** Show one league's teams and press its button. */
  showLeague(id: string): void;
  /** Check this team's radio (or none, for null). */
  check(slug: string | null): void;
  /** The checked radio, if any. */
  checked(): HTMLInputElement | null;
  /** Focus the checked team, or the first one shown. */
  focusTeams(): void;
}

function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = "",
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

/** Builds the picker into `host`. `onChange` runs when a team is checked. */
export function buildPicker(host: HTMLElement, teams: TeamList, onChange: () => void): Picker {
  const row = make("div", "leagues");
  row.setAttribute("role", "group");
  row.setAttribute("aria-label", "League");
  const groups = make("div", "team-groups");
  const buttons = new Map<string, HTMLButtonElement>();
  const sets = new Map<string, HTMLFieldSetElement>();

  for (const [id, name, list] of teams) {
    const button = make("button", "league", name);
    button.type = "button";
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => showLeague(id));
    buttons.set(id, button);
    row.append(button);

    const set = make("fieldset", "league-teams");
    set.hidden = true;
    const grid = make("div", "grid");
    for (const [slug, teamName] of byName(list)) {
      const tile = make("label", "team");
      const radio = make("input");
      radio.type = "radio";
      radio.name = "favourite-team";
      radio.value = slug;
      tile.append(radio, make("span", "", teamName));
      grid.append(tile);
    }
    // The legend names the group for screen readers; it is hidden from view
    // because the pressed league button already says it.
    set.append(make("legend", "visually-hidden", name), grid);
    sets.set(id, set);
    groups.append(set);
  }
  groups.addEventListener("change", onChange);
  host.append(row, groups);

  const radios = () => host.querySelectorAll<HTMLInputElement>('input[name="favourite-team"]');

  function showLeague(id: string): void {
    for (const [key, set] of sets) set.hidden = key !== id;
    for (const [key, button] of buttons) button.setAttribute("aria-pressed", String(key === id));
  }

  return {
    showLeague,
    check(slug) {
      for (const radio of radios()) radio.checked = radio.value === slug;
    },
    checked: () => host.querySelector<HTMLInputElement>('input[name="favourite-team"]:checked'),
    focusTeams() {
      const shown = [...radios()].filter((r) => !r.closest("fieldset")?.hidden);
      (shown.find((r) => r.checked) ?? shown[0])?.focus();
    },
  };
}
