// The favourite team's controls, on every page: the "Your team" dialog, the
// buttons in the pre-built blocks (prompt, personal-link question, "no
// longer covered"), copying the personal link, and the matches page's
// "Your team only" filter.
//
// The state itself lives in the early script (window.tabletalkFavourite,
// src/scripts/favourite-head.js): it stores the choice, sets the attributes
// on <html> and refills the pre-built blocks. This file only turns clicks
// into calls and says what happened.
//
// Every button is a real <button> with data-fav-action, handled by one
// listener on the document, so buttons inside copied-in blocks work too.

interface Current {
  state: "none" | "dismissed" | "newer" | "chosen" | "paused" | "gone";
  team?: string;
  name?: string | null;
  league?: string | null;
}
interface Offer {
  kind: "offer" | "replace" | "same" | "unknown";
  team?: string;
  name?: string;
}
interface FavouriteApi {
  teams(): [string, string, [string, string][]][];
  current(): Current;
  offer(): Offer | null;
  storageWorks(): boolean;
  choose(slug: string): boolean;
  remove(): void;
  dismiss(): void;
  acceptOffer(): boolean;
  declineOffer(): void;
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

/** The dialog's select: filled once, from the same list as the early script. */
function fillTeamOptions(select: HTMLSelectElement): void {
  if (!api || select.dataset["filled"] === "yes") return;
  for (const [, leagueName, teams] of api.teams()) {
    const group = document.createElement("optgroup");
    group.label = leagueName;
    for (const [slug, name] of teams) group.append(new Option(name, slug));
    select.append(group);
  }
  select.dataset["filled"] = "yes";
}

/** The personal link for this site and team: location.origin, so it is right
 *  wherever the site is served (the QR image, made at build time, uses SITE_URL). */
function personalLink(slug: string): string {
  return `${location.origin}/?team=${encodeURIComponent(slug)}`;
}

function refreshDialog(): void {
  if (!dialog || !api) return;
  const current = api.current();
  const select = dialog.querySelector<HTMLSelectElement>("[data-fill-teams]");
  if (select) {
    fillTeamOptions(select);
    select.value = current.state === "chosen" && current.team ? current.team : "";
  }
  const warning = dialog.querySelector<HTMLElement>("[data-storage-warning]");
  if (warning) warning.hidden = api.storageWorks();
  if (current.state !== "chosen" || !current.team) return;
  const link = dialog.querySelector<HTMLElement>("[data-personal-link]");
  if (link) link.textContent = personalLink(current.team);
  const qr = dialog.querySelector<HTMLImageElement>("[data-qr-image]");
  if (qr) qr.src = `/qr/${current.team}.svg`;
}

function openDialog(): void {
  if (!dialog) return;
  refreshDialog();
  const status = dialog.querySelector<HTMLElement>("[data-fav-dialog-status]");
  if (status) status.textContent = "";
  // A browser without showModal() (older than the support policy in
  // README.md) gets the dialog shown in place, without the backdrop.
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

/** After a block is replaced (the button that was clicked is gone), keep the
 *  keyboard user in a sensible place instead of at the top of the page. */
function focusAfterChange(preferred: Element | null): void {
  const target = preferred instanceof HTMLElement ? preferred : document.querySelector<HTMLElement>("#main");
  if (!target) return;
  if (!target.hasAttribute("tabindex") && !(target instanceof HTMLButtonElement)) target.tabIndex = -1;
  target.focus();
}

async function copyLink(button: HTMLElement): Promise<void> {
  const code = dialog?.querySelector<HTMLElement>("[data-personal-link]");
  const status = dialog?.querySelector<HTMLElement>("[data-copy-status]") ?? null;
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code.textContent ?? "");
    announce(status, "Link copied.");
  } catch {
    // Clipboard refused (older browser, or permission): select the text instead.
    const range = document.createRange();
    range.selectNodeContents(code);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    announce(status, "The link is selected. Copy it with your device's copy command.");
  }
  button.focus();
}

function saveFromSelect(button: HTMLElement): void {
  if (!api) return;
  const select = document.getElementById(button.dataset["select"] ?? "");
  if (!(select instanceof HTMLSelectElement)) return;
  const inDialog = dialog?.contains(button) ?? false;
  const status = inDialog
    ? (dialog?.querySelector<HTMLElement>("[data-fav-dialog-status]") ?? null)
    : pageStatus;
  if (select.value === "") {
    if (inDialog && api.current().state === "chosen") {
      api.remove();
      announce(status, "Removed. No team is saved on this device.");
    } else {
      announce(status, "Choose a team first.");
      select.focus();
    }
    return;
  }
  if (!api.choose(select.value)) return;
  const name = api.current().name ?? "Your team";
  announce(status, savedMessage(name));
  if (inDialog) refreshDialog();
  else focusAfterChange(document.querySelector(".your-team-slot [data-fav-target] h2"));
}

function handle(action: string, button: HTMLElement): void {
  if (!api) return;
  switch (action) {
    case "save-select":
      saveFromSelect(button);
      break;
    case "open-picker":
      openDialog();
      break;
    case "dismiss":
      api.dismiss();
      announce(pageStatus, "Hidden. You can pick a team any time with the Your team button.");
      focusAfterChange(opener);
      break;
    case "remove": {
      api.remove();
      const inDialog = dialog?.contains(button) ?? false;
      announce(
        inDialog ? (dialog?.querySelector<HTMLElement>("[data-fav-dialog-status]") ?? null) : pageStatus,
        "Removed. No team is saved on this device.",
      );
      if (inDialog) refreshDialog();
      else focusAfterChange(opener);
      break;
    }
    case "accept-offer": {
      const offer = api.offer();
      if (api.acceptOffer() && offer?.name) announce(pageStatus, savedMessage(offer.name));
      focusAfterChange(null);
      break;
    }
    case "decline-offer":
      api.declineOffer();
      focusAfterChange(null);
      break;
    case "copy-link":
      void copyLink(button);
      break;
  }
}

document.addEventListener("click", (event) => {
  const target =
    event.target instanceof Element ? event.target.closest<HTMLElement>("[data-fav-action]") : null;
  if (target?.dataset["favAction"]) handle(target.dataset["favAction"], target);
});

opener?.addEventListener("click", openDialog);
dialog?.querySelector("[data-close]")?.addEventListener("click", () => {
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
});
// Clicking the backdrop (outside the panel) closes it too.
dialog?.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
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
