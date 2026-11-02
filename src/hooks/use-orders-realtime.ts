import { useEffect, useRef } from "react";
import { supabase } from "../services/supabase";

// Avisa cuando se crea o cambia un pedido (Supabase Realtime). RLS decide
// qué pedidos llegan: el admin recibe todos y el alumno solo los suyos.
// Varios cambios seguidos se juntan en un solo aviso.
export function useOrdersRealtime(onChange: () => void, filter?: string) {
  const callback = useRef(onChange);
  useEffect(() => {
    callback.current = onChange;
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel(`pedidos-${filter ?? "todos"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos", ...(filter ? { filter } : {}) },
        () => {
          clearTimeout(timer);
          timer = setTimeout(() => callback.current(), 300);
        },
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [filter]);
}
