-- Permite que cada alumno elimine definitivamente sus propios pedidos
-- cancelados. Admin y superadmin pueden eliminar cualquier pedido cancelado.
grant delete on table public.pedidos to authenticated;

drop policy if exists "pedidos_delete" on public.pedidos;

create policy "pedidos_delete" on public.pedidos
  for delete to authenticated
  using (
    estado::text = 'cancelled'
    and (
      (select public.is_admin())
      or user_id = (select auth.uid())
    )
  );
