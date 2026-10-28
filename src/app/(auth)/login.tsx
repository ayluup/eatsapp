import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Easing,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { isValidEmail, MIN_PASSWORD_LENGTH } from "../../utils/auth-errors";
import { ThemeColors } from "../../constants/theme";
import { useThemedStyles } from "../../hooks/use-themed-styles";

export default function LoginScreen() {
  const { colors: c, styles } = useThemedStyles(createStyles);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signIn, signUp, signInWithGoogle } = useAuth();

  // ✅ Animaciones para transiciones suaves
  const fadeAnim = useState(() => new Animated.Value(1))[0];
  const slideAnim = useState(() => new Animated.Value(0))[0];
  const btnScale = useState(() => new Animated.Value(1))[0];

  // ✅ Función para animar el cambio entre Login/Register
  const animateTransition = (callback: () => void) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -10,
        duration: 150,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
    ]).start(() => {
      callback(); // Cambiamos el estado DESPUÉS de ocultar
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const handleSubmit = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password)
      return Alert.alert("Error", "Completá todos los campos");
    if (!isValidEmail(cleanEmail))
      return Alert.alert("Error", "Ingresá un email válido");
    if (!isLogin && password.length < MIN_PASSWORD_LENGTH)
      return Alert.alert(
        "Error",
        `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
      );

    setLoading(true);
    try {
      if (isLogin) {
        // Si sale bien, el layout redirige solo a la pantalla del rol
        const { error } = await signIn(cleanEmail, password);
        if (error) Alert.alert("No se pudo iniciar sesión", error);
      } else {
        const { error, needsConfirmation } = await signUp(cleanEmail, password);
        if (error) return Alert.alert("No se pudo crear la cuenta", error);
        if (needsConfirmation) {
          Alert.alert(
            "Confirmá tu email",
            "Te enviamos un link para activar tu cuenta. Abrilo desde este celular.",
          );
          animateTransition(() => setIsLogin(true));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    setGoogleLoading(false);
    if (error) Alert.alert("No se pudo iniciar sesión con Google", error);
  };

  // ✅ Animación de escala para botones
  const animatePress = (animValue: Animated.Value) => {
    Animated.sequence([
      Animated.timing(animValue, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(animValue, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <SafeAreaView style={styles.safeArea}>

      <View style={styles.background}>
        <View style={styles.topHalf} />
        <View style={styles.diagonalLine} />
        <View style={styles.bottomHalf} />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.container}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.card}>
              {/* ✅ Títulos Animados */}
              <Animated.View
                style={{
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                }}
              >
                <Text style={styles.cardTitle}>
                  {isLogin ? "¡Bienvenido!" : "Crear Cuenta"}
                </Text>
                <Text style={styles.cardSubtitle}>
                  {isLogin
                    ? "Ingresá tus datos para continuar"
                    : "Unite a la comunidad del kiosco"}
                </Text>
              </Animated.View>

              <View style={styles.form}>
                <View style={styles.inputBox}>
                  <Ionicons name="mail-outline" size={22} color={c.textSecondary} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor={c.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <View style={styles.inputBox}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={22}
                    color={c.textSecondary}
                  />
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder="Contraseña"
                    placeholderTextColor={c.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={22}
                      color={c.textSecondary}
                    />
                  </Pressable>
                </View>

                {isLogin && (
                  <Link href="/(auth)/recuperar" style={styles.forgotLink}>
                    ¿Olvidaste tu contraseña?
                  </Link>
                )}

                {/* ✅ Botón Principal con Animación de Escala */}
                <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                  <Pressable
                    style={styles.mainBtn}
                    onPress={() => {
                      animatePress(btnScale);
                      handleSubmit();
                    }}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color={c.onAccent} />
                    ) : (
                      <Text style={styles.mainBtnText}>
                        {isLogin ? "Entrar" : "Registrarme"}
                      </Text>
                    )}
                  </Pressable>
                </Animated.View>

                <Pressable
                  onPress={() => animateTransition(() => setIsLogin(!isLogin))}
                  disabled={loading}
                  style={styles.switchMode}
                >
                  <Animated.Text style={{ opacity: fadeAnim }}>
                    <Text style={styles.switchText}>
                      {isLogin ? "¿Primera vez? " : "¿Ya tenés cuenta? "}
                    </Text>
                    <Text style={styles.switchLink}>
                      {isLogin ? "Registrate" : "Iniciá sesión"}
                    </Text>
                  </Animated.Text>
                </Pressable>
              </View>

              <View style={styles.divider}>
                <View style={styles.line} />
                <Text style={styles.orText}>o continuá con</Text>
                <View style={styles.line} />
              </View>

              {/* ✅ Botones Sociales con Feedback Táctil */}
              <Pressable
                style={({ pressed }) => [
                  styles.socialBtn,
                  pressed && styles.socialBtnPressed,
                ]}
                onPress={handleGoogleLogin}
                disabled={googleLoading || loading}
              >
                {googleLoading ? (
                  <ActivityIndicator color="#EA4335" />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={20} color="#EA4335" />
                    <Text style={styles.socialBtnText}>
                      Continuar con Google
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1 },
  background: { flex: 1, position: "relative" },
  topHalf: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: "50%",
    backgroundColor: c.decorLogin,
    borderBottomRightRadius: 40,
  },
  diagonalLine: {
    position: "absolute",
    top: "48%",
    left: -50,
    right: -50,
    height: 80,
    backgroundColor: c.decorLoginLine,
    transform: [{ rotate: "-3deg" }],
    borderRadius: 40,
    opacity: 0.6,
  },
  bottomHalf: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.authBase,
    borderTopLeftRadius: 40,
  },

  container: { flex: 1, position: "relative", zIndex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center", padding: 24 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: c.background,
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
  cardTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: c.text,
    marginBottom: 8,
    textAlign: "center",
  },
  cardSubtitle: {
    fontSize: 15,
    color: c.textSecondary,
    textAlign: "center",
    marginBottom: 28,
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
    marginLeft: 12,
    fontWeight: "500",
  },
  passwordInput: { paddingRight: 40 },
  eyeBtn: { position: "absolute", right: 16, padding: 4 },

  mainBtn: {
    backgroundColor: c.success,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    shadowColor: c.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  mainBtnText: {
    color: c.onAccent,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  forgotLink: {
    alignSelf: "flex-end",
    color: c.success,
    fontSize: 14,
    fontWeight: "600",
    marginTop: -4,
  },
  switchMode: { alignItems: "center", marginTop: 12, padding: 8 },
  switchText: { fontSize: 14, color: c.textSecondary },
  switchLink: { color: c.success, fontWeight: "700" },

  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
    gap: 12,
  },
  line: { flex: 1, height: 1, backgroundColor: c.border },
  orText: { fontSize: 13, color: c.textMuted, fontWeight: "500" },

  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: c.surface,
    borderRadius: 16,
    height: 52,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  socialBtnPressed: {
    backgroundColor: c.surfaceAlt,
    transform: [{ scale: 0.98 }],
  }, // ✅ Efecto táctil
  socialBtnText: { fontSize: 15, fontWeight: "600", color: c.text },

  adminHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 24,
  },
  adminHintText: { fontSize: 12, color: c.textSecondary, textAlign: "center" },
});
