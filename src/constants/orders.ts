import { Ionicons } from "@expo/vector-icons";
import { ThemeColors } from "./theme";

export type OrderStatus = "pending" | "preparing" | "ready" | "delivered" | "cancelled";

export type OrderItem = {
  id: number;
  nombre: string;
  precio: number;
  cantidad: number;
};

export type Order = {
  id: string;
  id_pedido: string;
  user_id: string;
  items: OrderItem[];
  total: number;
  metodo_pago: "mp" | "efectivo";
  estado: OrderStatus;
  created_at: string;
};

export const ORDER_COLUMNS =
  "id, id_pedido, user_id, items, total, metodo_pago, estado, created_at";

// Pedidos que todavía están en curso en el kiosco
export const ACTIVE_STATUSES: OrderStatus[] = ["pending", "preparing", "ready"];

type ColorKey = keyof ThemeColors;

// Colores del tema (ver constants/theme.ts)
export const STATUS_CONFIG: Record<
  OrderStatus,
  {
    label: string;
    color: ColorKey;
    bg: ColorKey;
    icon: keyof typeof Ionicons.glyphMap;
  }
> = {
  pending: { label: "Pendiente", color: "warning", bg: "warningSoft", icon: "time-outline" },
  preparing: { label: "En preparación", color: "info", bg: "infoSoft", icon: "flame-outline" },
  ready: { label: "¡Listo!", color: "success", bg: "successSoft", icon: "checkmark-circle-outline" },
  delivered: { label: "Entregado", color: "textSecondary", bg: "surfaceMuted", icon: "bag-check-outline" },
  cancelled: { label: "Cancelado", color: "danger", bg: "dangerSoft", icon: "close-circle-outline" },
};

export const formatPrice = (p: number) => "$" + Number(p).toLocaleString("es-AR");

export const paymentLabel = (m: Order["metodo_pago"]) =>
  m === "mp" ? "MercadoPago" : "Efectivo";

// Agrupa por día: "Hoy", "Ayer", "Hace 3 días" y después la fecha
export function groupOrdersByDay(orders: Order[]) {
  const groups: { title: string; data: Order[] }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const order of orders) {
    const day = new Date(order.created_at);
    day.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - day.getTime()) / 86_400_000);

    const title =
      diffDays === 0
        ? "Hoy"
        : diffDays === 1
          ? "Ayer"
          : diffDays < 7
            ? `Hace ${diffDays} días`
            : day.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

    const last = groups[groups.length - 1];
    if (last?.title === title) last.data.push(order);
    else groups.push({ title, data: [order] });
  }
  return groups;
}

// Inicio del día de hace N días (1 = hoy)
export function startOfDaysAgo(dias: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (Math.max(1, dias) - 1));
  return d;
}

// Métricas de ventas. Los cancelados no cuentan como venta.
export function summarizeSales(orders: Pick<Order, "items" | "total" | "metodo_pago" | "created_at" | "estado">[]) {
  const vendidos = orders.filter((o) => o.estado !== "cancelled");
  const facturado = vendidos.reduce((s, o) => s + Number(o.total), 0);
  const productos: Record<string, { unidades: number; facturado: number }> = {};
  const porMetodo: Record<string, number> = {};
  const porHora: Record<string, number> = {};

  for (const o of vendidos) {
    for (const i of o.items ?? []) {
      const p = (productos[i.nombre] ??= { unidades: 0, facturado: 0 });
      p.unidades += i.cantidad;
      p.facturado += i.precio * i.cantidad;
    }
    const metodo = paymentLabel(o.metodo_pago);
    porMetodo[metodo] = (porMetodo[metodo] ?? 0) + 1;
    const hora = `${new Date(o.created_at).getHours()}hs`;
    porHora[hora] = (porHora[hora] ?? 0) + 1;
  }

  const ranking = Object.entries(productos)
    .map(([nombre, v]) => ({ nombre, ...v }))
    .sort((a, b) => b.unidades - a.unidades);
  const horaPico = Object.entries(porHora).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    cantidad_pedidos: vendidos.length,
    cancelados: orders.length - vendidos.length,
    facturado,
    ticket_promedio: vendidos.length ? Math.round(facturado / vendidos.length) : 0,
    ranking,
    pedidos_por_metodo: porMetodo,
    pedidos_por_hora: porHora,
    hora_pico: horaPico,
  };
}
