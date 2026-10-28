-- =====================================================================
-- EatsApp - Foto de perfil (Supabase Storage)
-- Ejecutar en Supabase > SQL Editor DESPUÉS de 20261028020000_perfil.sql
-- Se puede correr más de una vez.
--
-- Cada usuario guarda su foto en avatars/<su id>/...
-- Cualquiera puede verlas (bucket público), pero solo el dueño puede
-- subir, reemplazar o borrar las de su carpeta.
-- =====================================================================

-- Bucket público, máximo 2 MB, solo imágenes
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_select_own" on storage.objects;
drop policy if exists "avatars_insert_own" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;

-- Listar los archivos de la propia carpeta (para borrar fotos viejas)
create policy "avatars_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- URL de la foto en el perfil. Solo puede apuntar a la carpeta del propio
-- usuario dentro del bucket, así nadie pone un link externo cualquiera.
alter table public.profiles add column if not exists avatar_url text;

alter table public.profiles drop constraint if exists profiles_avatar_url_check;
alter table public.profiles
  add constraint profiles_avatar_url_check
  check (
    avatar_url is null
    or position('/storage/v1/object/public/avatars/' || id::text || '/' in avatar_url) > 0
  );
