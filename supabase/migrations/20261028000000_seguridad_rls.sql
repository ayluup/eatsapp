-- =====================================================================
-- EatsApp - Seguridad: perfiles, roles y Row Level Security (RLS)
-- Ejecutar en Supabase > SQL Editor. Se puede correr más de una vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Perfiles y roles
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'student'
);
alter table public.profiles add column if not exists role text not null default 'student';
alter table public.profiles add column if not exists email text;

do $$ begin
  alter table public.profiles
    add constraint profiles_role_check check (role in ('admin', 'student'));
exception when duplicate_object then null;
end $$;

-- ¿El usuario actual es admin? (security definer evita recursión con RLS)
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Crear el perfil automáticamente al registrarse (siempre como student)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, email)
  values (new.id, 'student', coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usuarios que ya existían sin perfil
insert into public.profiles (id, email)
select id, coalesce(email, '') from auth.users
on conflict (id) do nothing;

-- Un usuario no puede cambiarse el rol a sí mismo desde la app.
-- (Desde el SQL Editor auth.uid() es null, así que ahí sí se puede.)
create or replace function public.proteger_rol()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'No tenés permiso para cambiar el rol';
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_rol on public.profiles;
create trigger proteger_rol
  before update on public.profiles
  for each row execute function public.proteger_rol();

-- ---------------------------------------------------------------------
-- 2. Pedidos vinculados al usuario
-- ---------------------------------------------------------------------
alter table public.pedidos
  add column if not exists user_id uuid references auth.users (id) on delete set null;
alter table public.pedidos alter column session_id drop not null;
create index if not exists pedidos_user_id_idx on public.pedidos (user_id);

-- El servidor decide el dueño, el estado inicial y el total del pedido:
-- el cliente no puede mandar un total manipulado ni productos no disponibles.
create or replace function public.validar_pedido()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_cant_items int;
  v_cant_validos int;
  v_total numeric;
begin
  if new.items is null or jsonb_array_length(new.items::jsonb) = 0 then
    raise exception 'El pedido no tiene productos';
  end if;

  if exists (
    select 1 from jsonb_array_elements(new.items::jsonb) i
    where coalesce((i ->> 'cantidad')::int, 0) < 1
  ) then
    raise exception 'Cantidad inválida en el pedido';
  end if;

  select count(*), count(m.id), coalesce(sum(m.precio * (i ->> 'cantidad')::int), 0)
    into v_cant_items, v_cant_validos, v_total
  from jsonb_array_elements(new.items::jsonb) i
  left join public.menus m
    on m.id::text = i ->> 'id' and m.disponible;

  if v_cant_validos <> v_cant_items then
    raise exception 'Hay productos que ya no están disponibles';
  end if;

  new.user_id := auth.uid();
  new.estado := 'pending';
  new.total := v_total;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists validar_pedido on public.pedidos;
create trigger validar_pedido
  before insert on public.pedidos
  for each row execute function public.validar_pedido();

-- ---------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.menus    enable row level security;
alter table public.pedidos  enable row level security;

-- Borrar políticas anteriores: las políticas se suman con OR, así que una
-- vieja demasiado permisiva anularía todas las de abajo.
do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('profiles', 'menus', 'pedidos')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- profiles: cada uno ve y edita el suyo; el admin ve todos
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles_update" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- menus: todos los logueados leen; solo el admin modifica
create policy "menus_select" on public.menus
  for select to authenticated
  using (true);

create policy "menus_insert" on public.menus
  for insert to authenticated
  with check (public.is_admin());

create policy "menus_update" on public.menus
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "menus_delete" on public.menus
  for delete to authenticated
  using (public.is_admin());

-- pedidos: el estudiante ve y crea solo los suyos; el admin ve y gestiona todos
create policy "pedidos_select" on public.pedidos
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "pedidos_insert" on public.pedidos
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "pedidos_update" on public.pedidos
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "pedidos_delete" on public.pedidos
  for delete to authenticated
  using (public.is_admin());
