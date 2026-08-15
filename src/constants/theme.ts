import { Platform } from "react-native";

export const Colors = {
  light: {
    background: "#F5F7F2",
    surface: "#FFFFFF",
    surfaceMuted: "#E9EEE7",
    text: "#17231B",
    textMuted: "#657267",
    border: "#D7E0D6",
    accent: "#2F6B4F",
    accentSoft: "#DCEBE1",
    danger: "#A84242",
  },
  dark: {
    background: "#111712",
    surface: "#1B241D",
    surfaceMuted: "#263329",
    text: "#F2F6F1",
    textMuted: "#A9B7AA",
    border: "#344438",
    accent: "#9FD2AE",
    accentSoft: "#284734",
    danger: "#F0A4A4",
  },
} as const;

export const Fonts = Platform.select({
  ios: { sans: "system-ui", serif: "ui-serif", mono: "ui-monospace" },
  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    mono: "var(--font-mono)",
  },
  default: { sans: "normal", serif: "serif", mono: "monospace" },
});

export const Spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const Radius = {
  sm: 8,
  md: 14,
  lg: 20,
} as const;
