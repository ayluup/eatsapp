import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, useColorScheme } from "react-native";

// El splash nativo se queda hasta que esta pantalla lo reemplaza
SplashScreen.preventAutoHideAsync().catch(() => {});

// Mismos valores que expo-splash-screen en app.json, así el cambio del
// splash nativo a este no se nota. Sigue el tema del sistema (como el
// nativo), no la preferencia guardada en la app.
const BACKGROUND = { light: "#FFFFFF", dark: "#083335" };
const LOGO_SIZE = 200;
// Tiempo mínimo para que la animación de entrada se vea completa
const MIN_DURATION = 1400;

// Inicio animado con el logo: aparece con un pequeño rebote, late mientras
// carga la sesión y al terminar se agranda y se desvanece mostrando la app.
export function AnimatedSplash({ ready }: { ready: boolean }) {
  const dark = useColorScheme() === "dark";
  const [minTimeDone, setMinTimeDone] = useState(false);
  const [visible, setVisible] = useState(true);
  const scale = useState(() => new Animated.Value(1))[0];
  const rotate = useState(() => new Animated.Value(0))[0];
  const logoOpacity = useState(() => new Animated.Value(1))[0];
  const screenOpacity = useState(() => new Animated.Value(1))[0];

  // Entrada: se achica un poco, gira apenas y rebota a su tamaño
  const onLayout = () => {
    SplashScreen.hide();
    Animated.sequence([
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 0.85,
          duration: 250,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.spring(scale, { toValue: 1.05, friction: 4, tension: 60, useNativeDriver: true }),
        Animated.spring(rotate, { toValue: 0, friction: 4, tension: 60, useNativeDriver: true }),
      ]),
    ]).start(() => {
      // Si la sesión todavía no cargó, el logo "late" hasta que esté
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: 0.97, duration: 600, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.05, duration: 600, useNativeDriver: true }),
        ]),
      ).start();
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeDone(true), MIN_DURATION);
    return () => clearTimeout(timer);
  }, []);

  // Salida: el logo se agranda y todo se desvanece
  useEffect(() => {
    if (!ready || !minTimeDone) return;
    scale.stopAnimation();
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1.6,
        duration: 450,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 450,
        delay: 150,
        useNativeDriver: true,
      }),
    ]).start(() => setVisible(false));
  }, [ready, minTimeDone, scale, logoOpacity, screenOpacity]);

  if (!visible) return null;

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-8deg"] });

  return (
    <Animated.View
      onLayout={onLayout}
      pointerEvents="none"
      style={[
        styles.container,
        { backgroundColor: dark ? BACKGROUND.dark : BACKGROUND.light, opacity: screenOpacity },
      ]}
    >
      <Animated.Image
        source={require("../../assets/images/splash-icon.png")}
        style={[
          styles.logo,
          { opacity: logoOpacity, transform: [{ scale }, { rotate: spin }] },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
    elevation: 100,
  },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
});
