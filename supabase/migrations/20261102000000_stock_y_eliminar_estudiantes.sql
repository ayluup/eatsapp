  -- =====================================================================
  -- Stock por unidades y eliminar estudiantes
  -- Ejecutar en Supabase > SQL Editor DESPUÉS de 20261101000000_ocultar_pedidos.sql
  -- Se puede correr más de una vez.
  --
  --  1. menus.stock: unidades que quedan de cada producto.
  --     null = sin control de unidades (como hasta ahora).
  --     Cada pedido descuenta sus unidades; al llegar a 0 el producto pasa
  --     solo a "Agotado". Si el pedido se cancela, las unidades vuelven.
  --  2. eliminar_estudiante(): el superadmin borra la cuenta de un alumno.
  --     Sus pedidos quedan en el historial (user_id pasa a null).
  --
  -- IMPORTANTE: la app nueva manda la columna stock al guardar productos.
  -- Hasta correr este archivo, agregar o editar productos da error.
  -- =====================================================================

  -- ---------------------------------------------------------------------
  -- 1. Columna stock
  -- ---------------------------------------------------------------------
  alter table public.menus add column if not exists stock int;

  alter table public.menus drop constraint if exists menus_stock_check;
  alter table public.menus
    add constraint menus_stock_check check (stock is null or stock >= 0);

  -- Sin unidades no puede estar disponible
  create or replace function public.agotar_sin_stock()
  returns trigger
  language plpgsql
  as $$
  begin
    if new.stock = 0 then
      new.disponible := false;
    end if;
    return new;
  end;
  $$;

  drop trigger if exists agotar_sin_stock on public.menus;
  create trigger agotar_sin_stock
    before insert or update on public.menus
    for each row execute function public.agotar_sin_stock();

  -- ---------------------------------------------------------------------
  -- 2. Validación del pedido + descuento de stock
  --    Las filas del menú se bloquean (for update) para que dos alumnos
  --    pidiendo a la vez no se lleven la misma última unidad.
  --    Es un trigger before insert: si el pedido falla, el descuento se
  --    deshace solo con la transacción.
  -- ---------------------------------------------------------------------
  create or replace function public.validar_pedido()
  returns trigger
  language plpgsql security definer set search_path = public
  as $$
  declare
    v_cant_items int;
    v_cant_validos int;
    v_total numeric;
    v_items jsonb;
    v_falta record;
  begin
    if new.items is null
      or jsonb_typeof(new.items::jsonb) <> 'array'
      or jsonb_array_length(new.items::jsonb) = 0 then
      raise exception 'El pedido no tiene productos';
    end if;

    if exists (
      select 1 from jsonb_array_elements(new.items::jsonb) i
      where coalesce((i ->> 'cantidad')::int, 0) < 1
    ) then
      raise exception 'Cantidad inválida en el pedido';
    end if;

    perform 1
    from public.menus m
    where m.id::text in (select i ->> 'id' from jsonb_array_elements(new.items::jsonb) i)
    order by m.id
    for update;

    select
      count(*),
      count(m.id),
      coalesce(sum(m.precio * (i ->> 'cantidad')::int), 0),
      jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'nombre', m.nombre,
          'precio', m.precio,
          'cantidad', (i ->> 'cantidad')::int
        ) order by ord
      ) filter (where m.id is not null)
      into v_cant_items, v_cant_validos, v_total, v_items
    from jsonb_array_elements(new.items::jsonb) with ordinality as e(i, ord)
    left join public.menus m
      on m.id::text = i ->> 'id' and m.disponible;

    if v_cant_validos <> v_cant_items then
      raise exception 'Hay productos que ya no están disponibles';
    end if;

    -- Unidades pedidas por producto (por si el mismo viene en dos renglones)
    select m.nombre, m.stock into v_falta
    from (
      select (i ->> 'id') as id, sum((i ->> 'cantidad')::int) as pedidas
      from jsonb_array_elements(v_items) i
      group by 1
    ) p
    join public.menus m on m.id::text = p.id
    where m.stock is not null and m.stock < p.pedidas
    limit 1;

    if found then
      raise exception 'No hay suficiente stock de %: quedan %', v_falta.nombre, v_falta.stock;
    end if;

    -- Doble toque: el mismo pedido del mismo alumno hace menos de 15 segundos
    if exists (
      select 1 from public.pedidos p
      where p.user_id = auth.uid()
        and p.created_at > now() - interval '15 seconds'
        and p.items::jsonb = v_items
    ) then
      raise exception 'Ya recibimos este pedido. Revisalo en Mis pedidos.';
    end if;

    -- Descontar (agotar_sin_stock lo marca Agotado si llega a 0)
    update public.menus m
    set stock = m.stock - p.pedidas
    from (
      select (i ->> 'id') as id, sum((i ->> 'cantidad')::int) as pedidas
      from jsonb_array_elements(v_items) i
      group by 1
    ) p
    where m.id::text = p.id and m.stock is not null;

    new.items := v_items;
    new.user_id := auth.uid();
    new.estado := 'pending';
    new.total := v_total;
    new.created_at := now();
    return new;
  end;
  $$;

  -- ---------------------------------------------------------------------
  -- 3. Pedido cancelado -> las unidades vuelven al stock
  --    Si el producto estaba agotado por falta de unidades, vuelve a estar
  --    disponible. Si el admin lo había marcado agotado a mano (con stock),
  --    se respeta.
  -- ---------------------------------------------------------------------
  create or replace function public.devolver_stock()
  returns trigger
  language plpgsql security definer set search_path = public
  as $$
  begin
    if new.estado::text <> 'cancelled' or old.estado::text = 'cancelled' then
      return new;
    end if;

    update public.menus m
    set stock = m.stock + p.pedidas,
        disponible = case when m.stock = 0 then true else m.disponible end
    from (
      select (i ->> 'id') as id, sum((i ->> 'cantidad')::int) as pedidas
      from jsonb_array_elements(new.items::jsonb) i
      group by 1
    ) p
    where m.id::text = p.id and m.stock is not null;

    return new;
  end;
  $$;

  drop trigger if exists devolver_stock on public.pedidos;
  create trigger devolver_stock
    after update of estado on public.pedidos
    for each row execute function public.devolver_stock();

  -- ---------------------------------------------------------------------
  -- 4. Eliminar estudiantes (solo el superadmin, solo cuentas student)
  --    * Se borran sus avisos push antes, para no mandarle notificaciones.
  --    * Sus pedidos pendientes se cancelan (y devuelven stock).
  --    * Al borrar auth.users se borra el perfil (on delete cascade) y los
  --      pedidos quedan en el historial con user_id = null.
  -- ---------------------------------------------------------------------
  create or replace function public.eliminar_estudiante(p_user_id uuid)
  returns void
  language plpgsql security definer set search_path = public
  as $$
  declare
    v_role text;
  begin
    if not public.is_superadmin() then
      raise exception 'Solo el superadmin puede eliminar usuarios';
    end if;
    if p_user_id = auth.uid() then
      raise exception 'No podés eliminar tu propia cuenta desde acá';
    end if;

    select role into v_role from public.profiles where id = p_user_id;
    if v_role is null then
      raise exception 'No encontramos ese usuario';
    end if;
    if v_role <> 'student' then
      raise exception 'Solo se pueden eliminar estudiantes. Quitale el rol de admin primero.';
    end if;

    delete from public.push_tokens where user_id = p_user_id;

    update public.pedidos set estado = 'cancelled'
    where user_id = p_user_id and estado::text = 'pending';

    delete from auth.users where id = p_user_id;
  end;
  $$;

  revoke all on function public.eliminar_estudiante(uuid) from public, anon;
  grant execute on function public.eliminar_estudiante(uuid) to authenticated;
