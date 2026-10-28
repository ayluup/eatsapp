import { Stack } from "expo-router";
import { useAppTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";

export default function AdminLayout() {
  const { colors } = useAppTheme();
  const { role } = useAuth();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="menu" />
      <Stack.Screen name="pedidos" />
      <Stack.Screen name="agregar" />
      <Stack.Screen name="editar" />
      <Stack.Screen name="perfil" />
      {/* Solo el superadmin decide quién es admin */}
      <Stack.Protected guard={role === "superadmin"}>
        <Stack.Screen name="usuarios" />
      </Stack.Protected>
    </Stack>
  );
}
