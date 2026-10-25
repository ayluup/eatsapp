import { Redirect } from "expo-router";

export default function StudentIndex() {
  // Redirige inmediatamente a la pantalla principal del estudiante
  return <Redirect href="/(student)/menu" />;
}
