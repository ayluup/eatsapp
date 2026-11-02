// Ciclo del asistente: manda la conversación a la Edge Function ai-agent,
// ejecuta las herramientas que pide Gemini, le devuelve el resultado y
// repite hasta que responde con texto.
import { FunctionsHttpError } from "@supabase/supabase-js";
import { runTool, ToolContext } from "./assistant-tools";
import { supabase } from "./supabase";

// Formato de Gemini. Las partes del modelo se reenvían tal cual (incluyen
// thoughtSignature, que Gemini necesita para seguir razonando).
export type Part = {
  text?: string;
  thought?: boolean;
  functionCall?: { id?: string; name: string; args?: Record<string, any> };
  functionResponse?: { id?: string; name: string; response: Record<string, unknown> };
  [key: string]: unknown;
};
export type Content = { role: "user" | "model"; parts: Part[] };

// Pasos máximos por mensaje, para que no quede en un bucle
const MAX_STEPS = 8;

async function callAgent(contents: Content[]): Promise<Content> {
  const { data, error } = await supabase.functions.invoke("ai-agent", {
    body: { contents },
  });
  if (error) {
    let message = "No se pudo contactar al asistente. Revisá tu conexión.";
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      if (body?.error) message = body.error;
    }
    throw new Error(message);
  }
  return data.content as Content;
}

export const textOf = (content: Content) =>
  content.parts
    .filter((p) => p.text && !p.thought)
    .map((p) => p.text)
    .join("")
    .trim();

// Lo que se muestra mientras corre cada herramienta
const TOOL_STATUS: Record<string, string> = {
  buscar_productos: "Buscando productos…",
  ver_carrito: "Mirando tu carrito…",
  agregar_al_carrito: "Agregando al carrito…",
  quitar_del_carrito: "Actualizando el carrito…",
  vaciar_carrito: "Vaciando el carrito…",
  confirmar_pedido: "Enviando el pedido…",
  ver_mis_pedidos: "Revisando tus pedidos…",
  cancelar_pedido: "Cancelando el pedido…",
  crear_producto: "Creando el producto…",
  editar_producto: "Actualizando el producto…",
  ver_pedidos: "Revisando los pedidos…",
  cambiar_estado_pedido: "Actualizando pedidos…",
  analizar_ventas: "Analizando las ventas…",
};

// Estas leen y escriben el carrito: en paralelo se pisarían entre sí
const CART_TOOLS = new Set([
  "agregar_al_carrito",
  "quitar_del_carrito",
  "vaciar_carrito",
  "confirmar_pedido",
]);

type Call = NonNullable<Part["functionCall"]>;

export type AssistantAction = { text: string; photoFor?: { id: number; nombre: string } };

// Devuelve la conversación nueva completa. onStatus muestra qué está
// haciendo y onAction cada acción que ya hizo.
export async function sendToAssistant(
  history: Content[],
  ctx: ToolContext,
  onStatus: (status: string) => void,
  onAction: (action: AssistantAction) => void,
) {
  let contents = history;

  for (let step = 0; step < MAX_STEPS; step++) {
    onStatus(step === 0 ? "Pensando…" : "Terminando…");
    const reply = await callAgent(contents);
    contents = [...contents, reply];

    const calls = reply.parts.filter((p) => p.functionCall).map((p) => p.functionCall!);
    if (calls.length === 0) return contents;

    onStatus(TOOL_STATUS[calls[0].name] ?? "Trabajando…");
    const run = async ({ name, args, id }: Call): Promise<Part> => {
      const { result, action, photoFor } = await runTool(name, args ?? {}, ctx);
      if (action) onAction({ text: action, photoFor });
      return { functionResponse: { ...(id ? { id } : {}), name, response: { result } } };
    };

    // Las del carrito en orden, el resto en paralelo; las respuestas van en
    // el mismo orden que las llamadas
    const responses: Part[] = new Array(calls.length);
    const parallel = Promise.all(
      calls.map(async (call, i) => {
        if (!CART_TOOLS.has(call.name)) responses[i] = await run(call);
      }),
    );
    for (const [i, call] of calls.entries()) {
      if (CART_TOOLS.has(call.name)) responses[i] = await run(call);
    }
    await parallel;

    contents = [...contents, { role: "user", parts: responses }];
  }

  throw new Error("El asistente tardó demasiados pasos. Probá pedirlo de otra forma.");
}
