import { Stack } from "expo-router";

export default function AdminLayout() {
  // Aquí puedes verificar si el usuario es admin
  return (
    <Stack>
      <Stack.Screen name="menu" options={{ title: "Menú" }} />
      <Stack.Screen name="pedidos" options={{ title: "Pedidos" }} />
      <Stack.Screen name="agregar" options={{ title: "Agregar" }} />
      <Stack.Screen name="editar" options={{ title: "Editar" }} />
    </Stack>
  );
}
