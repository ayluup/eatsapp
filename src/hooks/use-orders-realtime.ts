import { useEffect, useRef } from "react";
import { supabase } from "../services/supabase";

// Avisa cuando cambia algo en una tabla (Supabase Realtime). RLS decide qué
// filas llegan: cada uno recibe solo los cambios que tiene permiso de ver.
// Varios cambios seguidos se juntan en un solo aviso.
export function useTableRealtime(table: string, onChange: () => void, filter?: string) {
  const callback = useRef(onChange);
  useEffect(() => {
    callback.current = onChange;
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel(`${table}-${filter ?? "todos"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
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
  }, [table, filter]);
}

// Pedidos nuevos o que cambian de estado. El admin recibe todos y el
// alumno solo los suyos.
export function useOrdersRealtime(onChange: () => void, filter?: string) {
  useTableRealtime("pedidos", onChange, filter);
}
