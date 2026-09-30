// Runs inline at the very start of <body>, before anything is painted, so
// there is never a flash of the wrong theme. It is the ONLY place that turns
// the visitor's choice into a concrete theme; the picker calls
// window.tabletalkTheme.choose().
//
// The two placeholders below are filled in from src/themes.ts at build time
// (src/scripts/theme-script.ts), so the list of themes has one source.
(function () {
  var THEMES = __THEME_IDS__;
  var KEY = __STORAGE_KEY__;
  var root = document.documentElement;

  function query(q) {
    return window.matchMedia ? window.matchMedia(q) : null;
  }
  var dark = query("(prefers-color-scheme: dark)");
  var moreContrast = query("(prefers-contrast: more)");

  function saved() {
    try {
      var value = localStorage.getItem(KEY);
      return THEMES.indexOf(value) === -1 ? "system" : value;
    } catch {
      return "system"; // storage blocked: behave as a first visit
    }
  }

  function resolve(choice) {
    if (choice !== "system") return choice;
    if (moreContrast && moreContrast.matches) return "contrast";
    return dark && dark.matches ? "floodlights" : "matchday";
  }

  function apply(choice) {
    root.setAttribute("data-theme", resolve(choice));
    root.setAttribute("data-theme-choice", choice);
  }

  window.tabletalkTheme = {
    current: saved,
    choose: function (choice) {
      if (choice !== "system" && THEMES.indexOf(choice) === -1) return;
      try {
        if (choice === "system") localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, choice);
      } catch {
        // Not remembered (private window or blocked storage), but still applied.
      }
      apply(choice);
    },
  };

  // While on System, follow the device if its setting changes.
  function follow() {
    if (root.getAttribute("data-theme-choice") === "system") apply("system");
  }
  if (dark && dark.addEventListener) dark.addEventListener("change", follow);
  if (moreContrast && moreContrast.addEventListener) moreContrast.addEventListener("change", follow);

  apply(saved());
})();
