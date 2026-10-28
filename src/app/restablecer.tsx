import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useAuth } from "../context/AuthContext";
import { MIN_PASSWORD_LENGTH } from "../utils/auth-errors";
import { ThemeColors } from "../constants/theme";
import { useThemedStyles } from "../hooks/use-themed-styles";

// Se llega acá desde el link del email de recuperación.
// En ese momento el usuario ya tiene una sesión temporal de Supabase.
export default function RestablecerScreen() {
  const { colors: c, styles } = useThemedStyles(createStyles);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { updatePassword, finishRecovery, signOut, user } = useAuth();

  const handleSave = async () => {
    if (password.length < MIN_PASSWORD_LENGTH)
      return setError(
        `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
      );
    if (password !== confirm) return setError("Las contraseñas no coinciden");

    setError(null);
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);

    if (error) return setError(error);

    Alert.alert("Listo", "Tu contraseña se cambió correctamente.");
    finishRecovery(); // queda logueado y va a su pantalla principal
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Ionicons name="lock-open-outline" size={32} color={c.success} />
            </View>
            <Text style={styles.title}>Nueva contraseña</Text>
            <Text style={styles.subtitle}>
              Elegí una contraseña nueva para {user?.email}
            </Text>

            <View style={styles.form}>
              <View style={styles.inputBox}>
                <Ionicons name="lock-closed-outline" size={22} color={c.textSecondary} />
                <TextInput
                  style={styles.input}
                  placeholder="Contraseña nueva"
                  placeholderTextColor={c.textMuted}
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    setError(null);
                  }}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                />
                <Pressable onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={22}
                    color={c.textSecondary}
                  />
                </Pressable>
              </View>

              <View style={styles.inputBox}>
                <Ionicons name="lock-closed-outline" size={22} color={c.textSecondary} />
                <TextInput
                  style={styles.input}
                  placeholder="Repetir contraseña"
                  placeholderTextColor={c.textMuted}
                  value={confirm}
                  onChangeText={(t) => {
                    setConfirm(t);
                    setError(null);
                  }}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  onSubmitEditing={handleSave}
                />
              </View>

              {error && <Text style={styles.errorText}>{error}</Text>}

              <Pressable
                style={[styles.mainBtn, loading && styles.btnDisabled]}
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={c.onAccent} />
                ) : (
                  <Text style={styles.mainBtnText}>Guardar contraseña</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.cancelBtn}
                onPress={signOut}
                disabled={loading}
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
            </View>
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
  form: { gap: 16 },
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
  input: {
    flex: 1,
    fontSize: 16,
    color: c.text,
    marginHorizontal: 12,
    fontWeight: "500",
  },
  errorText: { color: c.danger, fontSize: 13, marginLeft: 4 },
  mainBtn: {
    backgroundColor: c.success,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.7 },
  mainBtnText: { color: c.onAccent, fontSize: 17, fontWeight: "800" },
  cancelBtn: { alignItems: "center", padding: 8 },
  cancelText: { color: c.textSecondary, fontSize: 15, fontWeight: "600" },
});
