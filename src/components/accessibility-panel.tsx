import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TextScales, ThemeColors } from "../constants/theme";
import { A11ySettings, useAppTheme } from "../context/ThemeContext";
import { useThemedStyles } from "../hooks/use-themed-styles";
import { announce } from "../utils/announce";

type IconName = keyof typeof Ionicons.glyphMap;
type BoolKey = { [K in keyof A11ySettings]: A11ySettings[K] extends boolean ? K : never }[keyof A11ySettings];

// Perfiles rápidos: activan juntas las opciones que suelen servir para
// cada tipo de necesidad. Después se puede ajustar cada una por separado.
const PROFILES: {
  label: string;
  icon: IconName;
  settings: Partial<A11ySettings>;
}[] = [
  {
    label: "Baja visión",
    icon: "eye-outline",
    settings: { highContrast: true, textScale: 1.3, boldText: true },
  },
  { label: "Daltonismo", icon: "color-palette-outline", settings: { colorBlind: true } },
  {
    label: "Motricidad",
    icon: "hand-left-outline",
    settings: { largeTargets: true, longerMessages: true },
  },
  { label: "Sensibilidad al movimiento", icon: "pulse-outline", settings: { reduceMotion: true } },
  {
    label: "Lectura y comprensión",
    icon: "book-outline",
    settings: { showLabels: true, longerMessages: true, boldText: true },
  },
];

const SECTIONS: {
  title: string;
  options: { key: BoolKey; icon: IconName; label: string; description: string }[];
}[] = [
  {
    title: "VISIÓN",
    options: [
      {
        key: "highContrast",
        icon: "contrast-outline",
        label: "Alto contraste",
        description: "Colores más marcados entre el texto y el fondo.",
      },
      {
        key: "boldText",
        icon: "text-outline",
        label: "Texto en negrita",
        description: "Letras más gruesas, más fáciles de distinguir.",
      },
      {
        key: "colorBlind",
        icon: "color-palette-outline",
        label: "Colores para daltonismo",
        description: "Azul y naranja en lugar de verde y rojo.",
      },
    ],
  },
  {
    title: "MOVIMIENTO Y MOTRICIDAD",
    options: [
      {
        key: "largeTargets",
        icon: "hand-left-outline",
        label: "Botones más grandes",
        description: "Más fáciles de tocar con temblores o poca precisión.",
      },
      {
        key: "reduceMotion",
        icon: "pulse-outline",
        label: "Reducir animaciones",
        description: "Sin rebotes ni deslizamientos que puedan marear.",
      },
    ],
  },
  {
    title: "LECTURA Y COMPRENSIÓN",
    options: [
      {
        key: "showLabels",
        icon: "pricetag-outline",
        label: "Botones con nombre",
        description: "Los íconos de arriba muestran también qué hacen.",
      },
      {
        key: "longerMessages",
        icon: "time-outline",
        label: "Avisos más largos",
        description: "Los mensajes quedan más tiempo en pantalla.",
      },
    ],
  },
];

// El celular no deja activar TalkBack / VoiceOver desde una app: se abre
// la pantalla de accesibilidad de los ajustes para que la persona lo haga
const openSystemSettings = () => {
  if (Platform.OS === "android") {
    Linking.sendIntent("android.settings.ACCESSIBILITY_SETTINGS").catch(() =>
      Linking.openSettings(),
    );
  } else {
    Linking.openSettings();
  }
};

export function AccessibilityPanel({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors: c, styles } = useThemedStyles(createStyles);
  const { a11y, setA11y, resetA11y, accessible, reduceMotion } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [screenReader, setScreenReader] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("screenReaderChanged", setScreenReader);
    return () => sub.remove();
  }, []);

  const profileActive = (settings: Partial<A11ySettings>) =>
    (Object.keys(settings) as (keyof A11ySettings)[]).every((k) => a11y[k] === settings[k]);

  const toggleProfile = (label: string, settings: Partial<A11ySettings>) => {
    if (profileActive(settings)) {
      // Apagar el perfil vuelve sus opciones a los valores normales
      const off: Partial<A11ySettings> = {};
      for (const k of Object.keys(settings) as (keyof A11ySettings)[]) {
        (off as any)[k] = k === "textScale" ? 1 : false;
      }
      setA11y(off);
      announce(`Perfil ${label} desactivado`);
    } else {
      setA11y(settings);
      announce(`Perfil ${label} activado`);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? "fade" : "slide"}
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: Platform.OS === "ios" ? 16 : insets.top + 12 }]}>
        <View style={styles.header}>
          <Ionicons name="accessibility" size={28} color={c.accent} />
          <Text style={styles.title} accessibilityRole="header">
            Accesibilidad
          </Text>
          <Pressable
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cerrar accesibilidad"
          >
            <Ionicons name="close" size={24} color={c.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.intro}>
            Elegí un perfil o ajustá cada opción. Los cambios se ven al instante
            y quedan guardados en este celular.
          </Text>

          {/* Perfiles rápidos */}
          <Text style={styles.sectionTitle} accessibilityRole="header">
            PERFILES RÁPIDOS
          </Text>
          <View style={styles.profiles}>
            {PROFILES.map((p) => {
              const active = profileActive(p.settings);
              return (
                <Pressable
                  key={p.label}
                  style={[styles.profileBtn, active && styles.profileBtnActive]}
                  onPress={() => toggleProfile(p.label, p.settings)}
                  accessibilityRole="switch"
                  accessibilityLabel={`Perfil ${p.label}`}
                  accessibilityState={{ checked: active }}
                >
                  <Ionicons name={p.icon} size={18} color={active ? c.onAccent : c.accent} />
                  <Text style={[styles.profileText, active && styles.profileTextActive]}>
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Tamaño de texto */}
          <Text style={styles.sectionTitle} accessibilityRole="header">
            TAMAÑO DEL TEXTO
          </Text>
          <View style={styles.card}>
            <View style={styles.segmented} accessibilityRole="radiogroup">
              {TextScales.map((opt) => {
                const selected = a11y.textScale === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[styles.segment, selected && styles.segmentSelected]}
                    onPress={() => setA11y({ textScale: opt.value })}
                    accessibilityRole="radio"
                    accessibilityLabel={`Texto ${opt.label}`}
                    accessibilityState={{ selected }}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        { fontSize: 13 * opt.value },
                        selected && styles.segmentTextSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.description}>
              Se suma al tamaño de letra que tengas configurado en el celular.
            </Text>
          </View>

          {/* Opciones por tipo de necesidad */}
          {SECTIONS.map((section) => (
            <View key={section.title}>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                {section.title}
              </Text>
              <View style={styles.card}>
                {section.options.map((opt, i) => {
                  const value = a11y[opt.key];
                  return (
                    <Pressable
                      key={opt.key}
                      style={[styles.optionRow, i > 0 && styles.optionDivider]}
                      onPress={() => setA11y({ [opt.key]: !value })}
                      accessibilityRole="switch"
                      accessibilityLabel={opt.label}
                      accessibilityHint={opt.description}
                      accessibilityState={{ checked: value }}
                    >
                      <View style={styles.optionIcon}>
                        <Ionicons name={opt.icon} size={20} color={c.accent} />
                      </View>
                      <View style={styles.flex1}>
                        <Text style={styles.optionLabel}>{opt.label}</Text>
                        <Text style={styles.description}>{opt.description}</Text>
                      </View>
                      <Switch
                        value={value}
                        onValueChange={(v) => setA11y({ [opt.key]: v })}
                        trackColor={{ false: c.border, true: c.accent }}
                        thumbColor={value ? c.onAccent : c.surface}
                        importantForAccessibility="no-hide-descendants"
                        accessibilityElementsHidden
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}

          {/* Lector de pantalla */}
          <Text style={styles.sectionTitle} accessibilityRole="header">
            CEGUERA Y LECTOR DE PANTALLA
          </Text>
          <View style={styles.card}>
            <View style={styles.optionRow}>
              <View style={styles.optionIcon}>
                <Ionicons name="volume-high-outline" size={20} color={c.accent} />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.optionLabel}>
                  {Platform.OS === "ios" ? "VoiceOver" : "TalkBack"}:{" "}
                  {screenReader ? "activado" : "desactivado"}
                </Text>
                <Text style={styles.description}>
                  La app lee en voz alta cada botón, los productos, los avisos y
                  los cambios de estado de tus pedidos. El lector se activa
                  desde los ajustes del celular.
                </Text>
              </View>
            </View>
            <Pressable
              style={styles.settingsBtn}
              onPress={openSystemSettings}
              accessibilityRole="button"
              accessibilityLabel="Abrir ajustes de accesibilidad del celular"
            >
              <Ionicons name="settings-outline" size={18} color={c.accentStrong} />
              <Text style={styles.settingsText}>Abrir ajustes del celular</Text>
            </Pressable>
          </View>

          {/* Audición: no necesita ajustes, se explica por qué */}
          <Text style={styles.sectionTitle} accessibilityRole="header">
            AUDICIÓN
          </Text>
          <View style={styles.card}>
            <View style={styles.optionRow}>
              <View style={styles.optionIcon}>
                <Ionicons name="ear-outline" size={20} color={c.accent} />
              </View>
              <Text style={[styles.description, styles.flex1]}>
                EatsApp no usa sonidos para avisar nada: todas las
                notificaciones llegan como texto y vibración.
              </Text>
            </View>
          </View>

          {accessible && (
            <Pressable
              style={styles.resetBtn}
              onPress={() => {
                resetA11y();
                announce("Accesibilidad restablecida");
              }}
              accessibilityRole="button"
            >
              <Ionicons name="refresh" size={18} color={c.danger} />
              <Text style={styles.resetText}>Volver a la configuración normal</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    title: { flex: 1, fontSize: 26, fontWeight: "800", color: c.text },
    closeBtn: {
      padding: 10,
      borderRadius: 12,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    content: { paddingHorizontal: 20 },
    intro: { fontSize: 15, color: c.textBody, lineHeight: 22 },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: c.textSecondary,
      letterSpacing: 0.5,
      marginTop: 24,
      marginBottom: 8,
    },
    profiles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    profileBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    profileBtnActive: { backgroundColor: c.accent, borderColor: c.accent },
    profileText: { fontSize: 14, fontWeight: "600", color: c.text },
    profileTextActive: { color: c.onAccent },
    card: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: c.border,
    },
    segmented: {
      flexDirection: "row",
      backgroundColor: c.surfaceMuted,
      borderRadius: 14,
      padding: 4,
      gap: 4,
    },
    segment: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 10,
    },
    segmentSelected: { backgroundColor: c.accent },
    segmentText: { fontWeight: "600", color: c.textSecondary },
    segmentTextSelected: { color: c.onAccent },
    optionRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
    optionDivider: { borderTopWidth: 1, borderTopColor: c.borderSoft },
    optionIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: c.accentSoft,
      justifyContent: "center",
      alignItems: "center",
    },
    optionLabel: { fontSize: 15, fontWeight: "700", color: c.text },
    description: { fontSize: 13, color: c.textSecondary, marginTop: 2, lineHeight: 18 },
    flex1: { flex: 1 },
    settingsBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 8,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: c.accentSoft,
    },
    settingsText: { fontSize: 15, fontWeight: "700", color: c.accentStrong },
    resetBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 24,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: c.dangerSoft,
      borderWidth: 1,
      borderColor: c.dangerBorder,
    },
    resetText: { fontSize: 15, fontWeight: "700", color: c.danger },
  });
