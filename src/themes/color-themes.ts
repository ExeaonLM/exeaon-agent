import { AGENT_SERVER_UI_THEMEABLE_BRAND_VARIABLES } from "#/styles/agent-server-ui-style-scope";

export type ColorThemeKey =
  | "openhands-solar-light"
  | "openhands-neutral"
  | "openhands-deepsea"
  | "openhands-neo";

export interface ColorThemeDefinition {
  label: string;
  /** Overrides for --cool-grey-* CSS custom properties (our semantic scale) */
  scale: Record<string, string>;
  heroui: Record<string, string>;
  /** Overrides for --oh-* semantic tokens such as brand / button colors. */
  tokens?: Record<string, string>;
}

// HSL channel strings for warm void-black / solar palette
// prettier-ignore
const NEUTRAL_HSL = {
  50:  "42 45% 95%",  // #F8F4EA
  100: "41 33% 89%",  // #EDE7D8
  200: "40 28% 82%",  // #DED6C4
  300: "40 20% 67%",  // #BAB19C
  400: "40 12% 53%",  // #968D79
  500: "40 10% 41%",  // #746D5D
  600: "40 15% 19%",  // #3A3528
  700: "40 18% 13%",  // #26221A
  800: "40 16% 9%",   // #1A1712
  850: "40 16% 7%",   // #15130E
  900: "40 15% 6%",   // #12100C
  950: "40 18% 4%",   // #0A0907 (warm void-black)
  975: "40 20% 2%",   // #050403 (purest void)
};

const NEUTRAL_SCALE = {
  "--cool-grey-50": "#F8F4EA",
  "--cool-grey-100": "#EDE7D8",
  "--cool-grey-200": "#DED6C4",
  "--cool-grey-300": "#BAB19C",
  "--cool-grey-400": "#968D79",
  "--cool-grey-500": "#746D5D",
  "--cool-grey-600": "#3A3528",
  "--cool-grey-700": "#26221A",
  "--cool-grey-800": "#1A1712",
  "--cool-grey-900": "#12100C",
  "--cool-grey-925": "#0D0C09",
  "--cool-grey-950": "#080705",
  "--cool-grey-975": "#030302",
};

const NEUTRAL_HEROUI = {
  "--heroui-background": NEUTRAL_HSL[950],
  "--heroui-background-foreground": NEUTRAL_HSL[50],
  "--heroui-foreground-50": NEUTRAL_HSL[975],
  "--heroui-foreground-100": NEUTRAL_HSL[950],
  "--heroui-foreground-200": NEUTRAL_HSL[900],
  "--heroui-foreground-300": NEUTRAL_HSL[850],
  "--heroui-foreground-400": NEUTRAL_HSL[800],
  "--heroui-foreground-500": NEUTRAL_HSL[700],
  "--heroui-foreground-600": NEUTRAL_HSL[600],
  "--heroui-foreground-700": NEUTRAL_HSL[500],
  "--heroui-foreground-800": NEUTRAL_HSL[400],
  "--heroui-foreground-900": NEUTRAL_HSL[300],
  "--heroui-foreground": NEUTRAL_HSL[300],
  "--heroui-content1": NEUTRAL_HSL[900],
  "--heroui-content1-foreground": NEUTRAL_HSL[100],
  "--heroui-content2": NEUTRAL_HSL[850],
  "--heroui-content2-foreground": NEUTRAL_HSL[200],
  "--heroui-content3": NEUTRAL_HSL[800],
  "--heroui-content3-foreground": NEUTRAL_HSL[300],
  "--heroui-content4": NEUTRAL_HSL[700],
  "--heroui-content4-foreground": NEUTRAL_HSL[400],
  "--heroui-default-50": NEUTRAL_HSL[975],
  "--heroui-default-100": NEUTRAL_HSL[950],
  "--heroui-default-200": NEUTRAL_HSL[900],
  "--heroui-default-300": NEUTRAL_HSL[850],
  "--heroui-default-400": NEUTRAL_HSL[800],
  "--heroui-default-500": NEUTRAL_HSL[700],
  "--heroui-default-600": NEUTRAL_HSL[600],
  "--heroui-default-700": NEUTRAL_HSL[500],
  "--heroui-default-800": NEUTRAL_HSL[400],
  "--heroui-default-900": NEUTRAL_HSL[300],
  "--heroui-default-foreground": NEUTRAL_HSL[50],
  "--heroui-default": NEUTRAL_HSL[800],
};

const SOLAR_LIGHT_SCALE = {
  "--cool-grey-50": "#0A0907",
  "--cool-grey-100": "#15130E",
  "--cool-grey-200": "#26221A",
  "--cool-grey-300": "#3A3528",
  "--cool-grey-400": "#746D5D",
  "--cool-grey-500": "#968D79",
  "--cool-grey-600": "#BAB19C",
  "--cool-grey-700": "#DED6C4",
  "--cool-grey-800": "#EDE7D8",
  "--cool-grey-900": "#F4EFE2",
  "--cool-grey-925": "#FAF7EE",
  "--cool-grey-950": "#FDFBF7",
  "--cool-grey-975": "#FFFFFF",
};

const SOLAR_LIGHT_HEROUI = {
  "--heroui-background": "42 45% 97%",
  "--heroui-background-foreground": "40 18% 10%",
  "--heroui-foreground-50": NEUTRAL_HSL[100],
  "--heroui-foreground-100": NEUTRAL_HSL[200],
  "--heroui-foreground-200": NEUTRAL_HSL[300],
  "--heroui-foreground-300": NEUTRAL_HSL[400],
  "--heroui-foreground-400": NEUTRAL_HSL[500],
  "--heroui-foreground-500": NEUTRAL_HSL[600],
  "--heroui-foreground-600": NEUTRAL_HSL[700],
  "--heroui-foreground-700": NEUTRAL_HSL[800],
  "--heroui-foreground-800": NEUTRAL_HSL[900],
  "--heroui-foreground-900": NEUTRAL_HSL[950],
  "--heroui-foreground": NEUTRAL_HSL[950],
  "--heroui-content1": "42 45% 99%",
  "--heroui-content1-foreground": NEUTRAL_HSL[900],
  "--heroui-content2": "41 33% 93%",
  "--heroui-content2-foreground": NEUTRAL_HSL[850],
  "--heroui-content3": "40 28% 88%",
  "--heroui-content3-foreground": NEUTRAL_HSL[800],
  "--heroui-content4": "40 20% 80%",
  "--heroui-content4-foreground": NEUTRAL_HSL[700],
  "--heroui-default-50": "42 45% 95%",
  "--heroui-default-100": "41 33% 89%",
  "--heroui-default-200": "40 28% 82%",
  "--heroui-default-300": "40 20% 67%",
  "--heroui-default-400": "40 12% 53%",
  "--heroui-default-500": "40 10% 41%",
  "--heroui-default-600": "40 15% 19%",
  "--heroui-default-700": "40 18% 13%",
  "--heroui-default-800": "40 16% 9%",
  "--heroui-default-900": "40 15% 6%",
  "--heroui-default-foreground": "40 18% 10%",
  "--heroui-default": "41 33% 93%",
};

/** White primary/accent tokens — used by OpenHands-Neo for button surfaces. */
const NEO_WHITE_BUTTON_TOKENS: Record<
  (typeof AGENT_SERVER_UI_THEMEABLE_BRAND_VARIABLES)[number],
  string
> = {
  "--oh-color-primary": "#ffffff",
  "--oh-accent": "#ffffff",
  "--oh-warning": "#ffffff",
};

export const COLOR_THEMES: Record<ColorThemeKey, ColorThemeDefinition> = {
  "openhands-solar-light": {
    label: "Exeaon Solar (Light)",
    scale: SOLAR_LIGHT_SCALE,
    heroui: SOLAR_LIGHT_HEROUI,
  },
  "openhands-neutral": {
    label: "Exeaon Solar (Dark / Default)",
    scale: NEUTRAL_SCALE,
    heroui: NEUTRAL_HEROUI,
  },
  "openhands-deepsea": {
    label: "Exeaon Midnight (Dark)",
    scale: {
      "--cool-grey-50": "#F7F9FC",
      "--cool-grey-100": "#EEF2F7",
      "--cool-grey-200": "#DCE3EE",
      "--cool-grey-300": "#C3CDDC",
      "--cool-grey-400": "#A3B0C4",
      "--cool-grey-500": "#7E8A9E",
      "--cool-grey-600": "#626D82",
      "--cool-grey-700": "#4B5468",
      "--cool-grey-800": "#383F50",
      "--cool-grey-900": "#2C313F",
      "--cool-grey-925": "#21252F",
      "--cool-grey-950": "#0B0E14",
      "--cool-grey-975": "#05070A",
    },
    heroui: {
      "--heroui-background": "220 29.03% 6.08%",
      "--heroui-background-foreground": "216 45.45% 97.84%",
      "--heroui-foreground-50": "216 33.33% 2.94%",
      "--heroui-foreground-100": "220 29.03% 6.08%",
      "--heroui-foreground-200": "222.86 17.5% 15.69%",
      "--heroui-foreground-300": "224.21 17.76% 20.98%",
      "--heroui-foreground-400": "222.5 17.65% 26.67%",
      "--heroui-foreground-500": "221.38 16.2% 35.1%",
      "--heroui-foreground-600": "219.38 14.04% 44.71%",
      "--heroui-foreground-700": "217.5 14.16% 55.69%",
      "--heroui-foreground-800": "216.36 21.85% 70.39%",
      "--heroui-foreground-900": "216 26.32% 81.37%",
      "--heroui-foreground": "216 26.32% 81.37%",
      "--heroui-content1": "222.86 17.5% 15.69%",
      "--heroui-content1-foreground": "213.33 36% 95.1%",
      "--heroui-content2": "224.21 17.76% 20.98%",
      "--heroui-content2-foreground": "216.67 34.62% 89.8%",
      "--heroui-content3": "222.5 17.65% 26.67%",
      "--heroui-content3-foreground": "216 26.32% 81.37%",
      "--heroui-content4": "221.38 16.2% 35.1%",
      "--heroui-content4-foreground": "216.36 21.85% 70.39%",
      "--heroui-default-50": "216 33.33% 2.94%",
      "--heroui-default-100": "220 29.03% 6.08%",
      "--heroui-default-200": "222.86 17.5% 15.69%",
      "--heroui-default-300": "224.21 17.76% 20.98%",
      "--heroui-default-400": "222.5 17.65% 26.67%",
      "--heroui-default-500": "221.38 16.2% 35.1%",
      "--heroui-default-600": "219.38 14.04% 44.71%",
      "--heroui-default-700": "217.5 14.16% 55.69%",
      "--heroui-default-800": "216.36 21.85% 70.39%",
      "--heroui-default-900": "216 26.32% 81.37%",
      "--heroui-default-foreground": "216 45.45% 97.84%",
      "--heroui-default": "222.5 17.65% 26.67%",
    },
  },
  "openhands-neo": {
    label: "Exeaon Void (OLED Dark)",
    scale: NEUTRAL_SCALE,
    heroui: NEUTRAL_HEROUI,
    tokens: NEO_WHITE_BUTTON_TOKENS,
  },
};

export const DEFAULT_COLOR_THEME: ColorThemeKey = "openhands-neutral";

export const AVAILABLE_COLOR_THEMES = Object.entries(COLOR_THEMES).map(
  ([key, def]) => ({ key: key as ColorThemeKey, label: def.label }),
);

const STORAGE_KEY = "openhands-color-theme";

/** Read the persisted theme key from localStorage, falling back to the default. */
export function readPersistedColorTheme(): ColorThemeKey {
  if (typeof window === "undefined") return DEFAULT_COLOR_THEME;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && stored in COLOR_THEMES) return stored as ColorThemeKey;
  } catch {
    // ignore quota / privacy-mode failures
  }
  return DEFAULT_COLOR_THEME;
}

/** Persist the theme key to localStorage. */
export function persistColorTheme(key: ColorThemeKey): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // ignore
  }
}

const THEME_STYLE_TAG_ID = "oh-color-theme-override";

export function applyColorTheme(key: ColorThemeKey): void {
  if (typeof document === "undefined") return;
  const theme = COLOR_THEMES[key] || COLOR_THEMES[DEFAULT_COLOR_THEME];
  const { scale, heroui, tokens = {} } = theme;

  const scaleDecls = Object.entries(scale)
    .map(([p, v]) => `  ${p}: ${v};`)
    .join("\n");

  const herouiDecls = Object.entries(heroui)
    .map(([p, v]) => `  ${p}: ${v};`)
    .join("\n");

  const tokenDecls = Object.entries(tokens)
    .map(([p, v]) => `  ${p}: ${v};`)
    .join("\n");

  const css = `
:root, [data-theme=dark], [data-agent-server-ui] {
${scaleDecls}
${herouiDecls}
${tokenDecls}
}
`;

  let styleTag = document.getElementById(THEME_STYLE_TAG_ID) as HTMLStyleElement | null;
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = THEME_STYLE_TAG_ID;
    document.head.appendChild(styleTag);
  }
  styleTag.textContent = css;
}
