-- Terravale V2.79 — faithful Archive 2 semantic index (private source material).
-- Source entries are NOT grantable boons. Never expose unawarded mechanics to players.
create table if not exists public.terravale_divine_archive_entries(
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 source_set uuid not null,
 source_path text not null,
 source_ordinal integer not null check(source_ordinal between 1 and 300),
 source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
 kind text not null check(kind in(
 'divine','tier_zero','minor_grace','minor_intercession','concordant',
 'nyrha_revision','nyrha_state','nyrha_offer')),
 name text not null check(char_length(name) between 2 and 150),
 source_heading text not null check(char_length(source_heading) between 2 and 200),
 patron text not null check(char_length(patron) between 2 and 100),
 other_patron text,
 tier smallint check(tier between -1 and 5),
 required_favour smallint check(required_favour between 0 and 10),
 required_favour_second smallint check(required_favour_second between 0 and 10),
 slot text,
 activation text,
 uses_text text,
 source_excerpt text not null check(octet_length(source_excerpt) between 1 and 25000),
 review_status text not null default 'source_only' check(review_status='source_only'),
 indexed_at timestamptz not null default now(),
 constraint tv279_archive_entry_identity unique(campaign_id,source_set,source_path,source_ordinal),
 constraint tv279_archive_entry_source_fk
 foreign key(campaign_id,source_set,source_path)
 references public.terravale_divine_archive_sources(campaign_id,source_set,source_path)
 on delete cascade
);
create index if not exists tv279_archive_browse
 on public.terravale_divine_archive_entries(campaign_id,source_set,kind,patron);
alter table public.terravale_divine_archive_entries enable row level security;
revoke all on public.terravale_divine_archive_entries from public,anon,authenticated;

create or replace function public.terravale_divine_dm_index_source_entries(
 target_campaign uuid,target_set uuid,entries jsonb
) returns jsonb language plpgsql security definer set search_path=''
as $tv279_index$
declare actor uuid:=(select auth.uid()); item jsonb;
 src public.terravale_divine_archive_sources%rowtype;
 ord integer;kind_value text;title text;body text;heading text;
 imported integer:=0;scanned integer:=0;
begin
 if actor is null or not exists(select 1 from auth.identities
   where user_id=actor and provider='discord') or not authz.is_dm(target_campaign)
 then raise exception 'Verified campaign DM only' using errcode='42501'; end if;
 if target_set is null or jsonb_typeof(entries)<>'array'
  or jsonb_array_length(entries) not between 1 and 30
  or pg_column_size(entries)>650000 then
  raise exception 'Send 1–30 original-source index entries per batch' using errcode='22023';
 end if;
 for item in select value from jsonb_array_elements(entries) loop
  if jsonb_typeof(item)<>'object' then
   raise exception 'Malformed archive index entry' using errcode='22023'; end if;
  select * into src from public.terravale_divine_archive_sources s
  where s.campaign_id=target_campaign and s.source_set=target_set
    and s.source_path=item->>'source_path';
  if not found or src.content_sha256 is distinct from item->>'source_hash' then
   raise exception 'Missing source or source checksum mismatch' using errcode='22023'; end if;
  ord:=nullif(item->>'source_ordinal','')::integer;
  kind_value:=item->>'kind';
  title:=btrim(coalesce(item->>'title',''));
  heading:=btrim(coalesce(item->>'heading',''));
  body:=coalesce(item->>'mechanics','');
  if ord not between 1 and 300
    or kind_value not in ('divine','tier_zero','minor_grace','minor_intercession',
                         'concordant','nyrha_revision','nyrha_state','nyrha_offer')
    or char_length(title) not between 2 and 150
    or char_length(heading) not between 2 and 200
    or position(heading in src.source_markdown)=0
    or octet_length(body) not between 1 and 25000
    or position(body in src.source_markdown)=0
    or char_length(coalesce(item->>'patron','')) not between 2 and 100
  then raise exception 'Source index is not an exact extract' using errcode='22023'; end if;
  if (kind_value in ('divine','tier_zero') and src.source_path not like '%/Major Gods/%')
    or (kind_value in('minor_grace','minor_intercession') and src.source_path not like '%/Minor Gods/%')
    or (kind_value='concordant' and src.source_path not like '%/Concordant Boons/%')
    or (kind_value like 'nyrha_%' and src.source_path not like '%/Nyrha/%')
  then raise exception 'Source family/path mismatch' using errcode='22023';end if;
  -- The parser is a discovery tool; grant access never flows from these entries.
  insert into public.terravale_divine_archive_entries(
    campaign_id,source_set,source_path,source_ordinal,source_hash,
    kind,name,source_heading,patron,other_patron,tier,
    required_favour,required_favour_second,slot,activation,uses_text,source_excerpt
  ) values(
    target_campaign,target_set,src.source_path,ord,src.content_sha256,
    kind_value,title,heading,btrim(item->>'patron'),
    nullif(btrim(coalesce(item->>'other_patron','')),''),
    nullif(item->>'tier','')::smallint,
    nullif(item->>'required_favour','')::smallint,
    nullif(item->>'required_favour_second','')::smallint,
    nullif(left(coalesce(item->>'slot',''),100),''),
    nullif(left(coalesce(item->>'activation',''),150),''),
    nullif(left(coalesce(item->>'uses_text',''),150),''),
    body
  )
  on conflict(campaign_id,source_set,source_path,source_ordinal) do nothing;
  GET DIAGNOSTICS scanned = ROW_COUNT;
  imported:=imported+scanned;
 end loop;
 return jsonb_build_object('accepted',true,'inserted',imported,
   'batch_size',jsonb_array_length(entries));
end $tv279_index$;
revoke all on function public.terravale_divine_dm_index_source_entries(uuid,uuid,jsonb)
 from public,anon,authenticated;
grant execute on function public.terravale_divine_dm_index_source_entries(uuid,uuid,jsonb)
 to authenticated;

create or replace function public.terravale_divine_dm_archive_list(
 target_campaign uuid,target_set uuid default null, family text default null,
 needle text default null, page_size int default 60, page_offset int default 0
) returns jsonb language plpgsql stable security definer set search_path=''
as $tv279_list$
declare actor uuid:=(select auth.uid()); result jsonb;
begin
 if actor is null or not exists(select 1 from auth.identities
 where user_id=actor and provider='discord') or not authz.is_dm(target_campaign)
 then raise exception 'Verified campaign DM only' using errcode='42501';end if;
 if page_size not between 1 and 100 or page_offset not between 0 and 5000
 then raise exception 'Invalid pagination' using errcode='22023'; end if;
 select jsonb_build_object(
  'total',(select count(*) from public.terravale_divine_archive_entries e
    where e.campaign_id=target_campaign and (target_set is null or e.source_set=target_set)
      and (family is null or family='' or e.kind=family)
      and (needle is null or needle='' or e.name ilike '%'||needle||'%'
           or e.patron ilike '%'||needle||'%')),
  'entries',coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',x.id,'source_set',x.source_set,'source_path',x.source_path,
      'kind',x.kind,'name',x.name,'patron',x.patron,'other_patron',x.other_patron,
      'tier',x.tier,'required_favour',x.required_favour,
      'required_favour_second',x.required_favour_second,
      'slot',x.slot,'activation',x.activation,'uses_text',x.uses_text,
      'review_status',x.review_status
    ) order by x.patron,x.tier,x.name)
    from (select * from public.terravale_divine_archive_entries e
      where e.campaign_id=target_campaign and (target_set is null or e.source_set=target_set)
        and (family is null or family='' or e.kind=family)
        and (needle is null or needle='' or e.name ilike '%'||needle||'%'
             or e.patron ilike '%'||needle||'%')
      order by e.patron,e.tier,e.name limit page_size offset page_offset) x
    ),'[]'::jsonb)
 ) into result;
 return result;
end $tv279_list$;
revoke all on function public.terravale_divine_dm_archive_list(uuid,uuid,text,text,int,int)
 from public,anon,authenticated;
grant execute on function public.terravale_divine_dm_archive_list(uuid,uuid,text,text,int,int)
 to authenticated;

create or replace function public.terravale_divine_dm_archive_read(
 target_campaign uuid,target_entry uuid
) returns jsonb language plpgsql stable security definer set search_path=''
as $tv279_read$
declare actor uuid:=(select auth.uid()); result jsonb;
begin
 if actor is null or not exists(select 1 from auth.identities
 where user_id=actor and provider='discord') or not authz.is_dm(target_campaign)
 then raise exception 'Verified campaign DM only' using errcode='42501';end if;
 select jsonb_build_object(
   'id',e.id,'name',e.name,'kind',e.kind,'tier',e.tier,
   'patron',e.patron,'other_patron',e.other_patron,
   'required_favour',e.required_favour,'required_favour_second',e.required_favour_second,
   'source_path',e.source_path,'source_heading',e.source_heading,
   'slot',e.slot,'activation',e.activation,'uses_text',e.uses_text,
   'original_mechanics',e.source_excerpt,
   'review_status',e.review_status
 ) into result
 from public.terravale_divine_archive_entries e
 where e.campaign_id=target_campaign and e.id=target_entry;
 if result is null then raise exception 'Private source entry not found'
  using errcode='22023';end if;
 return result;
end $tv279_read$;
revoke all on function public.terravale_divine_dm_archive_read(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.terravale_divine_dm_archive_read(uuid,uuid)
 to authenticated;

-- No changes to existing boons/grants. No source is automatically published.
