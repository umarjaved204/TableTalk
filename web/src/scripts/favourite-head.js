// The favourite team, applied before the page paints. Appended to the theme
// script (one inline script, one CSP hash) by src/scripts/theme-script.ts,
// after the functions from favourite-core.js. Placeholders filled at build time:
//   __TEAM_INDEX__  this build's team list (src/data/teams.ts headIndex)
//   __FAV_KEY__     the localStorage key
//
// It sets, on <html>:
//   data-fav="arsenal"               only for a team in this season's data
//   data-fav-league="premier_league" the favourite's league (also when paused)
//   data-fav-state="chosen"          none | dismissed | newer | chosen | paused | gone
//   data-fav-offer="offer"           a personal link is waiting: offer | replace | same | unknown
// CSS uses these to show the right home-page block from the first paint, and
// a constructed stylesheet with one rule for the favourite (favouriteCss in
// favourite-core.js) shows its star and tint. Page parts that differ per team
// are pre-built in <template> elements and copied in by fill() (see
// FavouriteSlot.astro).
(function () {
  var root = document.documentElement;
  var KEY = __FAV_KEY__;
  var DATA = __TEAM_INDEX__;
  var index = makeIndex(DATA);
  var storageWorks = true;

  function readRaw() {
    try {
      return localStorage.getItem(KEY);
    } catch {
      storageWorks = false;
      return null;
    }
  }

  var saved = parseStored(readRaw());
  var current = resolveFavourite(saved, index);
  var dismissed = saved.kind === "saved" && saved.dismissed;
  var offer = null;

  // A personal link: work out what to ask, then take ?team= out of the
  // address bar straight away (a reload, bookmark or screenshot won't carry it).
  var link = readLink(location.search);
  if (link !== null) {
    offer = linkOffer(link, current, index);
    try {
      history.replaceState(history.state, "", withoutTeamParam(location.href));
    } catch {
      // Not possible here (rare); the question is still asked.
    }
  }

  var slots = [];
  var leagueIds = (DATA.names || []).map(function (pair) {
    return pair[0];
  });

  // One stylesheet, made here and rewritten when the favourite changes. A
  // constructed stylesheet is CSSOM, not an inline <style>, so the Content
  // Security Policy allows it. Browsers without it (older than the support
  // policy) simply show no star or tint.
  var sheet = null;
  try {
    sheet = new CSSStyleSheet();
    document.adoptedStyleSheets = document.adoptedStyleSheets.concat([sheet]);
  } catch {
    sheet = null;
  }

  // Out-of-date numbers, decided now, before the first paint (staleCss).
  try {
    var staleSheet = new CSSStyleSheet();
    staleSheet.replaceSync(staleCss(DATA.updated, Date.now()));
    document.adoptedStyleSheets = document.adoptedStyleSheets.concat([staleSheet]);
  } catch {
    // Without constructed stylesheets the warning simply isn't shown.
  }

  function set(name, value) {
    if (value) root.setAttribute(name, value);
    else root.removeAttribute(name);
  }

  function apply() {
    set("data-fav", current.state === "chosen" ? current.team : null);
    set("data-fav-league", current.state === "chosen" || current.state === "paused" ? current.league : null);
    set("data-fav-state", current.state);
    set("data-fav-offer", offer ? offer.kind : null);
    if (sheet) {
      var league = current.state === "chosen" || current.state === "paused" ? current.league : null;
      sheet.replaceSync(favouriteCss(current.state === "chosen" ? current.team : null, league, leagueIds));
    }
    slots.forEach(fill);
  }

  function write() {
    var team = current.state === "chosen" ? index.teams.get(current.team) : null;
    try {
      localStorage.setItem(KEY, serialize(team, dismissed));
      storageWorks = true;
    } catch {
      storageWorks = false;
    }
  }

  function changed() {
    apply();
    document.dispatchEvent(new CustomEvent("tabletalk:favourite"));
  }

  // Text for the holes in a filled block (data-fav-text="name" and so on).
  // Always set with textContent, never as HTML.
  function text(what) {
    if (what === "name") return current.name || "your team";
    if (what === "league") return (current.league && index.leagueNames.get(current.league)) || "its league";
    if (what === "offer-name") return offer && offer.name ? offer.name : "";
    if (what === "replacing") return offer && offer.replacing ? offer.replacing : "your current team";
    if (what === "was-in") {
      var was = current.league && index.leagueNames.get(current.league);
      return was ? "It was in " + was + " when you picked it." : "";
    }
    return "";
  }

  // Which template a slot shows:
  //   data-fav-slot="state"  the template for the current state (data-for="none", "gone", ...);
  //                          for "chosen", the shared "@card" template filled from the data block
  //   data-fav-slot="team"   the favourite's own template, if this slot has one
  //   data-fav-slot="offer"  the template for the waiting personal link
  function key(kind) {
    if (kind === "offer") return offer ? offer.kind : "";
    if (kind === "state") return current.state;
    return current.state === "chosen" ? current.team : "";
  }

  function findTemplate(slot, name) {
    for (var i = 0; i < slot.children.length; i++) {
      var child = slot.children[i];
      if (child.tagName === "TEMPLATE" && child.getAttribute("data-for") === name) return child;
    }
    return null;
  }

  // The data block (<script type="application/json">, never run), read once.
  var valueCache = {};
  function cardValues(id, slug) {
    if (!(id in valueCache)) {
      var el = document.getElementById(id);
      try {
        valueCache[id] = el ? new Map(Object.entries(JSON.parse(el.textContent || "{}"))) : new Map();
      } catch {
        valueCache[id] = new Map();
      }
    }
    return valueCache[id].get(slug) || null;
  }

  // Fill a copied template from one team's values (always as text or as an
  // attribute value, never as HTML):
  //   data-fav-field="key"         textContent
  //   data-fav-attrs="attr:key"    attributes (space-separated pairs)
  //   data-fav-if / -unless="key"  removed when the key is missing / present
  function fillValues(content, values) {
    var has = function (key) {
      return values[key] !== undefined && values[key] !== "";
    };
    content.querySelectorAll("[data-fav-if]").forEach(function (el) {
      if (!has(el.getAttribute("data-fav-if"))) el.remove();
    });
    content.querySelectorAll("[data-fav-unless]").forEach(function (el) {
      if (has(el.getAttribute("data-fav-unless"))) el.remove();
    });
    content.querySelectorAll("[data-fav-field]").forEach(function (el) {
      var key = el.getAttribute("data-fav-field");
      el.textContent = has(key) ? String(values[key]) : "";
    });
    content.querySelectorAll("[data-fav-attrs]").forEach(function (el) {
      el.getAttribute("data-fav-attrs")
        .split(" ")
        .forEach(function (pair) {
          var parts = pair.split(":");
          if (has(parts[1])) el.setAttribute(parts[0], String(values[parts[1]]));
        });
    });
  }

  function fill(slot) {
    if (slots.indexOf(slot) === -1) slots.push(slot);
    var target = slot.querySelector("[data-fav-target]");
    if (!target) return;
    var kind = slot.getAttribute("data-fav-slot");
    var wanted = key(kind);
    var template = null;
    var values = null;
    if (kind === "state" && current.state === "chosen") {
      // The home page's card: one shared template ("@card": no slug can
      // contain "@") filled with the favourite's values from the data block.
      values = cardValues(slot.getAttribute("data-fav-values"), current.team);
      if (values) template = findTemplate(slot, "@card");
    } else {
      template = findTemplate(slot, wanted);
    }
    // Cells this slot added to a table last time (see below) are removed first.
    (slot.added || []).forEach(function (cell) {
      cell.remove();
    });
    slot.added = [];
    target.replaceChildren();
    target.hidden = template === null;
    if (template === null) return;
    var content = template.content.cloneNode(true);
    content.querySelectorAll("[data-fav-text]").forEach(function (hole) {
      hole.textContent = text(hole.getAttribute("data-fav-text"));
    });
    if (values) fillValues(content, values);
    // A table column for this team: the template holds one cell per row of
    // the table named by data-fav-columns-for, in the same row order.
    var columns = content.querySelector("[data-fav-columns-for]");
    if (columns) {
      var table = document.getElementById(columns.getAttribute("data-fav-columns-for"));
      var rows = table ? table.rows : [];
      var cells = columns.querySelectorAll("[data-fav-cell]");
      for (var r = 0; r < rows.length && r < cells.length; r++) {
        rows[r].appendChild(cells[r]);
        slot.added.push(cells[r]);
      }
      columns.remove();
    }
    target.appendChild(content);
  }

  window.tabletalkFavourite = {
    /** The team list for the picker: [[leagueId, leagueName, [[slug, name], ...]], ...]. */
    teams: function () {
      return DATA.leagues;
    },
    current: function () {
      return current;
    },
    offer: function () {
      return offer;
    },
    /** False when this browser refused to store the choice (private mode, settings). */
    storageWorks: function () {
      return storageWorks;
    },
    /** Make a team the favourite. Returns false for a slug not in this build. */
    choose: function (slug) {
      var team = findTeam(index, slug);
      if (!team) return false;
      current = { state: "chosen", team: team.slug, name: team.name, league: team.league };
      offer = null;
      write();
      changed();
      return true;
    },
    /** No favourite any more. The first-visit prompt stays away. */
    remove: function () {
      current = { state: "dismissed" };
      dismissed = true;
      offer = null;
      write();
      changed();
    },
    /** "Not now" on the first-visit prompt. */
    dismiss: function () {
      dismissed = true;
      if (current.state === "none") current = { state: "dismissed" };
      write();
      changed();
    },
    acceptOffer: function () {
      return offer && offer.team ? this.choose(offer.team) : false;
    },
    declineOffer: function () {
      offer = null;
      changed();
    },
    /** Fill every pre-built block parsed so far that hasn't been filled yet.
     *  Called by the one-line script after each block (FILL_SCRIPT), so it
     *  runs while the page is loading, before the first paint. */
    fillAll: function () {
      document.querySelectorAll("[data-fav-slot]").forEach(function (slot) {
        if (slots.indexOf(slot) === -1) fill(slot);
      });
    },
  };

  apply();
})();
