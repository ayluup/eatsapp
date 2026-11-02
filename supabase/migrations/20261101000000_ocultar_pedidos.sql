-- =====================================================================
-- El alumno elimina pedidos terminados o cancelados de "Mis pedidos"
-- Ejecutar en Supabase > SQL Editor DESPUÉS de 20261030000000_pedidos_livianos.sql
-- Se puede correr más de una vez.
--
-- El pedido no se borra de verdad: se marca oculto_alumno = true y deja
-- de aparecerle al alumno, pero el kiosco lo sigue teniendo en el
-- historial (ventas, estadísticas, asistente).
--
-- IMPORTANTE: la app nueva filtra por oculto_alumno. Hasta correr este
-- archivo, "Mis pedidos" del alumno no carga.
-- =====================================================================

alter table public.pedidos
  add column if not exists oculto_alumno boolean not null default false;

-- Mis pedidos del alumno: user_id = ... and oculto_alumno = false order by created_at desc
create index if not exists pedidos_user_visibles_idx
  on public.pedidos (user_id, created_at desc)
  where not oculto_alumno;

-- Solo SUS pedidos y solo si ya están listos, entregados o cancelados.
-- p_id es texto para no depender del tipo de la columna id.
create or replace function public.ocultar_pedido(p_id text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_estado text;
begin
  select estado::text into v_estado
  from public.pedidos
  where id::text = p_id and user_id = auth.uid();

  if v_estado is null then
    raise exception 'No encontramos ese pedido';
  end if;
  if v_estado not in ('ready', 'delivered', 'cancelled') then
    raise exception 'Solo podés eliminar pedidos listos, entregados o cancelados';
  end if;

  update public.pedidos set oculto_alumno = true
  where id::text = p_id and user_id = auth.uid();
end;
$$;

revoke all on function public.ocultar_pedido(text) from public, anon;
grant execute on function public.ocultar_pedido(text) to authenticated;
