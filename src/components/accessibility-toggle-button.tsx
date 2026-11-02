import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { ThemeColors } from "../constants/theme";
import { useAppTheme } from "../context/ThemeContext";
import { useThemedStyles } from "../hooks/use-themed-styles";
import { AccessibilityPanel } from "./accessibility-panel";

// Botón del header que abre el panel de accesibilidad. Queda resaltado
// mientras haya alguna opción activa.
export function AccessibilityToggleButton() {
  const { colors: c, styles } = useThemedStyles(createStyles);
  const { accessible, a11y } = useAppTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.btn,
          accessible && styles.btnActive,
          pressed && styles.pressed,
        ]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Opciones de accesibilidad"
        accessibilityHint="Contraste, tamaño de texto, daltonismo, animaciones y más"
      >
        <Ionicons
          name="accessibility"
          size={22}
          color={accessible ? c.onAccent : c.textBody}
        />
        {a11y.showLabels && (
          <Text style={[styles.label, accessible && styles.labelActive]}>
            Accesibilidad
          </Text>
        )}
      </Pressable>
      <AccessibilityPanel visible={open} onClose={() => setOpen(false)} />
    </>
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
  btnActive: { backgroundColor: c.accent, borderColor: c.accent },
  label: { fontSize: 13, fontWeight: "700", color: c.textBody },
  labelActive: { color: c.onAccent },
  pressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
});
