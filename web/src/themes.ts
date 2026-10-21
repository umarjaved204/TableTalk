// The themes offered in the Appearance picker. Colours are NOT here: each
// theme's colours live in src/styles/themes/<id>.css, and the picker's swatches
// are drawn by giving a small element data-theme="<id>", so they use the
// theme's own tokens.

export interface ThemeOption {
  id: string;
  name: string;
  description: string;
}

/** "system" follows the device: Matchday by day, Floodlights by night, High
 *  Contrast when the device asks for more contrast. It is the default. */
export const SYSTEM: ThemeOption = {
  id: "system",
  name: "System",
  description: "Follows your device: Matchday by day, Floodlights by night.",
};

export const THEMES: readonly ThemeOption[] = [
  { id: "floodlights", name: "Floodlights", description: "Stadium night with pitch green." },
  { id: "matchday", name: "Matchday", description: "Clean white with deep green." },
  { id: "tactics", name: "Tactics Board", description: "Chalkboard green with chalk white." },
  { id: "programme", name: "Programme", description: "Retro programme cream with deep red." },
  { id: "nightgame", name: "Night Game", description: "Deep indigo with electric cyan." },
  { id: "terrace", name: "Terrace", description: "Concrete grey with scoreboard amber." },
  { id: "contrast", name: "High Contrast", description: "Black, white and yellow. Maximum legibility." },
];

export const PICKER_OPTIONS: readonly ThemeOption[] = [SYSTEM, ...THEMES];

/** localStorage key for the visitor's choice (absent = System). */
export const STORAGE_KEY = "tabletalk-theme";
