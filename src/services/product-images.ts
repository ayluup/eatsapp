import { supabase } from "./supabase";

export const PRODUCT_BUCKET = "productos";

// Las fotos de productos van a Storage y en la base queda solo la URL.
// Guardarlas en base64 dentro de la tabla hacía que cada consulta del menú
// (y cada pedido) bajara varios MB.
//
// Recibe lo que tiene el formulario: una foto recién sacada ("data:image/...")
// se sube; una URL que ya estaba guardada se deja como está.
export async function saveProductImage(image: string | null): Promise<string | null> {
  if (!image || !image.startsWith("data:")) return image;

  const [header, base64] = image.split(",");
  const contentType = header.match(/data:(.*?);/)?.[1] ?? "image/jpeg";
  const ext = contentType.split("/")[1].replace("jpeg", "jpg");

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  // Nombre nuevo en cada subida para que no se muestre la foto vieja en caché
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from(PRODUCT_BUCKET)
    .upload(path, bytes, { contentType });
  if (error) throw error;

  return supabase.storage.from(PRODUCT_BUCKET).getPublicUrl(path).data.publicUrl;
}
