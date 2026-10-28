import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

// Valores públicos (URL + publishable key). La seguridad real la dan las
// políticas RLS en la base, no ocultar estas claves.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY en el .env",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // En nativo guardamos la sesión para que siga iniciada entre usos.
    // En web Supabase usa localStorage por defecto.
    ...(Platform.OS !== "web" && { storage: AsyncStorage }),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refrescar el token solo mientras la app está en primer plano
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

// Tipo para los menús (ajusta según tus columnas reales)
export type Menu = {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  disponible: boolean;
  created_at: string;
};
