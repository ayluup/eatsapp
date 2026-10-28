import { Stack } from "expo-router";
import { useAppTheme } from "../../context/ThemeContext";

export default function StudentLayout() {
  const { colors } = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="menu" />
      <Stack.Screen name="carrito" />
      <Stack.Screen name="mis-pedidos" />
      <Stack.Screen name="perfil" />
    </Stack>
  );
}
