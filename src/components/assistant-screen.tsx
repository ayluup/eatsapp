import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useSafeRouter } from "../hooks/use-safe-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isAdminRole, useAuth } from "../context/AuthContext";
import { Content, sendToAssistant, textOf } from "../services/assistant";
import { saveProductImage } from "../services/product-images";
import { supabase } from "../services/supabase";
import { ThemeColors } from "../constants/theme";
import { useThemedStyles } from "../hooks/use-themed-styles";
import { showAlert } from "./app-alert";

type Message = {
  id: string;
  kind: "user" | "assistant" | "action" | "error";
  text: string;
  // Producto recién creado al que se le puede cargar la foto
  photoFor?: { id: number; nombre: string };
  photoDone?: boolean;
};

// La conversación se guarda en el celular, una por usuario
const chatKey = (userId: string) => `@assistant_chat_${userId}`;
const MAX_SAVED_CONTENTS = 60;
const MAX_SAVED_MESSAGES = 120;

const SUGGESTIONS = {
  student: [
    "¿Qué me recomendás por menos de $3000?",
    "Agregame una gaseosa y algo para comer",
    "¿Cómo va mi pedido?",
  ],
  admin: [
    "¿Cómo vinieron las ventas esta semana?",
    "Pasá a listo todos los pedidos en preparación",
    "Marcá la Coca-Cola sin stock",
  ],
};

let nextId = 0;
const newId = () => `${Date.now()}-${nextId++}`;

// Gemini a veces manda markdown aunque se le pida que no
const cleanText = (t: string) => t.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#+\s*/gm, "");

export function AssistantScreen() {
  const { colors: c, styles } = useThemedStyles(createStyles);
  const { user, role } = useAuth();
  const isAdmin = isAdminRole(role);
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Message>>(null);

  const [history, setHistory] = useState<Content[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [status, setStatus] = useState("Pensando…");
  const [restored, setRestored] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);

  // Recuperar la conversación anterior
  useEffect(() => {
    if (!user?.id) return;
    AsyncStorage.getItem(chatKey(user.id))
      .then((json) => {
        if (!json) return;
        const saved = JSON.parse(json) as { history: Content[]; messages: Message[] };
        setHistory(saved.history ?? []);
        setMessages(saved.messages ?? []);
      })
      .catch((err) => console.warn("No se pudo leer el chat guardado:", err))
      .finally(() => setRestored(true));
  }, [user?.id]);

  // Guardarla cada vez que cambia (recién después de recuperarla)
  useEffect(() => {
    if (!user?.id || !restored) return;
    AsyncStorage.setItem(
      chatKey(user.id),
      JSON.stringify({
        history: history.slice(-MAX_SAVED_CONTENTS),
        messages: messages.slice(-MAX_SAVED_MESSAGES),
      }),
    ).catch((err) => console.warn("No se pudo guardar el chat:", err));
  }, [user?.id, restored, history, messages]);

  const newChat = () => {
    if (messages.length === 0 || thinking) return;
    showAlert("Nueva conversación", "Se borra el chat actual.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: () => {
          setHistory([]);
          setMessages([]);
        },
      },
    ]);
  };

  const push = (...items: Omit<Message, "id">[]) =>
    setMessages((prev) => [...prev, ...items.map((m) => ({ ...m, id: newId() }))]);

  // Foto para un producto que creó el asistente (igual que en Agregar)
  const addPhoto = (message: Message) => {
    const product = message.photoFor;
    if (!product) return;

    const pick = async (source: "camera" | "gallery") => {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      };
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      const base64 = !result.canceled ? result.assets[0].base64 : null;
      if (!base64) return;

      setUploadingPhoto(message.id);
      let error: unknown = null;
      try {
        const url = await saveProductImage(`data:image/jpeg;base64,${base64}`);
        ({ error } = await supabase
          .from("menus")
          .update({ imagen_url: url })
          .eq("id", product.id));
      } catch (err) {
        error = err;
      }
      setUploadingPhoto(null);

      if (error) {
        showAlert("Error", "No se pudo guardar la foto");
        return;
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, photoDone: true } : m)),
      );
      push({ kind: "action", text: `Agregaste la foto de ${product.nombre}` });
    };

    showAlert(`Foto de ${product.nombre}`, "¿De dónde querés sacar la foto?", [
      { text: "Sacar foto", onPress: () => pick("camera") },
      { text: "Elegir de la galería", onPress: () => pick("gallery") },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || thinking) return;
    setInput("");
    push({ kind: "user", text });
    setThinking(true);

    const start: Content[] = [...history, { role: "user", parts: [{ text }] }];
    try {
      const final = await sendToAssistant(
        start,
        { userId: user?.id, isAdmin },
        setStatus,
        (action) => push({ kind: "action", text: action.text, photoFor: action.photoFor }),
      );
      setHistory(final);
      const reply = textOf(final[final.length - 1]);
      if (reply) push({ kind: "assistant", text: cleanText(reply) });
    } catch (err: any) {
      // Sin guardar el intento fallido, así se puede volver a preguntar
      push({ kind: "error", text: err?.message ?? "Algo salió mal" });
    } finally {
      setThinking(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    if (item.kind === "action") {
      return (
        <View style={styles.actionGroup}>
          <View style={styles.action}>
            <Ionicons name="flash" size={14} color={c.accentStrong} />
            <Text style={styles.actionText}>{item.text}</Text>
          </View>
          {item.photoFor && !item.photoDone && (
            <Pressable
              style={({ pressed }) => [styles.photoBtn, pressed && styles.pressed]}
              onPress={() => addPhoto(item)}
              disabled={uploadingPhoto === item.id}
            >
              {uploadingPhoto === item.id ? (
                <ActivityIndicator size="small" color={c.onAccent} />
              ) : (
                <Ionicons name="camera" size={16} color={c.onAccent} />
              )}
              <Text style={styles.photoBtnText}>Agregar foto</Text>
            </Pressable>
          )}
        </View>
      );
    }
    const mine = item.kind === "user";
    return (
      <View
        style={[
          styles.bubble,
          mine ? styles.bubbleUser : styles.bubbleBot,
          item.kind === "error" && styles.bubbleError,
        ]}
      >
        <Text style={[styles.bubbleText, mine && styles.bubbleTextUser]}>{item.text}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <View style={styles.bgTop} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Ionicons name="arrow-back" size={26} color={c.text} />
        </Pressable>
        <View style={styles.flex1}>
          <Text style={styles.title} accessibilityRole="header">Asistente</Text>
          <Text style={styles.subtitle}>
            {isAdmin
              ? "Gestiona productos, pedidos y ventas por vos"
              : "Te ayuda a elegir y hace el pedido por vos"}
          </Text>
        </View>
        {messages.length > 0 && (
          <Pressable
            onPress={newChat}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            accessibilityLabel="Nueva conversación"
          >
            <Ionicons name="create-outline" size={22} color={c.text} />
          </Pressable>
        )}
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="sparkles" size={36} color={c.accent} />
            </View>
            <Text style={styles.emptyTitle}>¿En qué te ayudo?</Text>
            {SUGGESTIONS[isAdmin ? "admin" : "student"].map((s) => (
              <Pressable
                key={s}
                style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
                onPress={() => send(s)}
              >
                <Text style={styles.suggestionText}>{s}</Text>
              </Pressable>
            ))}
          </View>
        }
        ListFooterComponent={
          thinking ? (
            <View style={styles.thinking}>
              <ActivityIndicator size="small" color={c.accent} />
              <Text style={styles.thinkingText}>{status}</Text>
            </View>
          ) : undefined
        }
      />

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 12 }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Escribí lo que necesitás…"
          placeholderTextColor={c.textMuted}
          multiline
          maxLength={500}
          editable={!thinking}
        />
        <Pressable
          style={[styles.sendBtn, (!input.trim() || thinking) && styles.sendBtnDisabled]}
          onPress={() => send(input)}
          disabled={!input.trim() || thinking}
          accessibilityRole="button"
          accessibilityLabel="Enviar mensaje"
          accessibilityState={{ disabled: !input.trim() || thinking }}
        >
          <Ionicons name="send" size={20} color={c.onAccent} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  flex1: { flex: 1 },
  pressed: { opacity: 0.7 },

  bgTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 220,
    backgroundColor: c.accentSoft,
    borderBottomRightRadius: 80,
    borderBottomLeftRadius: 80,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: c.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: c.border,
  },
  title: { fontSize: 26, fontWeight: "800", color: c.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: c.textSecondary, marginTop: 2 },

  list: { flexGrow: 1, paddingHorizontal: 16, paddingVertical: 12, gap: 10 },

  bubble: { maxWidth: "85%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { alignSelf: "flex-end", backgroundColor: c.accent, borderBottomRightRadius: 4 },
  bubbleBot: {
    alignSelf: "flex-start",
    backgroundColor: c.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: c.border,
  },
  bubbleError: { backgroundColor: c.dangerSoft, borderColor: c.dangerBorder },
  bubbleText: { fontSize: 15, lineHeight: 21, color: c.textBody },
  bubbleTextUser: { color: c.onAccent },

  actionGroup: { alignSelf: "flex-start", gap: 6, maxWidth: "90%" },
  photoBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: c.accent,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  photoBtnText: { fontSize: 13, fontWeight: "700", color: c.onAccent },
  action: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: c.accentSoft,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: "90%",
  },
  actionText: { fontSize: 13, fontWeight: "600", color: c.accentStrong, flexShrink: 1 },

  thinking: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  thinkingText: { fontSize: 14, color: c.textSecondary },

  empty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10, paddingVertical: 24 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: c.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: c.text, marginBottom: 6 },
  suggestion: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: "100%",
  },
  suggestionText: { fontSize: 14, color: c.textBody },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    color: c.text,
    backgroundColor: c.surfaceMuted,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
});
