-- Terravale V2.48 live appearance and repeatable player onboarding.
-- The previous localStorage-only Crimson preference becomes an actual account setting.
create table if not exists public.terravale_user_preferences(
 user_id uuid primary key references auth.users(id) on delete cascade,
 theme text not null default 'classic'
   check(theme in ('classic','shady','zero','night','guildie','verdant','crimson','nullmeridian','gloamglass')),
 crimson_variant text not null default 'velvet' check(crimson_variant in ('velvet','obsidian')),
 tutorial_last_step integer not null default 0 check(tutorial_last_step between 0 and 8),
 tutorial_completed_at timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.terravale_user_preferences enable row level security;
revoke all on public.terravale_user_preferences from public,anon,authenticated;
grant select on public.terravale_user_preferences to authenticated;
drop policy if exists terravale_user_preferences_select on public.terravale_user_preferences;
create policy terravale_user_preferences_select on public.terravale_user_preferences
 for select to authenticated using (user_id=(select auth.uid()));

create or replace function public.terravale_get_user_preferences()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare uid uuid:=(select auth.uid()); prefs public.terravale_user_preferences%rowtype;
begin
 if uid is null or not exists(select 1 from auth.identities where user_id=uid and provider='discord')
 then raise exception 'Verified Discord authentication required' using errcode='28000'; end if;
 insert into public.terravale_user_preferences(user_id) values(uid)
 on conflict(user_id) do nothing;
 select * into prefs from public.terravale_user_preferences where user_id=uid;
 return jsonb_build_object('theme',prefs.theme,'crimson_variant',prefs.crimson_variant,
    'tutorial_last_step',prefs.tutorial_last_step,
    'tutorial_completed',prefs.tutorial_completed_at is not null,
    'updated_at',prefs.updated_at);
end $$;
revoke all on function public.terravale_get_user_preferences() from public,anon;
grant execute on function public.terravale_get_user_preferences() to authenticated;

create or replace function public.terravale_set_user_appearance(new_theme text,new_variant text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare uid uuid:=(select auth.uid()); p public.terravale_user_preferences%rowtype;
begin
 if uid is null or not exists(select 1 from auth.identities where user_id=uid and provider='discord')
 then raise exception 'Verified Discord authentication required' using errcode='28000'; end if;
 if new_theme is null or new_theme not in ('classic','shady','zero','night','guildie','verdant','crimson','nullmeridian','gloamglass')
 then raise exception 'Unknown theme' using errcode='22023'; end if;
 if new_variant not in ('velvet','obsidian') then
 raise exception 'Unknown Crimson Court appearance variant' using errcode='22023'; end if;
 if new_variant='obsidian' and not exists(
   select 1 from public.codex_achievement_unlocks
    where user_id=uid and achievement_key='seeing_red'
 ) then raise exception 'The darker Crimson Court is only available after Seeing Red' using errcode='42501'; end if;
 insert into public.terravale_user_preferences(user_id,theme,crimson_variant,updated_at)
 values(uid,new_theme,new_variant,now())
 on conflict(user_id) do update set
 theme=excluded.theme,crimson_variant=excluded.crimson_variant,updated_at=now()
 returning * into p;
 return jsonb_build_object('theme',p.theme,'crimson_variant',p.crimson_variant,'saved',true);
end $$;
revoke all on function public.terravale_set_user_appearance(text,text) from public,anon;
grant execute on function public.terravale_set_user_appearance(text,text) to authenticated;

create or replace function public.terravale_set_tutorial_progress(new_step integer,finish boolean)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare uid uuid:=(select auth.uid()); rec public.terravale_user_preferences%rowtype;
begin
 if uid is null or not exists(select 1 from auth.identities where user_id=uid and provider='discord')
 then raise exception 'Verified Discord authentication required' using errcode='28000'; end if;
 if new_step is null or new_step<0 or new_step>8 then
 raise exception 'Invalid tutorial step' using errcode='22023'; end if;
 insert into public.terravale_user_preferences(user_id,tutorial_last_step,tutorial_completed_at)
 values(uid,new_step,case when finish then now() else null end)
 on conflict(user_id) do update set
 tutorial_last_step=excluded.tutorial_last_step,
 tutorial_completed_at=case when finish then coalesce(public.terravale_user_preferences.tutorial_completed_at,now())
                         else public.terravale_user_preferences.tutorial_completed_at end,
 updated_at=now()
 returning * into rec;
 return jsonb_build_object('tutorial_last_step',rec.tutorial_last_step,
  'tutorial_completed',rec.tutorial_completed_at is not null);
end $$;
revoke all on function public.terravale_set_tutorial_progress(integer,boolean) from public,anon;
grant execute on function public.terravale_set_tutorial_progress(integer,boolean) to authenticated;
