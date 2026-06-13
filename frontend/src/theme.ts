// Theme tokens with variants for accessibility/customization
export type ThemeVariant = "cyan" | "magenta" | "green";

const PALETTES: Record<
  ThemeVariant,
  { primary: string; primaryGlow: string; secondary: string; secondaryGlow: string }
> = {
  cyan: {
    primary: "#00f0ff",
    primaryGlow: "rgba(0, 240, 255, 0.35)",
    secondary: "#ff2bd6",
    secondaryGlow: "rgba(255, 43, 214, 0.35)",
  },
  magenta: {
    primary: "#ff2bd6",
    primaryGlow: "rgba(255, 43, 214, 0.4)",
    secondary: "#00f0ff",
    secondaryGlow: "rgba(0, 240, 255, 0.35)",
  },
  green: {
    primary: "#39ff88",
    primaryGlow: "rgba(57, 255, 136, 0.35)",
    secondary: "#ffe45c",
    secondaryGlow: "rgba(255, 228, 92, 0.3)",
  },
};

const COLOR_BLIND_SAFE = {
  primary: "#ffffff",
  primaryGlow: "rgba(255, 255, 255, 0.35)",
  secondary: "#ffb000",
  secondaryGlow: "rgba(255, 176, 0, 0.4)",
};

export type ThemeOpts = {
  variant?: ThemeVariant;
  highContrast?: boolean;
  colorBlindSafe?: boolean;
};

export function getColors(opts: ThemeOpts = {}) {
  const { variant = "cyan", highContrast, colorBlindSafe } = opts;
  const palette = colorBlindSafe ? COLOR_BLIND_SAFE : PALETTES[variant];
  return {
    bg: highContrast ? "#000000" : "#030408",
    bgElev: highContrast ? "#0a0a0a" : "#060810",
    board: highContrast ? "#050505" : "#04060c",
    surface: highContrast ? "#111111" : "#0c0f18",
    border: highContrast ? "#2a3040" : "#151b2e",
    gridTrace: highContrast ? "#2a3548" : "#12182a",
    gridPad: highContrast ? "#3a4558" : "#1a2238",
    text: "#f5f7ff",
    textDim: highContrast ? "#cfcfcf" : "#7d83a3",
    textMuted: highContrast ? "#9a9a9a" : "#4b5174",
    cyan: palette.primary,
    cyanGlow: palette.primaryGlow,
    magenta: palette.secondary,
    magentaGlow: palette.secondaryGlow,
    yellow: "#f8ff5c",
    green: "#39ff88",
    red: "#ff3a5e",
    redGlow: "rgba(255, 58, 94, 0.4)",
    star: "#ffd84a",
  };
}

// Default static export for non-themed screens
export const COLORS = getColors();

export const RADIUS = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};
