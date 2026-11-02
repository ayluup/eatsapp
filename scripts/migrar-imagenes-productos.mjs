// Pasa las fotos de productos guardadas en base64 dentro de la tabla menus
// al bucket "productos" de Storage y deja en la base solo la URL.
// Se corre una sola vez (correrlo de nuevo no hace nada).
//
// Usa la service role key porque tiene que escribir en todos los productos.
// La key NO se guarda en ningún archivo: se pasa por variable de entorno.
//
//   $env:SUPABASE_SERVICE_ROLE_KEY = "<service_role key>"
//   node --env-file=.env scripts/migrar-imagenes-productos.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan EXPO_PUBLIC_SUPABASE_URL (.env) o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data: products, error } = await supabase
  .from("menus")
  .select("id, nombre, imagen_url")
  .like("imagen_url", "data:%");
if (error) throw error;

console.log(`Productos con foto en base64: ${products.length}`);

for (const p of products) {
  const [header, base64] = p.imagen_url.split(",");
  const contentType = header.match(/data:(.*?);/)?.[1] ?? "image/jpeg";
  const ext = contentType.split("/")[1].replace("jpeg", "jpg");
  const path = `${p.id}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("productos")
    .upload(path, Buffer.from(base64, "base64"), { contentType });
  if (uploadError) {
    console.error(`  ✖ ${p.nombre}: ${uploadError.message}`);
    continue;
  }

  const publicUrl = supabase.storage.from("productos").getPublicUrl(path).data.publicUrl;
  const { error: updateError } = await supabase
    .from("menus")
    .update({ imagen_url: publicUrl })
    .eq("id", p.id);
  console.log(updateError ? `  ✖ ${p.nombre}: ${updateError.message}` : `  ✔ ${p.nombre}`);
}
