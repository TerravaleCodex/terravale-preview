-- V2 in-site Advertisement Atelier settings. Existing DM-only UPDATE RLS stays in force.
alter table public.site_ad_settings add column if not exists max_ads integer;
alter table public.site_ad_settings add column if not exists chance_percent integer not null default 100;
alter table public.site_ad_settings add column if not exists size_mode text not null default 'large';
alter table public.site_ad_settings add column if not exists position_mode text not null default 'scatter';
alter table public.site_ad_settings add column if not exists auto_dismiss_seconds integer;
alter table public.site_ad_settings add column if not exists repeat_ads boolean not null default false;
alter table public.site_ad_settings add column if not exists coverage text not null default 'all';
alter table public.site_ad_settings add constraint tv_site_ads_max_check check (max_ads is null or (max_ads >= 1 and max_ads <= 1000));
alter table public.site_ad_settings add constraint tv_site_ads_chance_check check (chance_percent between 0 and 100);
alter table public.site_ad_settings add constraint tv_site_ads_size_check check (size_mode in ('balanced','large','huge','mixed'));
alter table public.site_ad_settings add constraint tv_site_ads_position_check check (position_mode in ('scatter','center','corners'));
alter table public.site_ad_settings add constraint tv_site_ads_dismiss_check check (auto_dismiss_seconds is null or (auto_dismiss_seconds between 3 and 3600));
alter table public.site_ad_settings add constraint tv_site_ads_coverage_check check (coverage in ('all','codex','cabinet','dashboard'));
insert into public.site_ad_settings(id,enabled,automatic,interval_seconds,animations,incident_enabled,max_ads,chance_percent,size_mode,position_mode,repeat_ads,coverage)
values(1,false,true,120,true,false,6,100,'large','scatter',false,'all')
on conflict(id) do nothing;
