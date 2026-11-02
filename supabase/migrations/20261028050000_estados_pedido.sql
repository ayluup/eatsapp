-- =====================================================================
-- Estados de pedido: entregado y cancelado + pedidos en tiempo real
--
--  pending -> preparing -> ready -> delivered
--     \           \          \
--      `-----------`----------`--> cancelled
--
--  * El admin puede pasar un pedido a cualquier estado (política existente).
--  * El alumno solo puede cancelar SUS pedidos mientras estén "pending",
--    a través de cancelar_pedido() (no tiene permiso de update directo).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Valores permitidos de estado
--    La tabla se creó desde el panel, así que contemplamos los dos casos:
--    columna enum o texto con (o sin) restricción check.
-- ---------------------------------------------------------------------
do $$
declare
  v_type text;
  v_udt text;
  c record;
begin
  select data_type, udt_name into v_type, v_udt
  from information_schema.columns
  where table_schema = 'public' and table_name = 'pedidos' and column_name = 'estado';

  if v_type = 'USER-DEFINED' then
    execute format('alter type public.%I add value if not exists %L', v_udt, 'delivered');
    execute format('alter type public.%I add value if not exists %L', v_udt, 'cancelled');
  else
    -- Borrar cualquier check viejo sobre estado y poner el nuevo
    for c in
      select con.conname
      from pg_constraint con
      join pg_attribute att
        on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
      where con.conrelid = 'public.pedidos'::regclass
        and con.contype = 'c'
        and att.attname = 'estado'
    loop
      execute format('alter table public.pedidos drop constraint %I', c.conname);
    end loop;

    alter table public.pedidos
      add constraint pedidos_estado_check
      check (estado in ('pending', 'preparing', 'ready', 'delivered', 'cancelled'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. El alumno cancela su propio pedido pendiente
-- ---------------------------------------------------------------------
create or replace function public.cancelar_pedido(p_id_pedido text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_estado text;
begin
  select estado::text into v_estado
  from public.pedidos
  where id_pedido = p_id_pedido and user_id = auth.uid();

  if v_estado is null then
    raise exception 'No encontramos ese pedido';
  end if;
  if v_estado <> 'pending' then
    raise exception 'El pedido ya se está preparando y no se puede cancelar';
  end if;

  update public.pedidos set estado = 'cancelled'
  where id_pedido = p_id_pedido and user_id = auth.uid();
end;
$$;

revoke all on function public.cancelar_pedido(text) from public, anon;
grant execute on function public.cancelar_pedido(text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Realtime: los cambios en pedidos llegan al instante a la app.
--    RLS sigue aplicando: cada uno recibe solo los pedidos que puede ver.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pedidos'
  ) then
    alter publication supabase_realtime add table public.pedidos;
  end if;
end $$;
