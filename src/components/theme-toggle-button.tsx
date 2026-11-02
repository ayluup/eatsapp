import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text } from "react-native";
import { ThemeColors } from "../constants/theme";
import { useAppTheme } from "../context/ThemeContext";
import { useThemedStyles } from "../hooks/use-themed-styles";

// Botón del header que alterna entre modo claro y oscuro. Guarda la
// elección igual que "Apariencia" en el perfil.
export function ThemeToggleButton() {
  const { colors: c, styles } = useThemedStyles(createStyles);
  const { scheme, setPreference, a11y } = useAppTheme();
  const isDark = scheme === "dark";

  return (
    <Pressable
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
      onPress={() => setPreference(isDark ? "light" : "dark")}
      accessibilityLabel={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      <Ionicons
        name={isDark ? "eye-off-outline" : "eye-outline"}
        size={22}
        color={c.textBody}
      />
      {a11y.showLabels && (
        <Text style={styles.label}>{isDark ? "Modo claro" : "Modo oscuro"}</Text>
      )}
    </Pressable>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    borderRadius: 12,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  label: { fontSize: 13, fontWeight: "700", color: c.textBody },
  pressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
});
