import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    // Redirige inmediatamente a la pantalla de Admin al abrir la app
    router.replace("/admin-menu");
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#E74C3C" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E8F0F2",
  },
});
