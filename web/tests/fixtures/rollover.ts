// The simulated next season used by the season-rollover test: where its
// data and build go, and which teams change. Shared by
// make-rollover-data.ts, playwright.rollover.config.ts and rollover.spec.ts.

export const ROLLOVER_DATA_DIR = ".rollover-data";
export const ROLLOVER_OUT_DIR = "dist-rollover";
/** Not 4321 (your preview) or 4322 (the main browser tests). */
export const ROLLOVER_PORT = 4323;
export const ROLLOVER_SEASON = "2027-28";

/** Per league: last season's team -> the team that replaces it (relegated -> promoted). */
export const RENAMES: Record<string, Record<string, string>> = {
  premier_league: {
    "Coventry City": "Burnley",
    "Ipswich Town": "Leicester City",
    "Hull City": "Sheffield United",
  },
  bundesliga: { "Hamburger SV": "Fortuna Düsseldorf" },
};
