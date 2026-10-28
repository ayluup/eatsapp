-- =====================================================================
-- EatsApp - Datos personales del perfil
-- Ejecutar en Supabase > SQL Editor DESPUÉS de 20261028010000_gestion_roles.sql
-- Se puede correr más de una vez.
-- =====================================================================

alter table public.profiles add column if not exists nombre text;

do $$ begin
  alter table public.profiles
    add constraint profiles_nombre_check
    check (nombre is null or char_length(trim(nombre)) between 2 and 60);
exception when duplicate_object then null;
end $$;

-- Al registrarse con Google, el nombre viene en los metadatos de la cuenta
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, email, nombre)
  values (
    new.id,
    'student',
    coalesce(new.email, ''),
    nullif(trim(coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    )), '')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

-- Completar el nombre de los usuarios de Google que ya existían
update public.profiles p
set nombre = trim(coalesce(
  u.raw_user_meta_data ->> 'full_name',
  u.raw_user_meta_data ->> 'name'
))
from auth.users u
where u.id = p.id
  and p.nombre is null
  and char_length(trim(coalesce(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name', ''
  ))) between 2 and 60;
