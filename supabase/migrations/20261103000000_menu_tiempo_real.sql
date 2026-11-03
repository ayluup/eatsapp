-- =====================================================================
-- Menú en tiempo real
-- Ejecutar en Supabase > SQL Editor DESPUÉS de 20261102000000_stock_y_eliminar_estudiantes.sql
-- Se puede correr más de una vez.
--
-- Publica los cambios de menus por Realtime. Cuando un alumno compra (el
-- trigger descuenta stock) o el kiosco edita un producto, el menú abierto
-- en los demás celulares se actualiza solo: "¡Quedan 3!", "Agotado", etc.
-- RLS sigue aplicando: solo llegan los cambios que cada uno puede ver.
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'menus'
  ) then
    alter publication supabase_realtime add table public.menus;
  end if;
end $$;
