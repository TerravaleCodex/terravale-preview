-- V2.75 — Source-first, read-only Archive 2 custody. Nothing here grants boons.
-- The original Markdown remains private. Client classification is provisional.
create table if not exists public.terravale_divine_archive_sources(
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  source_set uuid not null,
  source_path text not null check (length(source_path) between 1 and 500),
  source_kind text not null check (source_kind in ('system','collection','single','unclassified')),
  source_markdown text not null check (octet_length(source_markdown) between 1 and 250000),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  uploaded_by uuid not null references auth.users(id),
  uploaded_at timestamptz not null default now(),
  constraint tv275_source_path_unique unique(campaign_id,source_set,source_path)
);
create index if not exists tv275_archive_recent
  on public.terravale_divine_archive_sources(campaign_id,uploaded_at desc);
alter table public.terravale_divine_archive_sources enable row level security;
revoke all on table public.terravale_divine_archive_sources from public,anon,authenticated;

create or replace function public.terravale_divine_dm_source_add(
 target_campaign uuid,target_set uuid,source_path text,source_kind text,source_markdown text
) returns jsonb language plpgsql security definer set search_path=''
as $tv275_add$
declare actor uuid:=(select auth.uid()); digest_hex text; existing_hash text;
begin
 if actor is null or not exists(
  select 1 from auth.identities where user_id=actor and provider='discord'
 ) then raise exception 'Verified Discord required' using errcode='28000';end if;
 if not authz.is_dm(target_campaign) then
  raise exception 'Campaign DM only' using errcode='42501';end if;
 if target_set is null or source_path is null or
  length(source_path) not between 1 and 500 or
  source_path like '/%' or position(E'\\' in source_path)>0 or
  source_path ~ '(^|/)\\.\\.?(/|$)' or
  source_kind not in('system','collection','single','unclassified') or
  source_markdown is null or octet_length(source_markdown) not between 1 and 250000
 then raise exception 'Invalid source document' using errcode='22023';end if;
 digest_hex:=encode(sha256(convert_to(source_markdown,'UTF8')),'hex');
 select content_sha256 into existing_hash
 from public.terravale_divine_archive_sources
 where campaign_id=target_campaign and source_set=target_set and
  terravale_divine_archive_sources.source_path=terravale_divine_dm_source_add.source_path;
 if existing_hash is not null then
  if existing_hash<>digest_hex then
   raise exception 'Source path already exists with different content; use a new archive ID' using errcode='23505';
  end if;
  return jsonb_build_object('stored',true,'unchanged',true,'sha256',digest_hex);
 end if;
 if (select coalesce(sum(octet_length(s.source_markdown)),0)
     from public.terravale_divine_archive_sources s
     where s.campaign_id=target_campaign and s.source_set=target_set)
      + octet_length(source_markdown) > 8000000
 then raise exception 'Archive source set exceeds 8 MB' using errcode='22023';end if;
 insert into public.terravale_divine_archive_sources(
  campaign_id,source_set,source_path,source_kind,source_markdown,content_sha256,uploaded_by
 ) values(target_campaign,target_set,source_path,source_kind,source_markdown,digest_hex,actor)
 on conflict(campaign_id,source_set,source_path) do nothing;
 select content_sha256 into existing_hash
 from public.terravale_divine_archive_sources s
 where s.campaign_id=target_campaign and s.source_set=target_set and s.source_path=terravale_divine_dm_source_add.source_path;
 if existing_hash is distinct from digest_hex then
  raise exception 'Concurrent source conflict; use a fresh archive ID' using errcode='23505';end if;
 return jsonb_build_object('stored',true,'sha256',digest_hex);
end $tv275_add$;
revoke all on function public.terravale_divine_dm_source_add(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.terravale_divine_dm_source_add(uuid,uuid,text,text,text) to authenticated;

create or replace function public.terravale_divine_dm_source_manifest(
 target_campaign uuid
) returns jsonb language plpgsql stable security definer set search_path=''
as $tv275_manifest$
declare actor uuid:=(select auth.uid());
begin
 if actor is null or not exists(
  select 1 from auth.identities where user_id=actor and provider='discord'
 ) or not authz.is_dm(target_campaign)
 then raise exception 'Campaign DM only' using errcode='42501';end if;
 return coalesce((
  select jsonb_agg(jsonb_build_object(
   'id',s.id,'source_set',s.source_set,'path',s.source_path,
   'kind',s.source_kind,'sha256',s.content_sha256,
   'bytes',octet_length(s.source_markdown),'uploaded_at',s.uploaded_at
  ) order by s.uploaded_at desc,s.source_path)
  from public.terravale_divine_archive_sources s
  where s.campaign_id=target_campaign
 ),'[]'::jsonb);
end $tv275_manifest$;
revoke all on function public.terravale_divine_dm_source_manifest(uuid) from public,anon,authenticated;
grant execute on function public.terravale_divine_dm_source_manifest(uuid) to authenticated;

create or replace function public.terravale_divine_dm_source_read(
 target_campaign uuid,target_source uuid
) returns jsonb language plpgsql stable security definer set search_path=''
as $tv275_read$
declare actor uuid:=(select auth.uid()); payload jsonb;
begin
 if actor is null or not exists(
  select 1 from auth.identities where user_id=actor and provider='discord'
 ) or not authz.is_dm(target_campaign)
 then raise exception 'Campaign DM only' using errcode='42501';end if;
 select jsonb_build_object(
   'id',s.id,'path',s.source_path,'kind',s.source_kind,
   'markdown',s.source_markdown,'sha256',s.content_sha256
 ) into payload from public.terravale_divine_archive_sources s
 where s.campaign_id=target_campaign and s.id=target_source;
 if payload is null then raise exception 'Source not found' using errcode='22023';end if;
 return payload;
end $tv275_read$;
revoke all on function public.terravale_divine_dm_source_read(uuid,uuid) from public,anon,authenticated;
grant execute on function public.terravale_divine_dm_source_read(uuid,uuid) to authenticated;
