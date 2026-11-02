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

  // Rellenos propios de algunas pantallas (el texto encima usa onAccent)
  categoryActiveStudent: "#cd9443",
  categoryActiveAdmin: "#289397cb",
  stockIn: "#87c397",
  stockOut: "#b51212",
  addProduct: "#63c184",
  saveButton: "#5d8d5c",
  photoBadge: "rgba(15, 23, 42, 0.5)",

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

  categoryActiveStudent: "#cd9443",
  categoryActiveAdmin: "#289397cb",
  stockIn: "#87c397",
  stockOut: "#b51212",
  addProduct: "#63c184",
  saveButton: "#5d8d5c",
  photoBadge: "rgba(0, 0, 0, 0.6)",

  backgroundElement: "#212225",
  backgroundSelected: "#2E3135",
};

export const Colors = { light, dark };

// Modo accesible: mismos roles con contraste WCAG AA (4.5:1 para texto,
// 3:1 para bordes y componentes). En claro los rellenos se oscurecen y el
// texto encima sigue blanco; en oscuro los rellenos se aclaran y el texto
// encima pasa a ser oscuro, porque un color no puede contrastar a la vez
// con el blanco y con el fondo oscuro.
const accessibleLight: ThemeColors = {
  ...light,
  border: "#7B8799",
  textBody: "#1E293B",
  textSecondary: "#475569",
  textMuted: "#5B6778",
  textFaint: "#7B8799",

  accent: "#285C97",
  accentStrong: "#1D4673",

  success: "#047857",
  successStrong: "#065F46",
  danger: "#B91C1C",
  dangerStrong: "#991B1B",
  warning: "#92400E",
  warningStrong: "#78350F",
  info: "#1D4ED8",

  categoryActiveStudent: "#8A4B0C",
  categoryActiveAdmin: "#14666A",
  stockIn: "#166534",
  stockOut: "#B91C1C",
  addProduct: "#15803D",
  saveButton: "#3F6B3E",
  photoBadge: "rgba(15, 23, 42, 0.85)",
};

const accessibleDark: ThemeColors = {
  ...dark,
  border: "#64748B",
  text: "#FFFFFF",
  textBody: "#E2E8F0",
  textSecondary: "#CBD5E1",
  textMuted: "#A8B4C6",
  textFaint: "#8090A6",
  onAccent: "#0B1220",

  accent: "#A9C4E6",
  accentStrong: "#C9DBF2",

  success: "#6EE7B7",
  successStrong: "#A7F3D0",
  danger: "#FCA5A5",
  dangerStrong: "#FECACA",
  warning: "#FCD34D",
  warningStrong: "#FDE68A",
  info: "#93C5FD",

  categoryActiveStudent: "#F2C58A",
  categoryActiveAdmin: "#7DD3D6",
  stockIn: "#86EFAC",
  stockOut: "#FCA5A5",
  addProduct: "#86EFAC",
  saveButton: "#A7D3A6",
  photoBadge: "rgba(241, 245, 249, 0.92)",
};

export const AccessibleColors = { light: accessibleLight, dark: accessibleDark };

// Daltonismo: verde y rojo se confunden con protanopia y deuteranopia, así
// que "bien" pasa a azul y "mal" a naranja (paleta Okabe-Ito). Se aplica
// encima de la paleta normal o de la de alto contraste.
const colorBlindLight: Partial<ThemeColors> = {
  success: "#0067B1",
  successStrong: "#004F8A",
  successSoft: "#E8F2FB",
  successBorder: "#B3D4EF",
  danger: "#B34A00",
  dangerStrong: "#8F3B00",
  dangerSoft: "#FFF3E8",
  dangerBorder: "#FBCFA6",
  stockIn: "#0067B1",
  stockOut: "#B34A00",
  addProduct: "#0067B1",
};

const colorBlindDark: Partial<ThemeColors> = {
  onAccent: "#0B1220",
  success: "#7CC4F2",
  successStrong: "#B5DDF7",
  successSoft: "#0F2C44",
  successBorder: "#1E4F75",
  danger: "#FFB27A",
  dangerStrong: "#FFD1B0",
  dangerSoft: "#3A2210",
  dangerBorder: "#7A3E12",
  stockIn: "#7CC4F2",
  stockOut: "#FFB27A",
  addProduct: "#7CC4F2",
  // Con texto oscuro encima, los rellenos tienen que ser claros
  categoryActiveStudent: "#F2C58A",
  categoryActiveAdmin: "#7DD3D6",
  saveButton: "#A7D3A6",
  photoBadge: "rgba(241, 245, 249, 0.92)",
};

export const ColorBlindColors = { light: colorBlindLight, dark: colorBlindDark };

// Tamaños de texto que se pueden elegir en Accesibilidad
export const TextScales = [
  { value: 1, label: "Normal" },
  { value: 1.15, label: "Grande" },
  { value: 1.3, label: "Muy grande" },
] as const;
export type TextScale = (typeof TextScales)[number]["value"];

// Área de toque mínima recomendada por Android y WCAG 2.5.8
export const MinTouchSize = 48;

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
