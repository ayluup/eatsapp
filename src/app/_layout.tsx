import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* No necesitas declarar 'index' explícitamente si usas Redirect, 
          pero sí debes declarar el grupo (admin) */}
      <Stack.Screen name="(student)" />
    </Stack>
  );
}
