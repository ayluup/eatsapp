import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { AccessibilityInfo, Platform, useColorScheme } from "react-native";
import {
  AccessibleColors,
  ColorBlindColors,
  ColorSchemeName,
  Colors,
  TextScale,
  ThemeColors,
} from "../constants/theme";

// "system" sigue el tema configurado en el sistema operativo
export type ThemePreference = "system" | "light" | "dark";

// Opciones de accesibilidad: cada una ayuda a un tipo de necesidad distinto
export type A11ySettings = {
  highContrast: boolean; // baja visión
  textScale: TextScale; // baja visión, lectura
  boldText: boolean; // baja visión, dislexia
  largeTargets: boolean; // motriz (temblores, poca precisión)
  colorBlind: boolean; // daltonismo
  reduceMotion: boolean; // vestibular, epilepsia fotosensible
  longerMessages: boolean; // cognitiva, motriz
  showLabels: boolean; // cognitiva: botones con texto, no solo ícono
};

export const DEFAULT_A11Y: A11ySettings = {
  highContrast: false,
  textScale: 1,
  boldText: false,
  largeTargets: false,
  colorBlind: false,
  reduceMotion: false,
  longerMessages: false,
  showLabels: false,
};

type ThemeContextType = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  scheme: ColorSchemeName;
  colors: ThemeColors;
  a11y: A11ySettings;
  setA11y: (changes: Partial<A11ySettings>) => void;
  resetA11y: () => void;
  // Hay alguna opción de accesibilidad activa
  accessible: boolean;
  // Sin animaciones de movimiento: la opción de la app o "Reducir
  // movimiento" del sistema
  reduceMotion: boolean;
};

const STORAGE_KEY = "@eatsapp_theme";
const A11Y_KEY = "@eatsapp_a11y";
// Versión anterior: un solo interruptor de "modo accesible"
const OLD_ACCESSIBLE_KEY = "@eatsapp_accessible";

const subscribeNothing = () => () => {};

const ThemeContext = createContext<ThemeContextType>({
  preference: "system",
  setPreference: () => {},
  scheme: "light",
  colors: Colors.light,
  a11y: DEFAULT_A11Y,
  setA11y: () => {},
  resetA11y: () => {},
  accessible: false,
  reduceMotion: false,
});

// Si la persona nunca configuró la accesibilidad en la app, se arranca con
// lo que ya tiene activado en el celular
async function settingsFromSystem(): Promise<Partial<A11ySettings>> {
  const safe = (p: Promise<boolean>) => p.catch(() => false);
  const [bold, contrast] = await Promise.all([
    safe(AccessibilityInfo.isBoldTextEnabled()),
    Platform.OS === "android"
      ? safe(AccessibilityInfo.isHighTextContrastEnabled())
      : Platform.OS === "ios"
        ? safe(AccessibilityInfo.isDarkerSystemColorsEnabled())
        : Promise.resolve(false),
  ]);
  return {
    ...(bold && { boldText: true }),
    ...(contrast && { highContrast: true }),
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [a11y, setA11yState] = useState<A11ySettings>(DEFAULT_A11Y);
  const [systemReduceMotion, setSystemReduceMotion] = useState(false);

  // Las preferencias se guardan en el dispositivo para mantenerlas entre usos
  useEffect(() => {
    AsyncStorage.multiGet([STORAGE_KEY, A11Y_KEY, OLD_ACCESSIBLE_KEY])
      .then(async ([[, saved], [, savedA11y], [, oldAccessible]]) => {
        if (saved === "light" || saved === "dark" || saved === "system") {
          setPreferenceState(saved);
        }
        if (savedA11y) {
          setA11yState({ ...DEFAULT_A11Y, ...JSON.parse(savedA11y) });
        } else if (oldAccessible === "1") {
          setA11yState({
            ...DEFAULT_A11Y,
            highContrast: true,
            textScale: 1.15,
            largeTargets: true,
          });
        } else {
          const fromSystem = await settingsFromSystem();
          setA11yState((prev) => ({ ...prev, ...fromSystem }));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setSystemReduceMotion)
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setSystemReduceMotion);
    return () => sub.remove();
  }, []);

  const setPreference = (value: ThemePreference) => {
    setPreferenceState(value);
    AsyncStorage.setItem(STORAGE_KEY, value).catch(() => {});
  };

  const saveA11y = (next: A11ySettings) => {
    setA11yState(next);
    AsyncStorage.setItem(A11Y_KEY, JSON.stringify(next)).catch(() => {});
  };
  const setA11y = (changes: Partial<A11ySettings>) => saveA11y({ ...a11y, ...changes });
  const resetA11y = () => saveA11y(DEFAULT_A11Y);

  // En web la página se arma primero en el servidor, que no conoce el tema
  // del usuario: la primera vista usa claro igual que el servidor y después
  // cambia. Si no, quedan partes con los colores del servidor.
  const isClient = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );

  const scheme: ColorSchemeName = !isClient
    ? "light"
    : preference === "system"
      ? systemScheme === "dark"
        ? "dark"
        : "light"
      : preference;

  // Memo: si no, con daltonismo cada render arma un objeto nuevo y todas
  // las pantallas recalculan sus estilos
  const highContrast = a11y.highContrast && isClient;
  const colorBlind = a11y.colorBlind && isClient;
  const colors = useMemo(() => {
    const base = (highContrast ? AccessibleColors : Colors)[scheme];
    return colorBlind ? { ...base, ...ColorBlindColors[scheme] } : base;
  }, [highContrast, colorBlind, scheme]);

  const accessible = (Object.keys(DEFAULT_A11Y) as (keyof A11ySettings)[]).some(
    (k) => a11y[k] !== DEFAULT_A11Y[k],
  );

  return (
    <ThemeContext.Provider
      value={{
        preference,
        setPreference,
        scheme,
        colors,
        a11y,
        setA11y,
        resetA11y,
        accessible,
        reduceMotion: a11y.reduceMotion || systemReduceMotion,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
