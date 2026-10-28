import '@/global.css';

import { Platform } from 'react-native';

// Paleta de la app. El tema claro usa los colores originales del diseño;
// el oscuro mantiene los mismos roles con tonos para fondo oscuro.
const light = {
  background: "#F8FAFC",
  surface: "#FFFFFF",
  surfaceAlt: "#F8FAFC",
  surfaceMuted: "#F1F5F9",
  border: "#E2E8F0",
  borderSoft: "#F1F5F9",

  text: "#0F172A",
  textBody: "#334155",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  textFaint: "#CBD5E1",
  onAccent: "#FFFFFF",

  accent: "#638ec1",
  accentSoft: "#E0EAF6",
  accentStrong: "#285C97",

  success: "#10B981",
  successStrong: "#059669",
  successSoft: "#ECFDF5",
  successBorder: "#BBF7D0",
  danger: "#EF4444",
  dangerStrong: "#DC2626",
  dangerSoft: "#FEF2F2",
  dangerBorder: "#FECACA",
  warning: "#F59E0B",
  warningStrong: "#D97706",
  warningSoft: "#FEF3C7",
  info: "#3B82F6",
  infoSoft: "#EFF6FF",
  infoBorder: "#BFDBFE",

  // Formas decorativas de fondo de cada sección
  decorAdmin: "#f0e7e2",
  decorStudent: "#e2ecf0",
  decorLogin: "#D1FAE5",
  decorLoginLine: "#A7F3D0",
  // Base de las pantallas de acceso y borde de sus tarjetas
  authBase: "#FFFFFF",
  cardBorder: "#FFFFFF",

  overlay: "rgba(15, 23, 42, 0.5)",
  shadow: "#0F172A",

  // Nombres usados por los componentes del template de Expo
  backgroundElement: "#F0F0F3",
  backgroundSelected: "#E0E1E6",
};

export type ThemeColors = typeof light;

const dark: ThemeColors = {
  background: "#0B1220",
  surface: "#162032",
  surfaceAlt: "#0F1A2B",
  surfaceMuted: "#1F2B3E",
  border: "#2A3A52",
  borderSoft: "#24324A",

  text: "#F1F5F9",
  textBody: "#CBD5E1",
  textSecondary: "#94A3B8",
  textMuted: "#7C8BA1",
  textFaint: "#475569",
  onAccent: "#FFFFFF",

  accent: "#7FA6D6",
  accentSoft: "#1E3350",
  accentStrong: "#A9C4E6",

  success: "#34D399",
  successStrong: "#6EE7B7",
  successSoft: "#0E3B2E",
  successBorder: "#14532D",
  danger: "#F87171",
  dangerStrong: "#FCA5A5",
  dangerSoft: "#3A1C1F",
  dangerBorder: "#7F1D1D",
  warning: "#FBBF24",
  warningStrong: "#FCD34D",
  warningSoft: "#3D2E0A",
  info: "#60A5FA",
  infoSoft: "#172A4A",
  infoBorder: "#1E3A8A",

  decorAdmin: "#1A2536",
  decorStudent: "#14243A",
  decorLogin: "#0F2F27",
  decorLoginLine: "#134E3A",
  authBase: "#0B1220",
  cardBorder: "#2A3A52",

  overlay: "rgba(0, 0, 0, 0.6)",
  shadow: "#000000",

  backgroundElement: "#212225",
  backgroundSelected: "#2E3135",
};

export const Colors = { light, dark };

export type ColorSchemeName = keyof typeof Colors;
export type ThemeColor = keyof ThemeColors;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
