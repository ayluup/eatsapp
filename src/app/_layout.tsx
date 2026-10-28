import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, isAdminRole, useAuth } from "../context/AuthContext";
import { ThemeProvider, useAppTheme } from "../context/ThemeContext";

function RootNavigator() {
  const { session, role, loading, recovering } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const { colors, scheme } = useAppTheme();

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

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}
