-- =====================================================================
-- Rendimiento de pedidos (arregla el "Tardó demasiado" al cargarlos)
--
--  * Las políticas llamaban a auth.uid() e is_admin() por CADA fila.
--    Envueltas en (select ...) Postgres las calcula una sola vez por consulta.
--  * Índices para filtrar por estado y ordenar por fecha sin recorrer
--    toda la tabla.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Políticas de pedidos (mismas reglas, evaluadas una sola vez)
-- ---------------------------------------------------------------------
drop policy if exists "pedidos_select" on public.pedidos;
drop policy if exists "pedidos_insert" on public.pedidos;
drop policy if exists "pedidos_update" on public.pedidos;
drop policy if exists "pedidos_delete" on public.pedidos;

create policy "pedidos_select" on public.pedidos
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "pedidos_insert" on public.pedidos
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "pedidos_update" on public.pedidos
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "pedidos_delete" on public.pedidos
  for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- 2. Índices
-- ---------------------------------------------------------------------
-- Pantalla Pedidos del admin: estado in (...) order by created_at desc
create index if not exists pedidos_estado_created_at_idx
  on public.pedidos (estado, created_at desc);

-- Historial y Mis pedidos: order by created_at desc
create index if not exists pedidos_created_at_idx
  on public.pedidos (created_at desc);

-- Mis pedidos del alumno: user_id = ... order by created_at desc
create index if not exists pedidos_user_id_created_at_idx
  on public.pedidos (user_id, created_at desc);

analyze public.pedidos;
