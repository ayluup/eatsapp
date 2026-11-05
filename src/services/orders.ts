import { OrderStatus } from "../constants/orders";
import { CartItem } from "../hooks/useCart";
import { supabase } from "./supabase";

export type PaymentMethod = "mp" | "efectivo";

// Crea el pedido. El servidor (trigger validar_pedido) recalcula el total,
// fija el estado inicial y rechaza productos no disponibles.
export async function createOrder(
  items: CartItem[],
  method: PaymentMethod,
  userId: string | undefined,
) {
  const orderId = `PED-${Date.now().toString().slice(-6)}`;
  const total = items.reduce((sum, i) => sum + i.precio * i.cantidad, 0);

  const { error } = await supabase.from("pedidos").insert({
    id_pedido: orderId,
    user_id: userId,
    // Sin la foto: el pedido solo necesita qué, cuánto y a qué precio
    items: items.map(({ id, nombre, precio, cantidad }) => ({ id, nombre, precio, cantidad })),
    total,
    metodo_pago: method,
    estado: "pending",
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
  return { orderId, total };
}

// El alumno cancela su pedido; el servidor solo lo deja si sigue pendiente
export async function cancelOrder(idPedido: string) {
  const { error } = await supabase.rpc("cancelar_pedido", { p_id_pedido: idPedido });
  if (error) throw new Error(error.message);
}

// Pedidos que el alumno puede sacar de su lista (terminados o cancelados)
export const HIDEABLE_STATUSES: OrderStatus[] = ["ready", "delivered", "cancelled"];

// El alumno saca un pedido de "Mis pedidos". No se borra: el kiosco lo
// sigue teniendo en el historial. El servidor revisa que esté terminado.
export async function hideOrder(id: string) {
  const { error } = await supabase.rpc("ocultar_pedido", { p_id: id });
  if (error) throw new Error(error.message);
}

// Elimina definitivamente un pedido cancelado propio; RLS valida propietario y estado.
export async function deleteCancelledOrder(id: string) {
  const { data, error } = await supabase
    .from("pedidos")
    .delete()
    .eq("id", id)
    .eq("estado", "cancelled")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Solo podés eliminar tus pedidos cancelados");
}
