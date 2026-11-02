-- =====================================================================
-- Pedidos livianos, sin pedidos repetidos y fotos en Storage
-- Ejecutar en Supabase > SQL Editor DESPUÉS de 20261029000000_notificaciones.sql
-- Se puede correr más de una vez.
--
-- Problema: la foto de cada producto (base64, hasta 700 KB) se copiaba
-- dentro de cada pedido. Un pedido pesaba más de 1 MB, cargar la lista de
-- pedidos bajaba varios MB (de ahí el "Tardó demasiado") y, como guardarlo
-- tardaba, se tocaba el botón de nuevo y se creaban pedidos repetidos.
--
--  1. Bucket "productos" en Storage para las fotos del menú
--  2. Los pedidos guardan solo id, nombre, precio y cantidad
--  3. El servidor rechaza el mismo pedido dos veces seguidas
--  4. Notificaciones sin emojis; al admin le llega solo "Nuevo pedido"
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Fotos de productos: todos las ven, solo el admin las sube o borra
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('productos', 'productos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "productos_insert_admin" on storage.objects;
drop policy if exists "productos_update_admin" on storage.objects;
drop policy if exists "productos_delete_admin" on storage.objects;

create policy "productos_insert_admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'productos' and (select public.is_admin()));

create policy "productos_update_admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'productos' and (select public.is_admin()));

create policy "productos_delete_admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'productos' and (select public.is_admin()));

-- ---------------------------------------------------------------------
-- 2. Sacar las fotos de los pedidos que ya existen
-- ---------------------------------------------------------------------
update public.pedidos p
set items = (
  select jsonb_agg(i - 'imagen_url' order by ord)
  from jsonb_array_elements(p.items::jsonb) with ordinality as e(i, ord)
)
where exists (
  select 1 from jsonb_array_elements(p.items::jsonb) i where i ? 'imagen_url'
);

-- ---------------------------------------------------------------------
-- 3. Validación del pedido
--    Los productos se arman desde el menú (nombre y precio reales), así
--    nunca se guarda nada de más aunque la app mande otra cosa.
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

  -- Doble toque: el mismo pedido del mismo alumno hace menos de 15 segundos
  if exists (
    select 1 from public.pedidos p
    where p.user_id = auth.uid()
      and p.created_at > now() - interval '15 seconds'
      and p.items::jsonb = v_items
  ) then
    raise exception 'Ya recibimos este pedido. Revisalo en Mis pedidos.';
  end if;

  new.items := v_items;
  new.user_id := auth.uid();
  new.estado := 'pending';
  new.total := v_total;
  new.created_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Notificaciones sin emojis
-- ---------------------------------------------------------------------
-- jsonb_strip_nulls: si no hay texto (body null) no se manda el campo
create or replace function public.enviar_push(
  p_user_ids uuid[], p_title text, p_body text, p_data jsonb
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_messages jsonb;
begin
  select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'to', t.token,
           'title', p_title,
           'body', p_body,
           'data', p_data,
           'sound', 'default',
           'priority', 'high',
           'channelId', 'pedidos'
         )))
    into v_messages
  from public.push_tokens t
  join public.profiles p on p.id = t.user_id
  where t.user_id = any (p_user_ids)
    and p.notificaciones;

  if v_messages is null then
    return; -- nadie para avisar
  end if;

  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := v_messages,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Accept', 'application/json'
    )
  );
end;
$$;

revoke all on function public.enviar_push(uuid[], text, text, jsonb) from public, anon, authenticated;

create or replace function public.notificar_pedido_nuevo()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_admins uuid[];
begin
  select array_agg(id) into v_admins
  from public.profiles
  where role in ('admin', 'superadmin');

  perform public.enviar_push(
    v_admins,
    'Nuevo pedido',
    null,
    jsonb_build_object('url', '/(admin)/pedidos', 'pedido', new.id)
  );
  return new;
exception when others then
  -- Un problema con las notificaciones nunca debe impedir crear el pedido
  raise warning 'No se pudo notificar el pedido nuevo: %', sqlerrm;
  return new;
end;
$$;

create or replace function public.notificar_estado_pedido()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_pedido text := coalesce(new.id_pedido, 'Tu pedido');
  v_title text;
  v_body text;
  v_admins uuid[];
begin
  if new.estado is not distinct from old.estado or new.user_id is null then
    return new;
  end if;

  if new.estado = 'cancelled' and auth.uid() = new.user_id then
    select array_agg(id) into v_admins
    from public.profiles
    where role in ('admin', 'superadmin');

    perform public.enviar_push(
      v_admins,
      'Pedido cancelado',
      'El alumno canceló ' || v_pedido || '.',
      jsonb_build_object('url', '/(admin)/pedidos', 'pedido', new.id)
    );
    return new;
  end if;

  case new.estado
    when 'preparing' then
      v_title := 'Tu pedido está en preparación';
      v_body := v_pedido || ' ya se está preparando.';
    when 'ready' then
      v_title := '¡Tu pedido está listo!';
      v_body := 'Pasá a retirar ' || v_pedido || ' por el kiosco.';
    when 'cancelled' then
      v_title := 'Tu pedido fue cancelado';
      v_body := case
        when auth.uid() is null
          then v_pedido || ' se canceló porque nadie lo empezó a preparar a tiempo.'
        else 'El kiosco canceló ' || v_pedido || '.'
      end;
    else
      -- delivered: lo entregan en mano, no hace falta avisar
      return new;
  end case;

  perform public.enviar_push(
    array[new.user_id],
    v_title,
    v_body,
    jsonb_build_object('url', '/(student)/mis-pedidos', 'pedido', new.id)
  );
  return new;
exception when others then
  raise warning 'No se pudo notificar el cambio de estado: %', sqlerrm;
  return new;
end;
$$;
