-- Terravale V2: verified Discord identities, short stable TvUIDs, optional player avatars.
-- The existing authz.is_site_dm() check remains the authoritative DM gate.
create sequence if not exists public.terravale_tvuid_counter as bigint start with 1 increment by 1;
revoke all on sequence public.terravale_tvuid_counter from public, anon, authenticated;

create table if not exists public.terravale_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tvuid text not null unique default ('TV-' || lpad(nextval('public.terravale_tvuid_counter')::text, 3, '0')),
  discord_uid text not null unique,
  discord_username text not null,
  discord_avatar_url text,
  custom_avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint terravale_profiles_discord_uid_digits check (discord_uid ~ '^[0-9]{15,22}$'),
  constraint terravale_profiles_custom_avatar_path check (
    custom_avatar_path is null or
    (custom_avatar_path ~ '^[0-9a-f-]{36}/avatar\.(png|jpg|jpeg|webp)$'
      and split_part(custom_avatar_path, '/', 1) = user_id::text)
  )
);
alter table public.terravale_profiles enable row level security;
revoke all on public.terravale_profiles from public, anon, authenticated;
grant select on public.terravale_profiles to authenticated;
grant update (custom_avatar_path) on public.terravale_profiles to authenticated;

drop policy if exists terravale_profiles_own_or_dm_read on public.terravale_profiles;
create policy terravale_profiles_own_or_dm_read on public.terravale_profiles
  for select to authenticated
  using ((select auth.uid()) = user_id or authz.is_site_dm());

drop policy if exists terravale_profiles_own_avatar_update on public.terravale_profiles;
create policy terravale_profiles_own_avatar_update on public.terravale_profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Provider identity is read server-side; the browser cannot supply another UID or username.
create or replace function public.terravale_sync_discord_profile()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  identity_record record;
  saved public.terravale_profiles;
begin
  if caller is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select i.provider_id as discord_uid,
    coalesce(nullif(i.identity_data->>'name',''),nullif(i.identity_data->>'full_name',''),'Discord user') as discord_username,
    nullif(coalesce(i.identity_data->>'avatar_url',i.identity_data->>'picture',''),'') as discord_avatar_url
  into identity_record from auth.identities i
  where i.user_id=caller and i.provider='discord'
  order by i.updated_at desc nulls last limit 1;
  if not found then raise exception 'Verified Discord sign-in required' using errcode='28000'; end if;

  insert into public.terravale_profiles(user_id,discord_uid,discord_username,discord_avatar_url)
  values(caller,identity_record.discord_uid,identity_record.discord_username,identity_record.discord_avatar_url)
  on conflict(user_id) do update set
    discord_uid=excluded.discord_uid,discord_username=excluded.discord_username,
    discord_avatar_url=excluded.discord_avatar_url,updated_at=now()
  returning * into saved;
  return jsonb_build_object(
    'user_id',saved.user_id,'tvuid',saved.tvuid,
    'discord_uid',saved.discord_uid,'discord_username',saved.discord_username,
    'discord_avatar_url',saved.discord_avatar_url,
    'custom_avatar_path',saved.custom_avatar_path,'is_dm',authz.is_site_dm());
end $$;
revoke all on function public.terravale_sync_discord_profile() from public, anon;
grant execute on function public.terravale_sync_discord_profile() to authenticated;

-- Backfill V1 Discord accounts, preserving any custom photos.
insert into public.terravale_profiles(user_id,discord_uid,discord_username,discord_avatar_url)
select i.user_id,i.provider_id,
  coalesce(nullif(i.identity_data->>'name',''),nullif(i.identity_data->>'full_name',''),'Discord user'),
  nullif(coalesce(i.identity_data->>'avatar_url',i.identity_data->>'picture',''),'')
from auth.identities i where i.provider='discord'
on conflict(user_id) do update set
  discord_username=excluded.discord_username,discord_avatar_url=excluded.discord_avatar_url,
  updated_at=now();

-- Explicitly public player avatars (max 2 MB, jpg/png/webp).
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('terravale-profile-avatars','terravale-profile-avatars',true,2097152,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
drop policy if exists terravale_profile_avatar_select on storage.objects;
create policy terravale_profile_avatar_select on storage.objects for select
  using(bucket_id='terravale-profile-avatars');
drop policy if exists terravale_profile_avatar_insert on storage.objects;
create policy terravale_profile_avatar_insert on storage.objects for insert to authenticated
  with check(bucket_id='terravale-profile-avatars'
    and split_part(name,'/',1)=(select auth.uid())::text
    and name ~ '^[0-9a-f-]{36}/avatar\.(png|jpg|jpeg|webp)$');
drop policy if exists terravale_profile_avatar_update on storage.objects;
create policy terravale_profile_avatar_update on storage.objects for update to authenticated
  using(bucket_id='terravale-profile-avatars' and split_part(name,'/',1)=(select auth.uid())::text)
  with check(bucket_id='terravale-profile-avatars' and split_part(name,'/',1)=(select auth.uid())::text);
drop policy if exists terravale_profile_avatar_delete on storage.objects;
create policy terravale_profile_avatar_delete on storage.objects for delete to authenticated
  using(bucket_id='terravale-profile-avatars' and split_part(name,'/',1)=(select auth.uid())::text);
