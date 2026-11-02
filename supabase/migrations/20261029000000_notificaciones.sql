-- =====================================================================
-- Notificaciones push
-- Ejecutar en Supabase > SQL Editor DESPUÉS de 20261028070000_procesos_segundo_plano.sql
-- Se puede correr más de una vez.
--
--  app ──registrar_push_token()──> push_tokens
--  pedidos (insert / cambio de estado) ──trigger──> enviar_push()
--     ──pg_net──> Expo Push ──> celulares
--
--  * Pedido nuevo                       -> admins
--  * En preparación / listo / cancelado -> el alumno
--  * El alumno canceló su pedido        -> admins
--
-- Todo pasa dentro de la base: no hace falta Edge Function ni secretos.
-- Cada usuario puede apagar los avisos con profiles.notificaciones.
-- =====================================================================

create extension if not exists pg_net;

alter table public.profiles
  add column if not exists notificaciones boolean not null default true;

-- ---------------------------------------------------------------------
-- 1. Tokens de cada dispositivo
-- ---------------------------------------------------------------------
create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text,
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- Solo lectura de los propios; se escriben con las funciones de abajo
drop policy if exists "push_tokens_select_own" on public.push_tokens;
create policy "push_tokens_select_own" on public.push_tokens
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Si el celular era de otro usuario, el token pasa al que inició sesión
create or replace function public.registrar_push_token(p_token text, p_platform text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Tenés que iniciar sesión';
  end if;
  if p_token is null or p_token not like 'ExponentPushToken[%]' then
    raise exception 'Token de notificaciones inválido';
  end if;

  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        updated_at = now();
end;
$$;

-- Al cerrar sesión ese celular deja de recibir avisos
create or replace function public.eliminar_push_token(p_token text)
returns void
language sql security definer set search_path = public
as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

revoke all on function public.registrar_push_token(text, text) from public, anon;
revoke all on function public.eliminar_push_token(text) from public, anon;
grant execute on function public.registrar_push_token(text, text) to authenticated;
grant execute on function public.eliminar_push_token(text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Envío a Expo Push (asíncrono: no frena el pedido)
-- ---------------------------------------------------------------------
create or replace function public.enviar_push(
  p_user_ids uuid[], p_title text, p_body text, p_data jsonb
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_messages jsonb;
begin
  select jsonb_agg(jsonb_build_object(
           'to', t.token,
           'title', p_title,
           'body', p_body,
           'data', p_data,
           'sound', 'default',
           'priority', 'high',
           'channelId', 'pedidos'
         ))
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

-- Solo la usan los triggers
revoke all on function public.enviar_push(uuid[], text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Pedido nuevo -> admins
-- ---------------------------------------------------------------------
create or replace function public.notificar_pedido_nuevo()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_admins uuid[];
  v_cliente text;
begin
  select array_agg(id) into v_admins
  from public.profiles
  where role in ('admin', 'superadmin');

  select coalesce(nullif(nombre, ''), split_part(email, '@', 1)) into v_cliente
  from public.profiles where id = new.user_id;

  perform public.enviar_push(
    v_admins,
    '🛎️ Nuevo pedido',
    coalesce(new.id_pedido, 'Pedido') || ' · $' || round(new.total)::text ||
      coalesce(' · ' || v_cliente, ''),
    jsonb_build_object('url', '/(admin)/pedidos', 'pedido', new.id)
  );
  return new;
exception when others then
  -- Un problema con las notificaciones nunca debe impedir crear el pedido
  raise warning 'No se pudo notificar el pedido nuevo: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists notificar_pedido_nuevo on public.pedidos;
create trigger notificar_pedido_nuevo
  after insert on public.pedidos
  for each row execute function public.notificar_pedido_nuevo();

-- ---------------------------------------------------------------------
-- 4. Cambio de estado -> alumno (o admins si canceló el alumno)
--    auth.uid() dice quién hizo el cambio: el alumno, un admin o
--    null cuando lo hizo el cron (cancelar_pedidos_vencidos).
-- ---------------------------------------------------------------------
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
      '❌ Pedido cancelado',
      'El alumno canceló ' || v_pedido || '.',
      jsonb_build_object('url', '/(admin)/pedidos', 'pedido', new.id)
    );
    return new;
  end if;

  case new.estado
    when 'preparing' then
      v_title := '👨‍🍳 Tu pedido está en preparación';
      v_body := v_pedido || ' ya se está preparando.';
    when 'ready' then
      v_title := '✅ ¡Tu pedido está listo!';
      v_body := 'Pasá a retirar ' || v_pedido || ' por el kiosco.';
    when 'cancelled' then
      v_title := '❌ Tu pedido fue cancelado';
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

drop trigger if exists notificar_estado_pedido on public.pedidos;
create trigger notificar_estado_pedido
  after update of estado on public.pedidos
  for each row execute function public.notificar_estado_pedido();
