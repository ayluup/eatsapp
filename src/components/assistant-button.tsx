import { Ionicons } from "@expo/vector-icons";
import { Href } from "expo-router";
import { useSafeRouter } from "../hooks/use-safe-router";
import { Pressable, StyleSheet } from "react-native";
import { ThemeColors } from "../constants/theme";
import { useThemedStyles } from "../hooks/use-themed-styles";

// Botón del header que abre el asistente de IA (va al lado del de salir)
export function AssistantButton({ href }: { href: Href }) {
  const { colors: c, styles } = useThemedStyles(createStyles);
  const router = useSafeRouter();

  return (
    <Pressable
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
      onPress={() => router.push(href)}
      accessibilityLabel="Abrir asistente"
    >
      <Ionicons name="sparkles" size={22} color={c.accentStrong} />
    </Pressable>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  btn: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: c.accentSoft,
    borderWidth: 1,
    borderColor: c.accentSoft,
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
});
