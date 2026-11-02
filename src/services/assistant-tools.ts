// Herramientas que el asistente de IA puede usar dentro de la app.
// Las declaraciones (nombre, descripción, parámetros) están en
// supabase/functions/ai-agent/index.ts; acá está lo que hace cada una.
// Corren con la sesión del usuario, así que RLS limita lo que puede hacer.
import {
  formatPrice,
  Order,
  OrderStatus,
  startOfDaysAgo,
  STATUS_CONFIG,
  summarizeSales,
} from "../constants/orders";
import { CartItem, readCart, writeCart } from "../hooks/useCart";
import { cancelOrder, createOrder, PaymentMethod } from "./orders";
import { supabase } from "./supabase";

type Args = Record<string, any>;

export type ToolContext = { userId: string | undefined; isAdmin: boolean };

// Lo que se muestra en el chat cuando el asistente hace algo. photoFor
// ofrece cargarle la foto a un producto recién creado.
export type ToolResult = {
  result: unknown;
  action?: string;
  photoFor?: { id: number; nombre: string };
};

const statusLabel = (estado: string) =>
  STATUS_CONFIG[estado as OrderStatus]?.label.replace(/[¡!]/g, "") ?? estado;

const daysAgo = (dias: number) => startOfDaysAgo(dias).toISOString();

// Los items de un pedido traen la foto en base64: al modelo solo le
// mandamos lo que necesita
const summarizeItems = (items: CartItem[] | null) =>
  (items ?? []).map((i) => ({ nombre: i.nombre, cantidad: i.cantidad, precio: i.precio }));

async function getProduct(id: number) {
  const { data, error } = await supabase
    .from("menus")
    .select("id, nombre, precio, disponible, stock, imagen_url")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function cartSummary() {
  const items = (await readCart()) ?? [];
  return {
    productos: items.map((i) => ({
      producto_id: i.id,
      nombre: i.nombre,
      cantidad: i.cantidad,
      subtotal: i.precio * i.cantidad,
    })),
    total: items.reduce((s, i) => s + i.precio * i.cantidad, 0),
  };
}

// ---------------- Comunes ----------------

async function buscarProductos(args: Args, ctx: ToolContext): Promise<ToolResult> {
  let query = supabase
    .from("menus")
    .select("id, nombre, descripcion, precio, categoria, disponible, stock")
    .order("nombre");
  if (!ctx.isAdmin) query = query.eq("disponible", true);
  if (args.categoria) query = query.eq("categoria", args.categoria);
  if (args.precio_max) query = query.lte("precio", args.precio_max);
  if (args.texto) {
    const t = String(args.texto).replace(/[%,()]/g, " ");
    query = query.or(`nombre.ilike.%${t}%,descripcion.ilike.%${t}%`);
  }
  const { data, error } = await query.limit(40);
  if (error) throw error;
  return {
    result: { productos: (data ?? []).map((p) => ({ ...p, categoria: p.categoria || "Comida" })) },
  };
}

// ---------------- Alumno ----------------

async function verCarrito(): Promise<ToolResult> {
  return { result: await cartSummary() };
}

async function agregarAlCarrito(args: Args): Promise<ToolResult> {
  const cantidad = Math.max(1, Math.floor(args.cantidad ?? 1));
  const product = await getProduct(Number(args.producto_id));
  if (!product) return { result: { error: "Ese producto no existe" } };
  if (!product.disponible) return { result: { error: `${product.nombre} no está disponible ahora` } };

  const items = (await readCart()) ?? [];
  const existing = items.find((i) => i.id === product.id);
  const enCarrito = existing?.cantidad ?? 0;
  if (product.stock != null && enCarrito + cantidad > product.stock) {
    return {
      result: {
        error: `Quedan ${product.stock} de ${product.nombre} y ya hay ${enCarrito} en el carrito`,
      },
    };
  }
  const next = existing
    ? items.map((i) =>
        i.id === product.id
          ? { ...i, cantidad: i.cantidad + cantidad, stock: product.stock }
          : i,
      )
    : [
        ...items,
        {
          id: product.id,
          nombre: product.nombre,
          precio: product.precio,
          imagen_url: product.imagen_url,
          cantidad,
          stock: product.stock,
        },
      ];
  await writeCart(next);
  return {
    result: { ok: true, carrito: await cartSummary() },
    action: `Agregó ${cantidad}× ${product.nombre} al carrito`,
  };
}

async function quitarDelCarrito(args: Args): Promise<ToolResult> {
  const items = (await readCart()) ?? [];
  const item = items.find((i) => i.id === Number(args.producto_id));
  if (!item) return { result: { error: "Ese producto no está en el carrito" } };

  const quitar = args.cantidad ? Math.floor(args.cantidad) : item.cantidad;
  const next =
    quitar >= item.cantidad
      ? items.filter((i) => i.id !== item.id)
      : items.map((i) => (i.id === item.id ? { ...i, cantidad: i.cantidad - quitar } : i));
  await writeCart(next);
  return {
    result: { ok: true, carrito: await cartSummary() },
    action: `Sacó ${Math.min(quitar, item.cantidad)}× ${item.nombre} del carrito`,
  };
}

async function vaciarCarrito(): Promise<ToolResult> {
  await writeCart([]);
  return { result: { ok: true }, action: "Vació el carrito" };
}

async function confirmarPedido(args: Args, ctx: ToolContext): Promise<ToolResult> {
  const method: PaymentMethod = args.metodo_pago === "mp" ? "mp" : "efectivo";
  const items = (await readCart()) ?? [];
  if (items.length === 0) return { result: { error: "El carrito está vacío" } };

  const { orderId, total } = await createOrder(items, method, ctx.userId);
  await writeCart([]);
  return {
    result: { ok: true, id_pedido: orderId, total, metodo_pago: method },
    action: `Envió el pedido ${orderId} (${formatPrice(total)})`,
  };
}

async function verMisPedidos(_args: Args, ctx: ToolContext): Promise<ToolResult> {
  const { data, error } = await supabase
    .from("pedidos")
    .select("id_pedido, items, total, metodo_pago, estado, created_at")
    .eq("user_id", ctx.userId)
    .eq("oculto_alumno", false)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return {
    result: {
      pedidos: (data ?? []).map((o) => ({
        ...o,
        items: summarizeItems(o.items),
        estado: statusLabel(o.estado),
        se_puede_cancelar: o.estado === "pending",
      })),
    },
  };
}

async function cancelarMiPedido(args: Args): Promise<ToolResult> {
  const id = String(args.id_pedido ?? "").trim();
  if (!id) return { result: { error: "No se indicó el pedido" } };
  await cancelOrder(id);
  return { result: { ok: true, id_pedido: id }, action: `Canceló el pedido ${id}` };
}

// ---------------- Admin ----------------

const CATEGORIES = ["Comida", "Gaseosas", "Bebidas"];

// Unidades en stock: null = sin límite. undefined = dato inválido.
const parseStock = (value: unknown): number | null | undefined => {
  if (value === null || Number(value) === -1) return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
};

async function crearProducto(args: Args): Promise<ToolResult> {
  const nombre = String(args.nombre ?? "").trim();
  const precio = Number(args.precio);
  if (!nombre) return { result: { error: "Falta el nombre" } };
  if (!(precio > 0)) return { result: { error: "El precio tiene que ser mayor a 0" } };
  const stock = args.stock === undefined ? null : parseStock(args.stock);
  if (stock === undefined) return { result: { error: "Las unidades tienen que ser un número entero de 0 o más" } };

  const { data, error } = await supabase
    .from("menus")
    .insert({
      nombre,
      descripcion: args.descripcion?.trim() || null,
      precio,
      categoria: CATEGORIES.includes(args.categoria) ? args.categoria : "Comida",
      disponible: stock === 0 ? false : (args.disponible ?? true),
      stock,
      imagen_url: null,
    })
    .select("id, nombre, precio, categoria, disponible, stock")
    .single();
  if (error) throw error;
  return {
    result: {
      ok: true,
      producto: data,
      nota: "En el chat aparece un botón para que el admin le cargue la foto",
    },
    action: `Creó el producto ${data.nombre} (${formatPrice(data.precio)})`,
    photoFor: { id: data.id, nombre: data.nombre },
  };
}

async function editarProducto(args: Args): Promise<ToolResult> {
  const changes: Record<string, unknown> = {};
  if (args.nombre !== undefined) changes.nombre = String(args.nombre).trim();
  if (args.descripcion !== undefined) changes.descripcion = String(args.descripcion).trim() || null;
  if (args.precio !== undefined) {
    if (!(Number(args.precio) > 0)) return { result: { error: "El precio tiene que ser mayor a 0" } };
    changes.precio = Number(args.precio);
  }
  if (args.categoria !== undefined && CATEGORIES.includes(args.categoria)) changes.categoria = args.categoria;
  if (args.disponible !== undefined) changes.disponible = Boolean(args.disponible);
  if (args.stock !== undefined) {
    const stock = parseStock(args.stock);
    if (stock === undefined) return { result: { error: "Las unidades tienen que ser un número entero de 0 o más" } };
    changes.stock = stock;
    // Si estaba agotado por llegar a 0, al cargar unidades vuelve a estar disponible
    if (stock !== 0 && args.disponible === undefined) {
      const current = await getProduct(Number(args.producto_id));
      if (current?.stock === 0) changes.disponible = true;
    }
  }
  if (Object.keys(changes).length === 0) return { result: { error: "No hay cambios para hacer" } };

  const { data, error } = await supabase
    .from("menus")
    .update(changes)
    .eq("id", Number(args.producto_id))
    .select("id, nombre, precio, categoria, disponible, stock");
  if (error) throw error;
  if (!data?.length) return { result: { error: "Ese producto no existe" } };

  const p = data[0];
  const detalle = [
    changes.precio !== undefined && `precio ${formatPrice(p.precio)}`,
    changes.stock !== undefined && (p.stock == null ? "sin límite de unidades" : `${p.stock} unidades`),
    changes.disponible !== undefined && (p.disponible ? "disponible" : "sin stock"),
    (changes.nombre || changes.descripcion !== undefined || changes.categoria) && "datos",
  ]
    .filter(Boolean)
    .join(", ");
  return { result: { ok: true, producto: p }, action: `Actualizó ${p.nombre}: ${detalle}` };
}

async function verPedidos(args: Args): Promise<ToolResult> {
  let query = supabase
    .from("pedidos")
    .select("id_pedido, items, total, metodo_pago, estado, created_at")
    .gte("created_at", daysAgo(args.dias ?? 1))
    .order("created_at", { ascending: false })
    .limit(50);
  if (args.estado) query = query.eq("estado", args.estado);
  const { data, error } = await query;
  if (error) throw error;
  return {
    result: {
      pedidos: (data ?? []).map((o) => ({ ...o, items: summarizeItems(o.items) })),
    },
  };
}

async function cambiarEstadoPedido(args: Args): Promise<ToolResult> {
  const estado = args.estado as OrderStatus;
  if (!STATUS_CONFIG[estado]) return { result: { error: "Estado inválido" } };
  const ids: string[] = Array.isArray(args.ids_pedido) ? args.ids_pedido : [];
  if (ids.length === 0) return { result: { error: "No se indicó ningún pedido" } };

  const { data, error } = await supabase
    .from("pedidos")
    .update({ estado })
    .in("id_pedido", ids)
    .select("id_pedido");
  if (error) throw error;

  const updated = (data ?? []).map((o) => o.id_pedido as string);
  const missing = ids.filter((id) => !updated.includes(id));
  return {
    result: { ok: true, actualizados: updated, no_encontrados: missing },
    action: updated.length
      ? `Pasó ${updated.length === 1 ? updated[0] : `${updated.length} pedidos`} a "${statusLabel(estado)}"`
      : undefined,
  };
}

async function analizarVentas(args: Args): Promise<ToolResult> {
  const dias = args.dias ?? 7;
  const { data, error } = await supabase
    .from("pedidos")
    .select("items, total, metodo_pago, estado, created_at")
    .gte("created_at", daysAgo(dias))
    .limit(2000);
  if (error) throw error;

  // Mismas métricas que la pantalla Historial y ventas
  const orders = (data ?? []) as Order[];
  const { ranking, ...summary } = summarizeSales(orders);
  const porDia: Record<string, number> = {};
  for (const o of orders) {
    if (o.estado === "cancelled") continue;
    const dia = new Date(o.created_at).toLocaleDateString("es-AR", {
      weekday: "short",
      day: "numeric",
    });
    porDia[dia] = (porDia[dia] ?? 0) + Number(o.total);
  }

  return {
    result: {
      periodo_dias: dias,
      ...summary,
      mas_vendidos: ranking.slice(0, 5),
      menos_vendidos: ranking.slice(-3).reverse(),
      facturado_por_dia: porDia,
    },
  };
}

// ---------------- Registro ----------------

type Tool = (args: Args, ctx: ToolContext) => Promise<ToolResult>;

const studentTools: Record<string, Tool> = {
  buscar_productos: buscarProductos,
  ver_carrito: verCarrito,
  agregar_al_carrito: agregarAlCarrito,
  quitar_del_carrito: quitarDelCarrito,
  vaciar_carrito: vaciarCarrito,
  confirmar_pedido: confirmarPedido,
  ver_mis_pedidos: verMisPedidos,
  cancelar_pedido: cancelarMiPedido,
};

const adminTools: Record<string, Tool> = {
  buscar_productos: buscarProductos,
  crear_producto: crearProducto,
  editar_producto: editarProducto,
  ver_pedidos: verPedidos,
  cambiar_estado_pedido: cambiarEstadoPedido,
  analizar_ventas: analizarVentas,
};

export async function runTool(name: string, args: Args, ctx: ToolContext): Promise<ToolResult> {
  const tool = (ctx.isAdmin ? adminTools : studentTools)[name];
  if (!tool) return { result: { error: `Herramienta desconocida: ${name}` } };
  try {
    return await tool(args ?? {}, ctx);
  } catch (err: any) {
    console.warn(`Error en ${name}:`, err?.message);
    return { result: { error: err?.message ?? "No se pudo completar la acción" } };
  }
}
