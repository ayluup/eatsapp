import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { isValidEmail } from "../../utils/auth-errors";
import { ThemeColors } from "../../constants/theme";
import { useThemedStyles } from "../../hooks/use-themed-styles";

export default function RecuperarScreen() {
  const { colors: c, styles } = useThemedStyles(createStyles);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const { sendPasswordReset } = useAuth();
  const router = useRouter();

  const handleSend = async () => {
    if (!email.trim()) return setError("Ingresá tu email");
    if (!isValidEmail(email)) return setError("Ingresá un email válido");

    setError(null);
    setLoading(true);
    const { error } = await sendPasswordReset(email.trim());
    setLoading(false);

    if (error) setError(error);
    else setSent(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={c.text} />
          </Pressable>

          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Ionicons
                name={sent ? "mail-open-outline" : "key-outline"}
                size={32}
                color={c.success}
              />
            </View>

            {sent ? (
              <>
                <Text style={styles.title}>Revisá tu email</Text>
                <Text style={styles.subtitle}>
                  Si {email.trim()} tiene una cuenta, te enviamos un link para
                  crear una contraseña nueva. Abrilo desde este celular.
                </Text>
                <Pressable style={styles.mainBtn} onPress={() => router.back()}>
                  <Text style={styles.mainBtnText}>Volver al inicio</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.title}>¿Olvidaste tu contraseña?</Text>
                <Text style={styles.subtitle}>
                  Ingresá tu email y te enviamos un link para restablecerla.
                </Text>

                <View style={[styles.inputBox, error && styles.inputError]}>
                  <Ionicons name="mail-outline" size={22} color={c.textSecondary} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor={c.textMuted}
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      setError(null);
                    }}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    onSubmitEditing={handleSend}
                  />
                </View>
                {error && <Text style={styles.errorText}>{error}</Text>}

                <Pressable
                  style={[styles.mainBtn, loading && styles.btnDisabled]}
                  onPress={handleSend}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={c.onAccent} />
                  ) : (
                    <Text style={styles.mainBtnText}>Enviar link</Text>
                  )}
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: c.decorLogin },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center", padding: 24 },
  backBtn: {
    position: "absolute",
    top: 8,
    left: 16,
    padding: 8,
    zIndex: 1,
  },
  card: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.cardBorder,
    borderRadius: 32,
    padding: 32,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: c.decorLogin,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: c.text,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: c.textSecondary,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surfaceAlt,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: c.border,
  },
  inputError: { borderColor: c.danger },
  input: {
    flex: 1,
    fontSize: 16,
    color: c.text,
    marginLeft: 12,
    fontWeight: "500",
  },
  errorText: { color: c.danger, fontSize: 13, marginTop: 8, marginLeft: 4 },
  mainBtn: {
    backgroundColor: c.success,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  btnDisabled: { opacity: 0.7 },
  mainBtnText: { color: c.onAccent, fontSize: 17, fontWeight: "800" },
});
