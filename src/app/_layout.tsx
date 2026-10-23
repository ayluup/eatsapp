import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Solo cargamos pantallas de Admin por ahora */}
      <Stack.Screen name="admin-menu" />
      <Stack.Screen name="admin-agregar" />
    </Stack>
  );
}
