import { ErrorBoundaryProps, Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, Text, useColorScheme, View } from "react-native";
import { AlertHost } from "../components/app-alert";
import { AnimatedSplash } from "../components/animated-splash";
import { AuthProvider, isAdminRole, useAuth } from "../context/AuthContext";
import { ThemeProvider, useAppTheme } from "../context/ThemeContext";
import { usePushNotifications } from "../hooks/use-push-notifications";

function RootNavigator() {
  const { session, role, loading, recovering } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const { colors, scheme } = useAppTheme();

  usePushNotifications(session?.user.id, !loading && !!session && !recovering);

  // Al cerrar sesión (o si la sesión vence) volver siempre al login
  useEffect(() => {
    if (loading || recovering) return;
    if (!session && segments[0] !== "(auth)") {
      router.replace("/(auth)/login");
    }
  }, [session, loading, recovering, segments, router]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        <ActivityIndicator size="large" color={colors.success} />
      </View>
    );
  }

  // Cada grupo solo es accesible con la sesión/rol correspondiente.
  // Cuando cambia la sesión (login/logout) Expo Router redirige solo.
  // Esto es protección de UI: la protección real está en las políticas RLS.
  // Mientras se restablece la contraseña solo se puede estar en esa pantalla.
  const loggedIn = !!session && !recovering;
  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Protected guard={recovering}>
          <Stack.Screen name="restablecer" />
        </Stack.Protected>
        <Stack.Protected guard={!session && !recovering}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={loggedIn && role === "student"}>
          <Stack.Screen name="(student)" />
        </Stack.Protected>
        <Stack.Protected guard={loggedIn && isAdminRole(role)}>
          <Stack.Screen name="(admin)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

// Si una pantalla falla, en vez de cerrarse la app se muestra el error
// con un botón para reintentar. Está fuera de los providers, por eso
// usa el tema del sistema y no useAppTheme.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const dark = useColorScheme() === "dark";
  // Si falla antes de que termine el inicio, el splash nativo no tapa el error
  useEffect(() => SplashScreen.hide(), []);
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
        gap: 12,
        backgroundColor: dark ? "#111" : "#fff",
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: "700", color: dark ? "#fff" : "#111" }}>
        Algo salió mal
      </Text>
      <Text style={{ fontSize: 14, textAlign: "center", color: dark ? "#aaa" : "#555" }}>
        {error.message}
      </Text>
      <Pressable
        onPress={retry}
        style={{
          marginTop: 8,
          paddingVertical: 12,
          paddingHorizontal: 24,
          borderRadius: 12,
          backgroundColor: "#208AEF",
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "600" }}>Reintentar</Text>
      </Pressable>
    </View>
  );
}

// Logo animado al abrir la app, hasta que se sabe si hay sesión
function StartupSplash() {
  const { loading } = useAuth();
  return <AnimatedSplash ready={!loading} />;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootNavigator />
        <StartupSplash />
      </AuthProvider>
      {/* Carteles de la app (showAlert), encima de todo */}
      <AlertHost />
    </ThemeProvider>
  );
}
