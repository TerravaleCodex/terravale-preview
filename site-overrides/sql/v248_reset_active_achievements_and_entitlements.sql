-- V2.48: reset unfinished achievement progress for all accounts, without
-- erasing earned account-wide achievements, journals, character data, or ad reward.
-- A revision lets every connected browser discard stale locally cached progress.
create table if not exists public.terravale_achievement_revision(
  singleton boolean primary key default true check(singleton),
  revision bigint not null default 1,
  reset_at timestamptz not null default now()
);
alter table public.terravale_achievement_revision enable row level security;
revoke all on public.terravale_achievement_revision from public,anon,authenticated;
insert into public.terravale_achievement_revision(singleton,revision,reset_at)
 values(true,1,now())
 on conflict(singleton) do update set revision=public.terravale_achievement_revision.revision+1,reset_at=now();

create or replace function public.terravale_current_achievement_revision()
returns jsonb language sql stable security definer set search_path=''
as $$
 select jsonb_build_object('revision',revision,'reset_at',reset_at)
 from public.terravale_achievement_revision where singleton=true
 and (select auth.uid()) is not null
 and exists(select 1 from auth.identities i
    where i.user_id=(select auth.uid()) and i.provider='discord')
$$;
revoke all on function public.terravale_current_achievement_revision() from public,anon;
grant execute on function public.terravale_current_achievement_revision() to authenticated;

-- Cosmetic variants still require a real account-scoped achievement.
create or replace function public.terravale_crimson_variant_entitlement()
returns boolean language sql stable security definer set search_path=''
as $$
 select (select auth.uid()) is not null and
 exists(select 1 from auth.identities
    where user_id=(select auth.uid()) and provider='discord')
 and exists(select 1 from public.codex_achievement_unlocks
   where user_id=(select auth.uid()) and achievement_key='seeing_red')
$$;
revoke all on function public.terravale_crimson_variant_entitlement() from public,anon;
grant execute on function public.terravale_crimson_variant_entitlement() to authenticated;

-- These event rows are progress evidence for milestones, NOT the permanent
-- unlocks table. They can be restarted without deleting achievements.
delete from public.codex_achievement_events;
update public.codex_achievement_progress
  set ads_dismissed=case when adblocknt_unlocked_at is null then 0 else 25 end,
      premium_shown=case when adblocknt_unlocked_at is null then false else premium_shown end,
      updated_at=now();
update public.codex_ad_achievements
  set closed_count=case when unlocked_at is null then 0 else 25 end,
      premium_seen=case when unlocked_at is null then false else premium_seen end,
      updated_at=now();
