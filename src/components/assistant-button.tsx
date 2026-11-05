import { Ionicons } from "@expo/vector-icons";
import { Href } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";
import { ThemeColors } from "../constants/theme";
import { useAppTheme } from "../context/ThemeContext";
import { useSafeRouter } from "../hooks/use-safe-router";
import { useThemedStyles } from "../hooks/use-themed-styles";

// Botón del header que abre el asistente de IA (va al lado del de salir)
export function AssistantButton({ href }: { href: Href }) {
  const { colors: c, styles } = useThemedStyles(createStyles);
  const router = useSafeRouter();
  const { a11y } = useAppTheme();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.btn,
        a11y.showLabels && styles.btnWithLabel,
        pressed && styles.pressed,
      ]}
      onPress={() => router.push(href)}
      accessibilityLabel="Abrir asistente"
    >
      <Ionicons name="sparkles" size={22} color={c.accentStrong} />
      {a11y.showLabels && <Text style={styles.label}>Asistente</Text>}
    </Pressable>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    btn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      width: 58,
      height: 58,
      paddingHorizontal: 12,
      borderRadius: 29,
      backgroundColor: c.accentSoft,
      borderWidth: 1,
      borderColor: c.accentSoft,
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
      elevation: 6,
    },
    btnWithLabel: {
      width: "auto",
      minWidth: 58,
      paddingHorizontal: 14,
      borderRadius: 18,
    },
    label: { fontSize: 13, fontWeight: "700", color: c.accentStrong },
    pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  });
