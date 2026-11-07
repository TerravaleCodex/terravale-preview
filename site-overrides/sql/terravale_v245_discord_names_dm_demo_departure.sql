
-- V2.45: Discord display names and voluntary demo departure for the system DM.
-- Keep permanent Discord UID and TvUID untouched.
create table if not exists public.terravale_demo_departures (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  left_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);
alter table public.terravale_demo_departures enable row level security;
revoke all on public.terravale_demo_departures from anon, authenticated, public;
grant select on public.terravale_demo_departures to authenticated;
drop policy if exists terravale_demo_departure_select_self on public.terravale_demo_departures;
create policy terravale_demo_departure_select_self
  on public.terravale_demo_departures for select to authenticated
  using (user_id=(select auth.uid()));

-- The demo owner can opt out of both ordinary membership and DM access,
-- without orphaning or deleting the shared system-owned demonstration campaign.
create or replace function authz.is_member(cid uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select (
   exists(select 1 from public.campaigns c
       where c.id=cid and c.owner_id=(select auth.uid()))
   or exists(select 1 from public.campaign_members m
       where m.campaign_id=cid and m.user_id=(select auth.uid()))
 ) and not exists (
   select 1 from public.terravale_demo_departures d
   where d.campaign_id=cid and d.user_id=(select auth.uid())
 );
$$;
create or replace function authz.is_dm(cid uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select authz.is_site_dm()
   and (
     exists(select 1 from public.campaigns c
         where c.id=cid and c.owner_id=(select auth.uid()))
     or exists(select 1 from public.campaign_members m
         where m.campaign_id=cid and m.user_id=(select auth.uid()) and m.role='dm')
   )
   and not exists (
     select 1 from public.terravale_demo_departures d
     where d.campaign_id=cid and d.user_id=(select auth.uid())
   );
$$;

create or replace function public.terravale_leave_campaign(target_campaign uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  caller uuid := (select auth.uid());
  is_demo boolean := false;
  is_owner boolean := false;
  removed_rows integer := 0;
begin
  if caller is null or not exists(
    select 1 from auth.identities where user_id=caller and provider='discord'
  ) then raise exception 'Verified Discord sign-in required' using errcode='28000'; end if;
  select exists(select 1 from public.terravale_system_campaigns
      where campaign_id=target_campaign) into is_demo;
  select exists(select 1 from public.campaigns
      where id=target_campaign and owner_id=caller) into is_owner;
  if is_owner and is_demo then
    insert into public.terravale_demo_departures(campaign_id,user_id)
       values(target_campaign,caller)
       on conflict (campaign_id,user_id) do update set left_at=now();
    delete from public.campaign_members where campaign_id=target_campaign and user_id=caller;
    return jsonb_build_object('left',true,'campaign_id',target_campaign,'is_demo',true,'owner_opted_out',true);
  end if;
  if is_owner then
    raise exception 'Transfer or delete a regular campaign before leaving its ownership'
    using errcode='42501';
  end if;
  delete from public.campaign_members where campaign_id=target_campaign and user_id=caller;
  get diagnostics removed_rows=row_count;
  if removed_rows<>1 then
    raise exception 'You are not a member of this campaign' using errcode='42501';
  end if;
  return jsonb_build_object('left',true,'campaign_id',target_campaign,'is_demo',is_demo,'owner_opted_out',false);
end $$;
revoke all on function public.terravale_leave_campaign(uuid) from public, anon;
grant execute on function public.terravale_leave_campaign(uuid) to authenticated;

create or replace function public.terravale_join_demo_campaign()
returns uuid language plpgsql security definer set search_path=''
as $$
declare
 caller uuid := (select auth.uid());
 demo uuid;
 demo_owner uuid;
begin
 if caller is null or not exists(
    select 1 from auth.identities where user_id=caller and provider='discord'
 ) then raise exception 'Verified Discord login required' using errcode='28000'; end if;
 select c.id,c.owner_id into demo,demo_owner
 from public.terravale_system_campaigns s
 join public.campaigns c on c.id=s.campaign_id
 where s.kind='wayfarers-demo';
 if demo is null then raise exception 'Demo campaign unavailable'; end if;
 delete from public.terravale_demo_departures where campaign_id=demo and user_id=caller;
 if demo_owner<>caller then
   insert into public.campaign_members(campaign_id,user_id,role)
      values(demo,caller,'player') on conflict do nothing;
 end if;
 return demo;
end $$;
revoke all on function public.terravale_join_demo_campaign() from public,anon;
grant execute on function public.terravale_join_demo_campaign() to authenticated;

-- Discord uses a temporary #0 discriminator in some provider identity payloads.
-- Keep provider IDs unchanged, clean only displayed name and directory cache.
create or replace function public.terravale_sync_discord_profile()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  caller uuid := (select auth.uid());
  identity_record record;
  saved public.terravale_profiles;
begin
  if caller is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select i.provider_id as discord_uid,
    regexp_replace(coalesce(nullif(i.identity_data->>'name',''),
                            nullif(i.identity_data->>'full_name',''),'Discord user'),
                   '#0$', '') as discord_username,
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
revoke all on function public.terravale_sync_discord_profile() from public,anon;
grant execute on function public.terravale_sync_discord_profile() to authenticated;
update public.terravale_profiles
  set discord_username=regexp_replace(discord_username,'#0$',''),
      updated_at=now()
  where discord_username ~ '#0$';
