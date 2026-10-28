-- =====================================================================
-- EatsApp - Roles: student (default), admin y superadmin
-- Ejecutar en Supabase > SQL Editor DESPUÉS de 20261028000000_seguridad_rls.sql
-- Se puede correr más de una vez.
--
--  student    -> todos al registrarse
--  admin      -> gestiona menú y pedidos. Lo asigna el superadmin desde la app
--  superadmin -> todo lo del admin + decide quién es admin.
--                Solo se asigna desde el SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Nuevo rol permitido
-- ---------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'admin', 'superadmin'));

-- ---------------------------------------------------------------------
-- 2. Funciones de permisos
-- ---------------------------------------------------------------------
-- El superadmin también puede hacer todo lo del admin (menú, pedidos)
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'superadmin')
  );
$$;

create or replace function public.is_superadmin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'superadmin'
  );
$$;

-- ---------------------------------------------------------------------
-- 3. Email en el perfil (para que el superadmin vea a quién asigna)
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists email text;

update public.profiles p
set email = coalesce(u.email, '')
from auth.users u
where u.id = p.id and p.email is distinct from coalesce(u.email, '');

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, email) values (new.id, 'student', coalesce(new.email, ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create or replace function public.sync_profile_email()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.sync_profile_email();

-- ---------------------------------------------------------------------
-- 4. Reglas para cambiar roles desde la app
--    (Desde el SQL Editor auth.uid() es null, así que ahí no aplican.)
-- ---------------------------------------------------------------------
create or replace function public.proteger_rol()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.role is distinct from old.role then
    if not public.is_superadmin() then
      raise exception 'Solo el superadmin puede cambiar roles';
    end if;
    if old.role = 'superadmin' or new.role = 'superadmin' then
      raise exception 'El rol superadmin no se puede asignar ni quitar desde la app';
    end if;
  end if;

  if new.email is distinct from old.email then
    raise exception 'El email no se puede modificar desde acá';
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_rol on public.profiles;
create trigger proteger_rol
  before update on public.profiles
  for each row execute function public.proteger_rol();

-- ---------------------------------------------------------------------
-- 5. Políticas de profiles
-- ---------------------------------------------------------------------
-- Ver: el propio perfil; admin y superadmin ven todos
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- Modificar: el propio perfil o el superadmin (el trigger controla el rol)
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_superadmin())
  with check (id = auth.uid() or public.is_superadmin());
