import { Ionicons } from "@expo/vector-icons";
import { Href } from "expo-router";
import { useSafeRouter } from "../hooks/use-safe-router";
import { Pressable, StyleSheet, Text } from "react-native";
import { ThemeColors } from "../constants/theme";
import { useAppTheme } from "../context/ThemeContext";
import { useThemedStyles } from "../hooks/use-themed-styles";

// Botón del header que abre el asistente de IA (va al lado del de salir)
export function AssistantButton({ href }: { href: Href }) {
  const { colors: c, styles } = useThemedStyles(createStyles);
  const router = useSafeRouter();
  const { a11y } = useAppTheme();

  return (
    <Pressable
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
      onPress={() => router.push(href)}
      accessibilityLabel="Abrir asistente"
    >
      <Ionicons name="sparkles" size={22} color={c.accentStrong} />
      {a11y.showLabels && <Text style={styles.label}>Asistente</Text>}
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
    backgroundColor: c.accentSoft,
    borderWidth: 1,
    borderColor: c.accentSoft,
  },
  label: { fontSize: 13, fontWeight: "700", color: c.accentStrong },
  pressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
});
