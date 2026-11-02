-- =====================================================================
-- Procesos en segundo plano (pg_cron)
-- Ejecutar en Supabase > SQL Editor DESPUÉS de 20261028050000_estados_pedido.sql
-- Se puede correr más de una vez.
--
-- Corren dentro de la base, aunque nadie tenga la app abierta:
--  * cancelar-pedidos-vencidos: cada 15 min cancela los pedidos que siguen
--    "pending" después de 2 horas (nadie los empezó a preparar).
--    Realtime avisa a la app al instante.
--  * cerrar-dia: todas las noches guarda el resumen de ventas del día
--    en ventas_diarias.
--
-- pg_cron usa hora UTC. Argentina es UTC-3: 02:59 UTC = 23:59 en Argentina.
-- =====================================================================

create extension if not exists pg_cron with schema pg_catalog;

-- ---------------------------------------------------------------------
-- 1. Cancelar pedidos abandonados
-- ---------------------------------------------------------------------
create or replace function public.cancelar_pedidos_vencidos(p_minutos int default 120)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_cantidad int;
begin
  update public.pedidos
  set estado = 'cancelled'
  where estado::text = 'pending'
    and created_at < now() - make_interval(mins => p_minutos);

  get diagnostics v_cantidad = row_count;
  return v_cantidad;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Resumen de ventas por día
-- ---------------------------------------------------------------------
create table if not exists public.ventas_diarias (
  dia date primary key,
  cantidad_pedidos int not null default 0,
  cancelados int not null default 0,
  facturado numeric not null default 0,
  ticket_promedio numeric not null default 0,
  -- [{ "nombre": "Coca Cola", "unidades": 12, "facturado": 18000 }, ...]
  productos jsonb not null default '[]'::jsonb,
  generado_at timestamptz not null default now()
);

alter table public.ventas_diarias enable row level security;

drop policy if exists "ventas_diarias_select" on public.ventas_diarias;
create policy "ventas_diarias_select" on public.ventas_diarias
  for select to authenticated
  using ((select public.is_admin()));
-- Nadie escribe desde la app: solo cerrar_dia() (security definer)

create or replace function public.cerrar_dia(
  p_dia date default (now() at time zone 'America/Argentina/Buenos_Aires')::date
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  with del_dia as (
    select *
    from public.pedidos
    where (created_at at time zone 'America/Argentina/Buenos_Aires')::date = p_dia
  ),
  vendidos as (
    select * from del_dia where estado::text <> 'cancelled'
  ),
  productos as (
    select
      i->>'nombre' as nombre,
      sum((i->>'cantidad')::int) as unidades,
      sum((i->>'precio')::numeric * (i->>'cantidad')::int) as facturado
    from vendidos, jsonb_array_elements(vendidos.items::jsonb) as i
    group by 1
  )
  insert into public.ventas_diarias as v
    (dia, cantidad_pedidos, cancelados, facturado, ticket_promedio, productos, generado_at)
  select
    p_dia,
    (select count(*) from vendidos),
    (select count(*) from del_dia) - (select count(*) from vendidos),
    coalesce((select sum(total) from vendidos), 0),
    coalesce((select round(avg(total)) from vendidos), 0),
    coalesce(
      (select jsonb_agg(
         jsonb_build_object('nombre', nombre, 'unidades', unidades, 'facturado', facturado)
         order by unidades desc)
       from productos),
      '[]'::jsonb
    ),
    now()
  on conflict (dia) do update set
    cantidad_pedidos = excluded.cantidad_pedidos,
    cancelados = excluded.cancelados,
    facturado = excluded.facturado,
    ticket_promedio = excluded.ticket_promedio,
    productos = excluded.productos,
    generado_at = excluded.generado_at;
end;
$$;

-- Solo las corre el cron (usuario postgres), no la app
revoke all on function public.cancelar_pedidos_vencidos(int) from public, anon, authenticated;
revoke all on function public.cerrar_dia(date) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Programación
-- ---------------------------------------------------------------------
select cron.unschedule(jobid)
from cron.job
where jobname in ('cancelar-pedidos-vencidos', 'cerrar-dia');

select cron.schedule(
  'cancelar-pedidos-vencidos',
  '*/15 * * * *',
  $$ select public.cancelar_pedidos_vencidos(120); $$
);

select cron.schedule(
  'cerrar-dia',
  '59 2 * * *',
  $$ select public.cerrar_dia(); $$
);
