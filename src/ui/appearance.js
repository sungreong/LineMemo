const FONT_SIZES = ["small", "normal", "large"];
const COLOR_THEMES = ["warm", "sage", "sky", "rose", "slate"];

export function applyAppearanceSettings(settings = {}) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.fontSize = FONT_SIZES.includes(settings.fontSize) ? settings.fontSize : "normal";
  document.documentElement.dataset.colorTheme = COLOR_THEMES.includes(settings.colorTheme) ? settings.colorTheme : "warm";
  document.documentElement.dataset.theme = settings.darkMode ? "dark" : "light";
}
