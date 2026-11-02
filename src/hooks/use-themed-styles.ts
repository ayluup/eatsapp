import { useMemo } from "react";
import { MinTouchSize, TextScale, ThemeColors } from "../constants/theme";
import { useAppTheme } from "../context/ThemeContext";

// Estilos de botón: "btn", "button" o nombres terminados en Btn / Button
const BUTTON_KEY = /^(btn|button)$|(Btn|Button)$/;
const LIGHT_WEIGHTS = new Set([undefined, "normal", "100", "200", "300", "400", "500", 100, 200, 300, 400, 500]);

type Adjustments = { textScale: TextScale; boldText: boolean; largeTargets: boolean };

// Aplica las opciones de accesibilidad a los estilos de una pantalla, sin
// tener que cambiar los estilos de cada una
function adjustStyles<T>(styles: T, { textScale, boldText, largeTargets }: Adjustments): T {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(styles as Record<string, any>)) {
    if (!value || typeof value !== "object") {
      result[key] = value;
      continue;
    }
    const style = { ...value };
    const isText = typeof style.fontSize === "number";
    if (isText && textScale !== 1) {
      style.fontSize = Math.round(style.fontSize * textScale);
      if (typeof style.lineHeight === "number") {
        style.lineHeight = Math.round(style.lineHeight * textScale);
      }
    }
    if (isText && boldText && LIGHT_WEIGHTS.has(style.fontWeight)) {
      style.fontWeight = "700";
    }
    if (largeTargets && BUTTON_KEY.test(key)) {
      style.minWidth = Math.max(style.minWidth ?? 0, MinTouchSize);
      style.minHeight = Math.max(style.minHeight ?? 0, MinTouchSize);
      style.justifyContent ??= "center";
      style.alignItems ??= "center";
    }
    result[key] = style;
  }
  return result as T;
}

// Arma los estilos de una pantalla con los colores del tema actual.
// Se recalculan solo cuando cambia el tema o la accesibilidad.
export function useThemedStyles<T>(createStyles: (c: ThemeColors) => T) {
  const { colors, a11y } = useAppTheme();
  const { textScale, boldText, largeTargets } = a11y;
  const styles = useMemo(() => {
    const base = createStyles(colors);
    return textScale === 1 && !boldText && !largeTargets
      ? base
      : adjustStyles(base, { textScale, boldText, largeTargets });
  }, [colors, textScale, boldText, largeTargets, createStyles]);
  return { colors, styles };
}
