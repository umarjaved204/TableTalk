// The Appearance dialog. The choices are native radio buttons in a fieldset,
// so the browser already provides arrow-key movement and screen-reader
// announcements ("Programme, radio button, 5 of 8, selected"). This script
// only opens/closes the dialog and applies the chosen theme.

interface ThemeApi {
  current(): string;
  choose(choice: string): void;
}
declare global {
  interface Window {
    tabletalkTheme?: ThemeApi;
  }
}

const dialog = document.querySelector<HTMLDialogElement>("#appearance");
const opener = document.querySelector<HTMLButtonElement>("[data-open-appearance]");

if (dialog && opener) {
  const radios = dialog.querySelectorAll<HTMLInputElement>('input[name="theme"]');

  opener.addEventListener("click", () => {
    const current = window.tabletalkTheme?.current() ?? "system";
    radios.forEach((radio) => (radio.checked = radio.value === current));
    // Older browsers without showModal() (see README.md, browser support): shown in place.
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  });

  dialog.addEventListener("change", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.name === "theme") {
      window.tabletalkTheme?.choose(target.value);
    }
  });

  dialog.querySelector("[data-close]")?.addEventListener("click", () => {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  });
  // Clicking the backdrop (outside the panel) closes it too.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

export {};
