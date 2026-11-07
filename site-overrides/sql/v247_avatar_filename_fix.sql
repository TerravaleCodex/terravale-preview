-- Avatar uploads V2.47.
-- The old filename regex escaped dots twice. Replace it with [.] to
-- avoid PostgreSQL string / regex backslash ambiguity.
alter table public.terravale_profiles
  drop constraint if exists terravale_profiles_custom_avatar_path;
alter table public.terravale_profiles
  add constraint terravale_profiles_custom_avatar_path
  check (custom_avatar_path is null or
    (custom_avatar_path ~ '^[0-9a-f-]{36}/avatar(-[0-9a-f-]{36})?[.](png|jpg|jpeg|webp)$'
     and split_part(custom_avatar_path,'/',1)=user_id::text));

drop policy if exists terravale_profile_avatar_insert on storage.objects;
create policy terravale_profile_avatar_insert
  on storage.objects for insert to authenticated
  with check (
   bucket_id='terravale-profile-avatars'
   and split_part(name,'/',1)=(select auth.uid())::text
   and name ~ '^[0-9a-f-]{36}/avatar(-[0-9a-f-]{36})?[.](png|jpg|jpeg|webp)$'
  );
-- UPDATE/SELECT/DELETE policies remain, allowing only the owner to
-- change or remove their own file. The bucket stays public only for reads.
