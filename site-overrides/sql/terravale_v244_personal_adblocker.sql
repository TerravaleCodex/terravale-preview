-- V2.44 account-wide earned personal adblocker: permissioned server-side switch.
create or replace function public.terravale_set_personal_adblocker(desired_enabled boolean)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare caller uuid := (select auth.uid()); record public.codex_ad_achievements;
begin
 if caller is null or not exists(select 1 from auth.identities where user_id=caller and provider='discord')
 then raise exception 'Verified Discord login required' using errcode='28000'; end if;
 select * into record from public.codex_ad_achievements where user_id=caller for update;
 if not found or record.unlocked_at is null then
   raise exception 'Unlock Adblockn’t by closing 25 real advertisements first' using errcode='42501';
 end if;
 update public.codex_ad_achievements
   set adblock_enabled=desired_enabled,updated_at=now()
   where user_id=caller returning * into record;
 insert into public.codex_achievement_progress(user_id,ads_dismissed,adblocknt_unlocked_at,personal_adblocker)
 values(caller,record.closed_count,record.unlocked_at,record.adblock_enabled)
 on conflict(user_id) do update set
   personal_adblocker=excluded.personal_adblocker,
   updated_at=now();
 return jsonb_build_object('unlocked',true,'enabled',record.adblock_enabled,
   'count',record.closed_count);
end $$;
revoke all on function public.terravale_set_personal_adblocker(boolean) from public,anon;
grant execute on function public.terravale_set_personal_adblocker(boolean) to authenticated;