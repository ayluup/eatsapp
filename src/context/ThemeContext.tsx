import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { useColorScheme } from "react-native";
import { ColorSchemeName, Colors, ThemeColors } from "../constants/theme";

// "system" sigue el tema configurado en el sistema operativo
export type ThemePreference = "system" | "light" | "dark";

type ThemeContextType = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  scheme: ColorSchemeName;
  colors: ThemeColors;
};

const STORAGE_KEY = "@eatsapp_theme";

const subscribeNothing = () => () => {};

const ThemeContext = createContext<ThemeContextType>({
  preference: "system",
  setPreference: () => {},
  scheme: "light",
  colors: Colors.light,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  // La preferencia se guarda en el dispositivo para mantenerla entre usos
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === "light" || saved === "dark" || saved === "system") {
          setPreferenceState(saved);
        }
      })
      .catch(() => {});
  }, []);

  const setPreference = (value: ThemePreference) => {
    setPreferenceState(value);
    AsyncStorage.setItem(STORAGE_KEY, value).catch(() => {});
  };

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

  return (
    <ThemeContext.Provider
      value={{ preference, setPreference, scheme, colors: Colors[scheme] }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
