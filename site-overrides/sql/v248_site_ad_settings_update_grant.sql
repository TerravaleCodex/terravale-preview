-- V2.48: fix Advertisement Atelier permission denied at the SQL privilege layer.
-- Permission to submit an UPDATE is separate from RLS authorization.
-- The pre-existing site_ads_update_dm RLS policy still requires authz.is_site_dm(),
-- and the row is restricted to id=1. No public, INSERT or DELETE grants are added.
grant update on table public.site_ad_settings to authenticated;

do $$
begin
 if not (select relrowsecurity from pg_class where oid='public.site_ad_settings'::regclass) then
   raise exception 'site_ad_settings must keep RLS enabled';
 end if;
 if not exists (
   select 1 from pg_policies where schemaname='public'
     and tablename='site_ad_settings' and cmd='UPDATE'
     and 'authenticated'=any(roles)
     and qual like '%authz.is_site_dm%'
 ) then
   raise exception 'site_ad_settings DM-only UPDATE policy missing';
 end if;
end $$;
