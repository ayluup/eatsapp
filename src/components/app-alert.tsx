import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { ThemeColors } from "../constants/theme";
import { useThemedStyles } from "../hooks/use-themed-styles";

// Carteles propios con el estilo de la app (los de Android son grises y no
// siguen el tema). Se usan igual que Alert.alert:
//   showAlert("Título", "Mensaje", [{ text: "OK", onPress }], { type: "success" })

export type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
};

export type AlertType = "success" | "error" | "warning" | "info" | "confirm" | "danger";

type AlertOptions = {
  type?: AlertType;
  icon?: keyof typeof Ionicons.glyphMap;
};

type AlertRequest = {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
  type: AlertType;
  icon?: keyof typeof Ionicons.glyphMap;
};

const TYPE_STYLE: Record<
  AlertType,
  { icon: keyof typeof Ionicons.glyphMap; color: keyof ThemeColors; bg: keyof ThemeColors }
> = {
  success: { icon: "checkmark-circle", color: "success", bg: "successSoft" },
  error: { icon: "close-circle", color: "danger", bg: "dangerSoft" },
  warning: { icon: "warning", color: "warning", bg: "warningSoft" },
  info: { icon: "information-circle", color: "info", bg: "infoSoft" },
  confirm: { icon: "help-circle", color: "accent", bg: "accentSoft" },
  danger: { icon: "alert-circle", color: "danger", bg: "dangerSoft" },
};

// Si no se indica el tipo, se deduce del título y de los botones
function inferType(title: string, buttons: AlertButton[]): AlertType {
  const t = title.toLowerCase();
  if (buttons.some((b) => b.style === "destructive")) return "danger";
  if (/error|no se pudo|incorrect/.test(t)) return "error";
  if (/inválid|requerid|tardó|atención|cuidado/.test(t)) return "warning";
  if (/listo|guardado|actualizado|correctamente|creado|agregado/.test(t)) return "success";
  if (buttons.length > 1) return "confirm";
  return "info";
}

// Ícono específico según de qué se trata (si no, el del tipo de cartel)
function inferIcon(title: string): keyof typeof Ionicons.glyphMap | undefined {
  const t = title.toLowerCase();
  if (/eliminar|borrar|nueva conversación/.test(t)) return "trash";
  if (/cancelar pedido/.test(t)) return "close-circle";
  if (/foto/.test(t)) return "camera";
  if (/email/.test(t)) return "mail";
  if (/administrador|rol/.test(t)) return "shield-checkmark";
  if (/link/.test(t)) return "link";
  if (/tardó|conexión/.test(t)) return "cloud-offline";
  return undefined;
}

// Cola global: así se puede llamar desde cualquier lado (pantallas,
// contextos, servicios) y si llegan dos carteles se muestran de a uno.
let nextId = 1;
let queue: AlertRequest[] = [];
let notify: (() => void) | null = null;

export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options: AlertOptions = {},
) {
  const list = buttons?.length ? buttons : [{ text: "Entendido" }];
  queue = [
    ...queue,
    {
      id: nextId++,
      title,
      message,
      buttons: list,
      type: options.type ?? inferType(title, list),
      icon: options.icon ?? inferIcon(title),
    },
  ];
  notify?.();
}

// Se monta una sola vez en el layout raíz
export function AlertHost() {
  const { colors: c, styles } = useThemedStyles(createStyles);
  const [current, setCurrent] = useState<AlertRequest | null>(null);
  // El cartel abierto también en un ref: la cola se maneja fuera de setState
  const currentRef = useRef<AlertRequest | null>(null);
  const closingRef = useRef(false);
  const scale = useState(() => new Animated.Value(0.9))[0];
  const opacity = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    const showNext = () => {
      if (currentRef.current || queue.length === 0) return;
      const [first, ...rest] = queue;
      queue = rest;
      currentRef.current = first;
      setCurrent(first);
    };
    notify = showNext;
    showNext();
    return () => {
      notify = null;
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    scale.setValue(0.9);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  }, [current, scale, opacity]);

  // Cierra con animación y recién después ejecuta la acción del botón,
  // así una navegación no ocurre con el cartel todavía abierto.
  const close = (button?: AlertButton) => {
    // Un doble toque no ejecuta la acción dos veces
    if (closingRef.current) return;
    closingRef.current = true;
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 0.92,
        duration: 120,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      closingRef.current = false;
      currentRef.current = null;
      setCurrent(null);
      button?.onPress?.();
      // Siguiente cartel en la cola (si hay)
      setTimeout(() => notify?.(), 50);
    });
  };

  if (!current) return null;

  const type = TYPE_STYLE[current.type];
  const cancelButton = current.buttons.find((b) => b.style === "cancel");
  // Con 3 o más botones (o textos largos) van uno debajo del otro
  const stacked =
    current.buttons.length > 2 || current.buttons.some((b) => b.text.length > 14);
  // "Cancelar" va a la izquierda en fila y abajo de todo si están apilados.
  // El principal (con color) es el de la derecha, o el de arriba si están apilados.
  const others = current.buttons.filter((b) => b.style !== "cancel");
  const cancels = current.buttons.filter((b) => b.style === "cancel");
  const ordered = stacked ? [...others, ...cancels] : [...cancels, ...others];
  const primary = stacked ? others[0] : others.at(-1);
  // Tocar afuera o "atrás" equivale a cancelar, solo si hay botón de cancelar
  // o si es un aviso de un solo botón.
  const dismiss = () => {
    if (cancelButton) close(cancelButton);
    else if (current.buttons.length === 1) close(current.buttons[0]);
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <View style={[styles.iconCircle, { backgroundColor: c[type.bg] }]}>
            <Ionicons name={current.icon ?? type.icon} size={34} color={c[type.color]} />
          </View>

          <Text style={styles.title}>{current.title}</Text>
          {!!current.message && <Text style={styles.message}>{current.message}</Text>}

          <View style={[styles.buttons, stacked && styles.buttonsStacked]}>
            {ordered.map((button, i) => {
              const isDestructive = button.style === "destructive";
              // El botón principal se pinta del color del tipo de cartel
              const isPrimary = isDestructive || button === primary;
              const bg = isDestructive
                ? c.danger
                : isPrimary
                  ? c[type.color === "warning" ? "warningStrong" : type.color]
                  : c.surfaceMuted;
              return (
                <Pressable
                  key={i}
                  onPress={() => close(button)}
                  style={({ pressed }) => [
                    styles.button,
                    !stacked && styles.buttonRow,
                    { backgroundColor: bg },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      { color: isPrimary || isDestructive ? c.onAccent : c.textBody },
                    ]}
                  >
                    {button.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: c.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: c.surface,
    borderRadius: 28,
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: c.borderSoft,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: c.text,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 15,
    color: c.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginTop: 8,
  },
  buttons: { flexDirection: "row", gap: 10, marginTop: 24, alignSelf: "stretch" },
  buttonsStacked: { flexDirection: "column" },
  button: {
    height: 50,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  buttonRow: { flex: 1 },
  buttonText: { fontSize: 16, fontWeight: "700" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
});
