// Asistente de IA de EatsApp (Supabase Edge Function).
//
// La app manda la conversación y esta función le pregunta a Gemini qué
// hacer. Gemini responde con texto o con llamadas a herramientas
// (functionCall) que ejecuta la app con la sesión del usuario, así RLS
// sigue decidiendo qué puede hacer cada uno. La clave de Gemini nunca
// llega al celular.
//
// Secrets: GEMINI_API_KEY (obligatorio), GEMINI_MODEL (opcional).
import { createClient } from "npm:@supabase/supabase-js@2";

// Flash-Lite responde en ~1 s; gemini-3.8-flash razona más y tarda mucho
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash-lite";
const MAX_CONTENTS = 60;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ---------------- Herramientas ----------------
// Cada una tiene su implementación en src/services/assistant-tools.ts

const buscarProductos = {
  name: "buscar_productos",
  description:
    "Busca productos del menú del kiosco. Usala siempre antes de recomendar o agregar algo: nunca inventes productos, ids ni precios.",
  parameters: {
    type: "OBJECT",
    properties: {
      texto: { type: "STRING", description: "Parte del nombre o descripción" },
      categoria: {
        type: "STRING",
        enum: ["Comida", "Gaseosas", "Bebidas"],
      },
      precio_max: { type: "NUMBER", description: "Precio máximo en pesos" },
    },
  },
};

const studentTools = [
  buscarProductos,
  {
    name: "ver_carrito",
    description: "Muestra lo que el alumno tiene en el carrito y el total.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "agregar_al_carrito",
    description: "Agrega un producto disponible al carrito.",
    parameters: {
      type: "OBJECT",
      properties: {
        producto_id: { type: "INTEGER" },
        cantidad: { type: "INTEGER", description: "Por defecto 1" },
      },
      required: ["producto_id"],
    },
  },
  {
    name: "quitar_del_carrito",
    description: "Saca un producto del carrito (o le resta cantidad).",
    parameters: {
      type: "OBJECT",
      properties: {
        producto_id: { type: "INTEGER" },
        cantidad: {
          type: "INTEGER",
          description: "Cuántas unidades sacar. Sin esto se saca entero.",
        },
      },
      required: ["producto_id"],
    },
  },
  {
    name: "vaciar_carrito",
    description: "Vacía el carrito.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "confirmar_pedido",
    description:
      "Envía al kiosco el pedido con lo que hay en el carrito. Solo después de que el alumno confirme explícitamente el resumen y el método de pago.",
    parameters: {
      type: "OBJECT",
      properties: {
        metodo_pago: { type: "STRING", enum: ["mp", "efectivo"] },
      },
      required: ["metodo_pago"],
    },
  },
  {
    name: "ver_mis_pedidos",
    description: "Lista los pedidos recientes del alumno y su estado.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "cancelar_pedido",
    description:
      "Cancela un pedido del alumno. Solo se puede mientras está pendiente (antes de que el kiosco lo empiece a preparar). Confirmá con el alumno antes.",
    parameters: {
      type: "OBJECT",
      properties: {
        id_pedido: { type: "STRING", description: "Código del pedido, ej. PED-123456" },
      },
      required: ["id_pedido"],
    },
  },
];

const ESTADOS = ["pending", "preparing", "ready", "delivered", "cancelled"];

const adminTools = [
  buscarProductos,
  {
    name: "crear_producto",
    description:
      "Agrega un producto nuevo al menú (sin foto; la foto se carga desde la pantalla Agregar/Editar).",
    parameters: {
      type: "OBJECT",
      properties: {
        nombre: { type: "STRING" },
        descripcion: { type: "STRING" },
        precio: { type: "NUMBER" },
        categoria: { type: "STRING", enum: ["Comida", "Gaseosas", "Bebidas"] },
        disponible: { type: "BOOLEAN", description: "Por defecto true" },
        stock: {
          type: "INTEGER",
          description: "Unidades que hay. Cada pedido las descuenta y en 0 queda sin stock solo. Omitir = sin límite",
        },
      },
      required: ["nombre", "precio", "categoria"],
    },
  },
  {
    name: "editar_producto",
    description:
      "Cambia datos de un producto existente: precio, nombre, descripción, categoría, si está disponible o las unidades en stock.",
    parameters: {
      type: "OBJECT",
      properties: {
        producto_id: { type: "INTEGER" },
        nombre: { type: "STRING" },
        descripcion: { type: "STRING" },
        precio: { type: "NUMBER" },
        categoria: { type: "STRING", enum: ["Comida", "Gaseosas", "Bebidas"] },
        disponible: { type: "BOOLEAN" },
        stock: {
          type: "INTEGER",
          description: "Unidades que hay ahora (reemplaza las anteriores). -1 = sin límite",
        },
      },
      required: ["producto_id"],
    },
  },
  {
    name: "ver_pedidos",
    description: "Lista los pedidos de los últimos días, opcionalmente por estado.",
    parameters: {
      type: "OBJECT",
      properties: {
        estado: { type: "STRING", enum: ESTADOS },
        dias: { type: "INTEGER", description: "Cuántos días atrás (1 = hoy). Por defecto 1" },
      },
    },
  },
  {
    name: "cambiar_estado_pedido",
    description:
      "Cambia el estado de uno o varios pedidos: pending (pendiente), preparing (en preparación), ready (listo), delivered (entregado/retirado) o cancelled (cancelado). Antes de cancelar, confirmá con el admin.",
    parameters: {
      type: "OBJECT",
      properties: {
        ids_pedido: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "Códigos de pedido, ej. PED-123456",
        },
        estado: { type: "STRING", enum: ESTADOS },
      },
      required: ["ids_pedido", "estado"],
    },
  },
  {
    name: "analizar_ventas",
    description:
      "Calcula métricas de ventas: total facturado, cantidad de pedidos, ticket promedio, productos más vendidos, métodos de pago y horarios pico.",
    parameters: {
      type: "OBJECT",
      properties: {
        dias: { type: "INTEGER", description: "Cuántos días atrás (1 = hoy). Por defecto 7" },
      },
    },
  },
];

function systemPrompt(role: string, nombre: string | null, menu: string) {
  const hoy = new Date().toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "full",
    timeStyle: "short",
  });
  const isAdmin = role === "admin" || role === "superadmin";

  return `Sos el asistente de EatsApp, la app del kiosco de la escuela. Hoy es ${hoy}.
Estás hablando con ${nombre ?? "un usuario"}, que es ${isAdmin ? "administrador del kiosco" : "alumno"}.

No sos un chatbot: sos un asistente que ACTÚA dentro de la app usando las herramientas.
- Si te piden algo que se resuelve con una herramienta, usala en vez de explicar cómo hacerlo.
- Podés encadenar varias herramientas, y si son independientes llamalas juntas en el mismo paso.
- Abajo tenés el menú actual con los ids: usalo directamente para recomendar o agregar, sin llamar a buscar_productos.
- Nunca inventes productos, precios, ids ni pedidos: salen del menú de abajo o de las herramientas.
- Si una herramienta devuelve un error, explicalo en simple y proponé una alternativa.
- Respondé en español rioplatense, corto y claro, sin markdown (sin asteriscos ni títulos). Precios con formato $1.500.
${
  isAdmin
    ? `- Ayudás a gestionar el kiosco: cargar y editar productos, cargar unidades en stock (cada pedido las descuenta solo), marcar productos sin stock, avanzar pedidos y analizar ventas.
- Cuando analices ventas, sacá conclusiones útiles (qué conviene reponer, horarios con más demanda), no solo números.
- Antes de crear un producto o cambiar un precio, confirmá los datos con el admin si no los dio todos.`
    : `- Ayudás al alumno a elegir qué comer según lo que pida (presupuesto, antojo, categoría), armar el carrito y hacer el pedido.
- Solo se pueden pedir productos disponibles, y no más unidades de las que quedan.
- Antes de usar confirmar_pedido mostrá el resumen (productos, total) y preguntá el método de pago (MercadoPago o efectivo). Solo confirmalo cuando el alumno diga que sí.`
}

Menú actual:
${menu || "(no hay productos cargados)"}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json({ error: "Falta configurar GEMINI_API_KEY" }, 500);

  // Solo usuarios logueados; el rol sale de la base, no del cliente
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: "No autorizado" }, 401);

  // Perfil y menú en paralelo. El menú va en el prompt para que no tenga
  // que buscar productos antes de cada acción (un viaje menos a Gemini)
  const [{ data: profile }, { data: products }] = await Promise.all([
    supabase.from("profiles").select("role, nombre").eq("id", userData.user.id).single(),
    supabase
      .from("menus")
      .select("id, nombre, precio, categoria, disponible, stock")
      .order("categoria")
      .limit(150),
  ]);
  const role = (profile?.role as string | undefined) ?? "student";
  const isAdmin = role === "admin" || role === "superadmin";
  type Product = {
    id: number;
    nombre: string;
    precio: number;
    categoria: string | null;
    disponible: boolean;
    stock: number | null;
  };
  const menu = ((products ?? []) as Product[])
    .filter((p) => isAdmin || p.disponible)
    .map(
      (p) =>
        `- id ${p.id}: ${p.nombre} | $${p.precio} | ${p.categoria || "Comida"}${p.disponible ? "" : " | SIN STOCK"}${p.disponible && p.stock != null ? ` | quedan ${p.stock}` : ""}`,
    )
    .join("\n");

  let contents: unknown[];
  try {
    ({ contents } = await req.json());
  } catch {
    return json({ error: "Cuerpo inválido" }, 400);
  }
  if (!Array.isArray(contents) || contents.length === 0) {
    return json({ error: "Falta la conversación" }, 400);
  }

  // Recortar historia larga empezando en un mensaje del usuario, para no
  // dejar una respuesta de herramienta sin su llamada
  let history = contents.slice(-MAX_CONTENTS) as {
    role?: string;
    parts?: { text?: string }[];
  }[];
  while (
    history.length > 1 &&
    !(history[0].role === "user" && history[0].parts?.some((p) => p.text))
  ) {
    history = history.slice(1);
  }

  const body = JSON.stringify({
    systemInstruction: {
      parts: [
        {
          text: systemPrompt(role, (profile?.nombre as string | null) ?? null, menu),
        },
      ],
    },
    contents: history,
    tools: [{ functionDeclarations: isAdmin ? adminTools : studentTools }],
  });

  // Gemini a veces devuelve 503/429 o tarda de más por demanda: se corta a
  // los 20 s y se reintenta una vez
  let res: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 800));
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body,
          signal: AbortSignal.timeout(20_000),
        },
      );
    } catch (err) {
      console.error("Gemini sin respuesta:", err);
      res = null;
      continue;
    }
    if (res.status !== 503 && res.status !== 429) break;
  }

  if (!res?.ok) {
    if (res) console.error("Gemini", res.status, await res.text());
    return json(
      {
        error:
          !res || res.status === 429 || res.status === 503
            ? "El asistente está saturado, probá en un rato."
            : "El asistente no pudo responder.",
      },
      502,
    );
  }

  const data = await res.json();
  const content = data.candidates?.[0]?.content;
  if (!content?.parts?.length) {
    return json({ error: "El asistente no pudo responder." }, 502);
  }
  return json({ content: { role: "model", parts: content.parts } });
});
