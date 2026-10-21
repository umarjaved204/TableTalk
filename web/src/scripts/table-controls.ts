// The league table's Short/Full switch and chance picker.
//
// The HTML already shows the right default for the screen size (CSS: Short
// on phones, Full on wide screens) with the first zone's chance chosen, and
// CSS shows the controls (when the page has JavaScript) and hides the chance
// picker in the Full view. This script applies a remembered choice, ticks the
// view in force, and reacts to changes. Choices are remembered on this device only.

const KEY_VIEW = "tabletalk-table-view";
const KEY_ZONE = "tabletalk-table-chance";
const NARROW = window.matchMedia("(width < 900px)");

function recall(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function remember(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not remembered (storage blocked), still applied.
  }
}

for (const wrapper of document.querySelectorAll<HTMLElement>("[data-league-table]")) {
  const select = wrapper.querySelector<HTMLSelectElement>("select[data-chance]");
  const radios = [...wrapper.querySelectorAll<HTMLInputElement>("input[data-view]")];
  if (!select) continue;

  /** The view in force: an explicit choice, else the screen-size default. */
  const effectiveView = () => wrapper.dataset["view"] ?? (NARROW.matches ? "short" : "full");

  const showZone = (zoneId: string) => {
    for (const cell of wrapper.querySelectorAll<HTMLElement>(".chance")) {
      cell.classList.toggle("chosen", cell.dataset["zone"] === zoneId);
    }
  };

  const sync = () => {
    const view = effectiveView();
    radios.forEach((radio) => (radio.checked = radio.value === view));
  };

  // A remembered chance only applies if this league has that zone.
  const savedZone = recall(KEY_ZONE);
  if (savedZone && [...select.options].some((o) => o.value === savedZone)) {
    select.value = savedZone;
    showZone(savedZone);
  }
  const savedView = recall(KEY_VIEW);
  if (savedView === "short" || savedView === "full") wrapper.dataset["view"] = savedView;

  sync();

  wrapper.addEventListener("change", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && radios.includes(target)) {
      wrapper.dataset["view"] = target.value;
      remember(KEY_VIEW, target.value);
    } else if (target === select) {
      showZone(select.value);
      remember(KEY_ZONE, select.value);
    }
    sync();
  });
  NARROW.addEventListener("change", sync);
}

export {};
