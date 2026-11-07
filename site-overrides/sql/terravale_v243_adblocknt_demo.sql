-- V2.43: Adblockn't progression from real advertisement dismissals.
-- Keep the original 25-dismissal achievement and 20-ad unlock burst.
alter table public.site_ad_settings
  add column if not exists adblocknt_enabled boolean not null default true,
  add column if not exists adblocknt_swarm_enabled boolean not null default true,
  add column if not exists adblocknt_swarm_size integer not null default 20;
alter table public.site_ad_settings
  add constraint tv_site_ads_adblocknt_swarm_size_check check (adblocknt_swarm_size between 0 and 50);
-- Existing DM-only row UPDATE policy secures the new options.
create or replace function public.terravale_register_ad_dismissal()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  caller uuid := (select auth.uid());
  prefs public.site_ad_settings%rowtype;
  progress public.codex_ad_achievements%rowtype;
  just_unlocked boolean := false;
  burst integer := 0;
begin
  if caller is null or not exists(
    select 1 from auth.identities
    where user_id=caller and provider='discord'
  ) then raise exception 'Verified Discord session required' using errcode='28000'; end if;
  select * into prefs from public.site_ad_settings where id=1;
  if not found then raise exception 'Ad settings unavailable'; end if;
  insert into public.codex_ad_achievements(user_id,closed_count)
  values(caller,0) on conflict(user_id) do nothing;
  select * into progress from public.codex_ad_achievements
    where user_id=caller for update;
  if prefs.adblocknt_enabled then
    update public.codex_ad_achievements
      set closed_count=least(2147483647,closed_count+1),updated_at=now()
      where user_id=caller returning * into progress;
    if progress.closed_count>=25 and progress.unlocked_at is null then
      update public.codex_ad_achievements
        set unlocked_at=now(),premium_seen=true,updated_at=now()
        where user_id=caller returning * into progress;
      just_unlocked := true;
      if prefs.adblocknt_swarm_enabled then burst:=prefs.adblocknt_swarm_size; end if;
      insert into public.codex_achievement_unlocks(user_id,achievement_key)
      values(caller,'adblocknt') on conflict do nothing;
    end if;
    insert into public.codex_achievement_progress(user_id,ads_dismissed,adblocknt_unlocked_at,premium_shown)
    values(caller,progress.closed_count,progress.unlocked_at,progress.premium_seen)
    on conflict(user_id) do update set
      ads_dismissed=excluded.ads_dismissed,
      adblocknt_unlocked_at=coalesce(public.codex_achievement_progress.adblocknt_unlocked_at,excluded.adblocknt_unlocked_at),
      premium_shown=(public.codex_achievement_progress.premium_shown or excluded.premium_shown),
      updated_at=now();
  end if;
  return jsonb_build_object(
    'closed_count',progress.closed_count,'unlocked',progress.unlocked_at is not null,
    'just_unlocked',just_unlocked,'burst',burst,
    'enabled',prefs.adblocknt_enabled);
end $$;
revoke all on function public.terravale_register_ad_dismissal() from public,anon;
grant execute on function public.terravale_register_ad_dismissal() to authenticated;
-- Backfill unlock records from prior legitimate accounts, never erase progress.
insert into public.codex_achievement_unlocks(user_id,achievement_key)
select user_id,'adblocknt' from public.codex_ad_achievements
where unlocked_at is not null on conflict do nothing;

-- Public demo campaign is joined through an authenticated server RPC.
create table if not exists public.terravale_system_campaigns (
  kind text primary key,
  campaign_id uuid not null unique references public.campaigns(id) on delete restrict
);
alter table public.terravale_system_campaigns enable row level security;
revoke all on public.terravale_system_campaigns from public,anon,authenticated;
do $$
declare dm uuid; demo uuid;
begin
  select user_id into dm from auth.identities
  where provider='discord' and provider_id='318928301332627456'
  limit 1;
  if dm is null then raise exception 'The verified Terravale DM account is unavailable'; end if;
  select campaign_id into demo from public.terravale_system_campaigns where kind='wayfarers-demo';
  if demo is null then
    insert into public.campaigns(name,description,owner_id)
      values('The Wayfarers’ Table · Demo',
        'A persistent shared demonstration campaign for exploring Terravale. Use invitation code TV-DEMO.',dm)
      returning id into demo;
    insert into public.terravale_system_campaigns(kind,campaign_id)
      values('wayfarers-demo',demo);
  end if;
end $$;
create or replace function public.terravale_join_demo_campaign()
returns uuid language plpgsql security definer set search_path=''
as $$
declare caller uuid := (select auth.uid()); demo uuid;
begin
  if caller is null or not exists(
    select 1 from auth.identities where user_id=caller and provider='discord'
  ) then raise exception 'Verified Discord login required' using errcode='28000'; end if;
  select campaign_id into demo from public.terravale_system_campaigns
    where kind='wayfarers-demo';
  if demo is null then raise exception 'Demo campaign unavailable'; end if;
  insert into public.campaign_members(campaign_id,user_id,role)
    values(demo,caller,'player') on conflict do nothing;
  return demo;
end $$;
revoke all on function public.terravale_join_demo_campaign() from public,anon;
grant execute on function public.terravale_join_demo_campaign() to authenticated;
