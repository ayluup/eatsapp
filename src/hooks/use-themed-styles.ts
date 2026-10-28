import { useMemo } from "react";
import { ThemeColors } from "../constants/theme";
import { useAppTheme } from "../context/ThemeContext";

// Arma los estilos de una pantalla con los colores del tema actual.
// Se recalculan solo cuando cambia el tema.
export function useThemedStyles<T>(createStyles: (c: ThemeColors) => T) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors, createStyles]);
  return { colors, styles };
}
