import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://brkdxypfmvfczxeuveme.supabase.co"; // Tu URL real
const supabaseAnonKey = "sb_publishable_2c6Tkrqj-DqXeG6HwAncXg_ekudwQ_I"; // Tu clave anon real

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Tipo para los menús (ajusta según tus columnas reales)
export type Menu = {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  disponible: boolean;
  created_at: string;
};
