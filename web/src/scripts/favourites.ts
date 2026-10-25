// The favourite team's controls, on every page: the "Your team" dialog, the
// buttons in the pre-built blocks (prompt, "no longer covered"), the team
// page's "Make this my team", and the matches page's "Your team only" filter.
//
// The state itself lives in the early script (window.tabletalkFavourite,
// src/scripts/favourite-head.js): it stores the choice, sets the attributes
// on <html> and refills the pre-built blocks. This file only turns clicks
// into calls and says what happened.
//
// Every button is a real <button> with data-fav-action, handled by one
// listener on the document, so buttons inside copied-in blocks work too.

import { LEAGUES } from "../data/leagues.ts";
import { openingLeague } from "./team-picker-core.ts";
import { buildPicker, type Picker } from "./team-picker.ts";

interface Current {
  state: "none" | "dismissed" | "newer" | "chosen" | "paused" | "gone";
  team?: string;
  name?: string | null;
  league?: string | null;
}
interface FavouriteApi {
  teams(): [string, string, [string, string][]][];
  current(): Current;
  storageWorks(): boolean;
  choose(slug: string): boolean;
  remove(): void;
  dismiss(): void;
}
declare global {
  interface Window {
    tabletalkFavourite?: FavouriteApi;
  }
}

const api = window.tabletalkFavourite;
const dialog = document.querySelector<HTMLDialogElement>("#favourite");
const opener = document.querySelector<HTMLButtonElement>("[data-open-favourite]");
const pageStatus = document.querySelector<HTMLElement>("[data-fav-status]");
/** The team page's shown "Saved. …" line under Make this my team. */
const madeStatus = document.querySelector<HTMLElement>("[data-make-status]");

/** Put a message in a live region. Cleared first, so the same words twice are announced twice. */
function announce(region: HTMLElement | null, message: string): void {
  if (!region) return;
  region.textContent = "";
  window.setTimeout(() => (region.textContent = message), 50);
}

function savedMessage(name: string): string {
  return api?.storageWorks()
    ? `Saved. ${name} is your team on this device.`
    : `${name} is your team until you close this page. This browser isn't letting the site remember it.`;
}

/** The dialog's picker: built the first time the dialog opens (team-picker.ts). */
let picker: Picker | null = null;
const dialogStatus = dialog?.querySelector<HTMLElement>("[data-fav-dialog-status]") ?? null;

/** The footer's "Selected: Arsenal", so it's clear what Save will save even
 *  when the checked team is in a league that isn't shown. */
function updateSelected(): void {
  const line = dialog?.querySelector<HTMLElement>("[data-picker-selected]");
  if (!line) return;
  const name = picker?.checked()?.nextElementSibling?.textContent;
  if (!name) {
    line.textContent = "No team selected";
    return;
  }
  const strong = document.createElement("b");
  strong.textContent = name;
  line.replaceChildren("Selected: ", strong);
}

/** Puts the dialog in step with the saved favourite: its team checked, the
 *  storage warning, the link to its page. */
function refreshDialog(): void {
  if (!dialog || !api) return;
  const current = api.current();
  const host = dialog.querySelector<HTMLElement>("[data-picker]");
  if (host && !picker) picker = buildPicker(host, api.teams(), updateSelected);
  picker?.check(current.state === "chosen" && current.team ? current.team : null);
  updateSelected();
  const warning = dialog.querySelector<HTMLElement>("[data-storage-warning]");
  if (warning) warning.hidden = api.storageWorks();
  if (current.state !== "chosen" || !current.team) return;
  const page = dialog.querySelector<HTMLAnchorElement>("[data-team-page-link]");
  const league = LEAGUES.find((l) => l.id === current.league);
  if (page && league) page.href = `/${league.slug}/${current.team}/`;
}

/** Where focus was when the dialog opened (the browser returns it there). */
let returnTo: Element | null = null;

/** Opens the dialog on a league: `asked`, else the page's, else the favourite's
 *  (openingLeague in team-picker-core.ts). */
function openDialog(asked: string | null = null): void {
  if (!dialog || !api) return;
  returnTo = document.activeElement;
  refreshDialog();
  const ids = new Set(api.teams().map(([id]) => id));
  const league = openingLeague(
    asked,
    location.pathname,
    api.current().league ?? null,
    LEAGUES.filter((l) => ids.has(l.id)),
  );
  if (league) picker?.showLeague(league);
  if (dialogStatus) dialogStatus.textContent = "";
  // A browser without showModal() (older than the support policy in
  // README.md) gets the dialog shown in place, without the backdrop.
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  // Tiles can only be measured once the dialog is shown. It opens at the top.
  dialog.scrollTop = 0;
  const body = dialog.querySelector<HTMLElement>(".body");
  if (body) body.scrollTop = 0;
  picker?.fit();
  pinFooter();
}

/**
 * Normally only the middle of the dialog scrolls, with the footer (Selected,
 * Save, Remove) pinned below it. With large text or a short window the head
 * and footer can leave no room for the teams (at 200% text on a 360 x 740
 * phone, the league buttons filled the middle and no team showed), so the
 * whole dialog scrolls instead, with the footer after the teams.
 *
 * The rule is the point of it: unpin when, with the footer pinned, not one
 * team tile would be wholly visible at the top of the middle. Measured, not a
 * container query in em: browser zoom shrinks the window's height in CSS
 * pixels without changing the em, so at 400% zoom (320 x 256) an em-width
 * query wouldn't fire while the pinned parts filled the dialog. Measured
 * again on resize.
 */
function pinFooter(): void {
  if (!dialog?.open) return;
  const body = dialog.querySelector<HTMLElement>(".body");
  const first = dialog.querySelector<HTMLElement>("fieldset:not([hidden]) .team:not([hidden])");
  if (!body || !first) return;
  dialog.classList.remove("unpinned");
  // Where the first tile ends, from the top of the middle's content.
  const end = first.getBoundingClientRect().bottom - body.getBoundingClientRect().top + body.scrollTop;
  dialog.classList.toggle("unpinned", end > body.clientHeight);
}
window.addEventListener("resize", pinFooter);

/** After a block is replaced (the button that was clicked is gone), keep the
 *  keyboard user in a sensible place instead of at the top of the page. */
function focusAfterChange(preferred: Element | null): void {
  const target = preferred instanceof HTMLElement ? preferred : document.querySelector<HTMLElement>("#main");
  if (!target) return;
  if (!target.hasAttribute("tabindex") && !(target instanceof HTMLButtonElement)) target.tabIndex = -1;
  target.focus();
}

/** Save: the checked team becomes the favourite. The dialog stays open and
 *  says what happened. */
function saveFromPicker(): void {
  if (!api) return;
  const radio = picker?.checked();
  if (!radio) {
    announce(dialogStatus, "Choose a team first.");
    picker?.focusTeams();
    return;
  }
  if (!api.choose(radio.value)) return;
  announce(dialogStatus, savedMessage(api.current().name ?? "Your team"));
  refreshDialog();
}

/** The team page's button: one tap makes this team the favourite. When it
 *  already is, the button reads "Your team · Change" and opens the dialog.
 *  The label swaps by itself (favouriteCss), and the button stays focused. */
function chooseThis(button: HTMLElement): void {
  if (!api) return;
  const slug = button.dataset["teamSlug"] ?? "";
  const before = api.current();
  if (before.state === "chosen" && before.team === slug) {
    openDialog(before.league ?? null);
    return;
  }
  if (!api.choose(slug)) return;
  const name = api.current().name ?? "This team";
  const instead = before.state === "chosen" && before.name ? `, instead of ${before.name}` : "";
  const message = api.storageWorks()
    ? `Saved. ${name} is your team on this device${instead}.`
    : `${name} is your team until you close this page${instead}. This browser isn't letting the site remember it.`;
  announce(pageStatus, message);
  // The same words, shown under the button straight away (in the same task
  // as the press, so the line it adds doesn't count as layout shift).
  if (madeStatus) madeStatus.textContent = message;
}

// The shown line describes one press; any other change (the dialog, Remove)
// clears it. choose() fires this event before chooseThis writes its line.
document.addEventListener("tabletalk:favourite", () => {
  if (madeStatus) madeStatus.textContent = "";
});

function handle(action: string, button: HTMLElement): void {
  if (!api) return;
  switch (action) {
    case "save-picker":
      saveFromPicker();
      break;
    case "open-picker":
      // The home page's prompt has a button per league; "Pick another team" has none.
      openDialog(button.dataset["league"] ?? null);
      break;
    case "choose-this":
      chooseThis(button);
      break;
    case "dismiss":
      api.dismiss();
      announce(pageStatus, "Hidden. You can pick a team any time with the Your team button.");
      focusAfterChange(opener);
      break;
    case "remove": {
      api.remove();
      const inDialog = dialog?.contains(button) ?? false;
      announce(inDialog ? dialogStatus : pageStatus, "Removed. No team is saved on this device.");
      if (inDialog) refreshDialog();
      else focusAfterChange(opener);
      break;
    }
  }
}

document.addEventListener("click", (event) => {
  const target =
    event.target instanceof Element ? event.target.closest<HTMLElement>("[data-fav-action]") : null;
  if (target?.dataset["favAction"]) handle(target.dataset["favAction"], target);
});

opener?.addEventListener("click", () => openDialog());
dialog?.querySelector("[data-close]")?.addEventListener("click", () => {
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
});
// Escape in the "Find a team" field clears what was typed first; only a
// second Escape closes the dialog (and loses nothing).
dialog?.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (event.target instanceof HTMLInputElement && event.target.type === "search" && picker?.clearFilter()) {
    event.preventDefault();
  }
});
// Clicking the backdrop (outside the panel) closes it too.
dialog?.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
// Saving from the home page's prompt replaces the prompt with the card, so the
// button that opened the dialog is gone: focus the card's heading instead of
// losing focus to the top of the page.
dialog?.addEventListener("close", () => {
  if (returnTo && !returnTo.isConnected) {
    focusAfterChange(document.querySelector(".your-team-slot [data-fav-target] h2"));
  }
  returnTo = null;
});

// ---------------------------------------------------------------------------
// Matches page: "Your team only".
// ---------------------------------------------------------------------------
const filter = document.querySelector<HTMLInputElement>("[data-fav-filter]");
const filterStatus = document.querySelector<HTMLElement>("[data-fav-filter-status]");

function applyFilter(): void {
  if (!filter || !api) return;
  const current = api.current();
  const team = current.state === "chosen" ? current.team : undefined;
  const only = filter.checked && team !== undefined;
  let shown = 0;
  const cards = document.querySelectorAll<HTMLElement>("[data-match]");
  for (const card of cards) {
    const plays = team !== undefined && (card.dataset["teams"] ?? "").split(" ").includes(team);
    card.hidden = only && !plays;
    if (!card.hidden) shown++;
  }
  announce(
    filterStatus,
    only
      ? `Showing ${shown} of ${cards.length} matches: ${current.name ?? "your team"} only.`
      : `Showing all ${cards.length} matches.`,
  );
}

filter?.addEventListener("change", applyFilter);
document.addEventListener("tabletalk:favourite", () => {
  // A different favourite (or none): start again from all matches.
  if (filter?.checked) {
    filter.checked = false;
    applyFilter();
  }
});

export {};
