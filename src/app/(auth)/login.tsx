import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";

export default function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user, role, loading: authLoading } = useAuth();
  const router = useRouter();

  // ✅ Animaciones para transiciones suaves
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!authLoading && user && role) {
      router.replace(role === "admin" ? "/(admin)/menu" : "/(student)/menu");
    }
  }, [user, role, authLoading]);

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
    if (!email || !password)
      return Alert.alert("Error", "Completá todos los campos");
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) throw error;
      } else {
        if (password.length < 6)
          throw new Error("La contraseña debe tener al menos 6 caracteres");
        if (!email.includes("@")) throw new Error("Ingresá un email válido");

        const { error } = await signUp(email, password);
        if (error) throw error;
        Alert.alert("Éxito", "Cuenta creada correctamente. Iniciá sesión.");
        animateTransition(() => setIsLogin(true)); // Volver a login con animación
        return;
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Credenciales incorrectas");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider: string) => {
    Alert.alert(
      "Próximamente",
      `El inicio de sesión con ${provider} estará disponible pronto.`,
    );
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

  if (!authLoading && user && role) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

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
                  <Ionicons name="mail-outline" size={22} color="#64748B" />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="#94A3B8"
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
                    color="#64748B"
                  />
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder="Contraseña"
                    placeholderTextColor="#94A3B8"
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
                      color="#64748B"
                    />
                  </Pressable>
                </View>

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
                      <ActivityIndicator color="#FFF" />
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
                onPress={() => handleSocialLogin("Google")}
              >
                <Ionicons name="logo-google" size={20} color="#EA4335" />
                <Text style={styles.socialBtnText}>Continuar con Google</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.socialBtn,
                  pressed && styles.socialBtnPressed,
                ]}
                onPress={() => handleSocialLogin("Apple")}
              >
                <Ionicons name="logo-apple" size={20} color="#000000" />
                <Text style={styles.socialBtnText}>Continuar con Apple</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  background: { flex: 1, position: "relative" },
  topHalf: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: "50%",
    backgroundColor: "#D1FAE5",
    borderBottomRightRadius: 40,
  },
  diagonalLine: {
    position: "absolute",
    top: "48%",
    left: -50,
    right: -50,
    height: 80,
    backgroundColor: "#A7F3D0",
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
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 40,
  },

  container: { flex: 1, position: "relative", zIndex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center", padding: 24 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F0F4F8",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    padding: 32,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
    textAlign: "center",
  },
  cardSubtitle: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 22,
  },

  form: { gap: 16 },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#0F172A",
    marginLeft: 12,
    fontWeight: "500",
  },
  passwordInput: { paddingRight: 40 },
  eyeBtn: { position: "absolute", right: 16, padding: 4 },

  mainBtn: {
    backgroundColor: "#10B981",
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  mainBtnText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  switchMode: { alignItems: "center", marginTop: 12, padding: 8 },
  switchText: { fontSize: 14, color: "#64748B" },
  switchLink: { color: "#10B981", fontWeight: "700" },

  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
    gap: 12,
  },
  line: { flex: 1, height: 1, backgroundColor: "#E2E8F0" },
  orText: { fontSize: 13, color: "#94A3B8", fontWeight: "500" },

  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    height: 52,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  socialBtnPressed: {
    backgroundColor: "#F8FAFC",
    transform: [{ scale: 0.98 }],
  }, // ✅ Efecto táctil
  socialBtnText: { fontSize: 15, fontWeight: "600", color: "#0F172A" },

  adminHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 24,
  },
  adminHintText: { fontSize: 12, color: "#64748B", textAlign: "center" },
});
