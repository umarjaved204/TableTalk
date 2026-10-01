// Phone-width tabs for the league page (Table / Matches / Positions).
//
// Tabs are the one place the site needs ARIA: HTML has no tab element. So
// the roles are added by this script, and only while the screen is narrow.
// Without JavaScript, or on wide screens, the tab bar is hidden and every
// section is shown one after another, with its own heading. With JavaScript
// the tab bar is shown by CSS from the first paint (data-js, set by the
// theme script), so it never appears late and pushes the page down.

const NARROW = window.matchMedia("(width < 900px)");

for (const root of document.querySelectorAll<HTMLElement>("[data-tabs]")) {
  const list = root.querySelector<HTMLElement>("[data-tablist]");
  const tabs = [...root.querySelectorAll<HTMLButtonElement>("[data-tab]")];
  const panels = tabs.map((tab) => document.getElementById(tab.dataset["tab"] ?? ""));
  if (!list || panels.some((p) => p === null)) continue;

  let selected = Math.max(
    0,
    tabs.findIndex((tab) => `#${tab.dataset["tab"]}` === window.location.hash),
  );

  const render = (moveFocus: boolean) => {
    const narrow = NARROW.matches;
    list.hidden = !narrow;
    if (narrow) list.setAttribute("role", "tablist");
    else list.removeAttribute("role");
    tabs.forEach((tab, i) => {
      const panel = panels[i];
      if (!panel) return;
      const on = i === selected;
      if (narrow) {
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-selected", String(on));
        tab.setAttribute("aria-controls", panel.id);
        tab.tabIndex = on ? 0 : -1;
        panel.setAttribute("role", "tabpanel");
        panel.setAttribute("aria-labelledby", tab.id);
        panel.hidden = !on;
      } else {
        tab.removeAttribute("role");
        tab.removeAttribute("aria-selected");
        tab.removeAttribute("aria-controls");
        panel.removeAttribute("role");
        panel.removeAttribute("aria-labelledby");
        panel.hidden = false;
      }
    });
    if (moveFocus) tabs[selected]?.focus();
  };

  const select = (index: number, moveFocus: boolean) => {
    selected = (index + tabs.length) % tabs.length;
    render(moveFocus);
  };

  tabs.forEach((tab, i) => tab.addEventListener("click", () => select(i, false)));
  list.addEventListener("keydown", (event) => {
    const keys: Record<string, number> = {
      ArrowRight: selected + 1,
      ArrowLeft: selected - 1,
      Home: 0,
      End: tabs.length - 1,
    };
    const next = keys[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next, true);
  });
  NARROW.addEventListener("change", () => render(false));
  render(false);
  // From now on this script decides which section shows (see the pages' CSS:
  // until then, phones show only the first section, as this script will).
  root.setAttribute("data-tabs-ready", "");
}

export {};
