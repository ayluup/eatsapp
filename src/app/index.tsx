import { Redirect } from "expo-router";

export default function Index() {
  // La ruta debe coincidir EXACTAMENTE con el nombre de la carpeta
  return <Redirect href="/(admin)/menu" />;
  // Nota: A veces redirect a "/(admin)" falla si no hay un index dentro de admin.
  // Es más seguro redirigir a una pantalla específica como /menu o /pedidos
}
