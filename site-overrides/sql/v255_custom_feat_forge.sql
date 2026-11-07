-- Terravale V2.55: per-campaign DM-authored custom feats and audited grants.
-- Publishing or granting a feat never rewrites a character's approved build.
create table if not exists public.terravale_dm_custom_feats(
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 created_by uuid not null references auth.users(id),
 name text not null check(length(name) between 1 and 120),
 short_description text not null default '',
 prerequisites text not null default '',
 rules_text text not null default '',
 action_type text not null default 'passive',
 uses_per_rest integer not null default 0 check(uses_per_rest between 0 and 100),
 recovery text not null default 'manual',
 minimum_level integer not null default 1 check(minimum_level between 1 and 20),
 rarity text not null default 'Custom',
 state text not null default 'ready' check(state in ('draft','ready','archived')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists tv55_feat_campaign_idx
 on public.terravale_dm_custom_feats(campaign_id,created_at desc);
alter table public.terravale_dm_custom_feats enable row level security;
revoke all on public.terravale_dm_custom_feats from anon,authenticated;
grant select on public.terravale_dm_custom_feats to authenticated;
create table if not exists public.terravale_character_custom_feats(
 id uuid primary key default gen_random_uuid(),
 feat_id uuid not null references public.terravale_dm_custom_feats(id) on delete restrict,
 character_id uuid not null references public.characters(id) on delete cascade,
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 granted_by uuid not null references auth.users(id),
 status text not null default 'active' check(status in ('active','revoked')),
 grant_note text not null default '',
 granted_at timestamptz not null default now(),
 revoked_at timestamptz,
 revoked_by uuid references auth.users(id),
 revoke_reason text not null default ''
);
create unique index if not exists tv55_unique_active_feat
 on public.terravale_character_custom_feats(feat_id,character_id) where status='active';
create index if not exists tv55_character_feat_idx on public.terravale_character_custom_feats(character_id,status);
alter table public.terravale_character_custom_feats enable row level security;
revoke all on public.terravale_character_custom_feats from anon,authenticated;
grant select on public.terravale_character_custom_feats to authenticated;
drop policy if exists tv55_character_feat_read on public.terravale_character_custom_feats;
create policy tv55_character_feat_read on public.terravale_character_custom_feats
 for select to authenticated using(
  authz.is_dm(campaign_id) or
  exists(select 1 from public.characters c
   where c.id=character_id and c.owner_id=(select auth.uid()))
);

drop policy if exists tv55_feat_read on public.terravale_dm_custom_feats;
create policy tv55_feat_read on public.terravale_dm_custom_feats
 for select to authenticated using(
 authz.is_dm(campaign_id) or
 exists(select 1 from public.terravale_character_custom_feats g
 join public.characters c on c.id=g.character_id
 where g.feat_id=terravale_dm_custom_feats.id and g.status='active'
 and c.owner_id=(select auth.uid()))
);

create or replace function public.terravale_dm_save_custom_feat(
 target_campaign uuid,existing_feat uuid,feat_spec jsonb,
 delete_feat boolean default false
) returns jsonb language plpgsql security definer set search_path=''
as $v255featsave$
declare caller uuid:=(select auth.uid()); feat_id uuid;
 feat_name text;summary text;req text;rules text;action_name text;
 recover text;rarity_label text;minlevel integer;uses integer;feat_state text;
begin
 if caller is null or not exists(select 1 from auth.identities
  where user_id=caller and provider='discord') then
  raise exception 'Verified Discord required' using errcode='28000';end if;
 if not authz.is_dm(target_campaign) then
  raise exception 'Only the campaign DM can create custom feats' using errcode='42501';end if;
 if existing_feat is not null and not exists(
  select 1 from public.terravale_dm_custom_feats f
  where f.id=existing_feat and f.campaign_id=target_campaign)
 then raise exception 'Custom feat not found in this campaign' using errcode='22023';end if;
 if delete_feat then
  if existing_feat is null then raise exception 'Select a feat to archive' using errcode='22023';end if;
  update public.terravale_dm_custom_feats set state='archived',updated_at=now()
   where id=existing_feat returning id into feat_id;
  return jsonb_build_object('archived',true,'id',feat_id);
 end if;
 if jsonb_typeof(feat_spec)<>'object' or pg_column_size(feat_spec)>14000 then
  raise exception 'Invalid feat data' using errcode='22023';end if;
 feat_name:=btrim(coalesce(feat_spec->>'name',''));
 summary:=btrim(coalesce(feat_spec->>'short_description',''));
 req:=btrim(coalesce(feat_spec->>'prerequisites',''));
 rules:=btrim(coalesce(feat_spec->>'rules_text',''));
 action_name:=coalesce(feat_spec->>'action_type','passive');
 recover:=coalesce(feat_spec->>'recovery','manual');
 rarity_label:=btrim(coalesce(feat_spec->>'rarity','Custom'));
 feat_state:=coalesce(feat_spec->>'state','ready');
 if length(feat_name) not between 1 and 120 or length(summary)>600
  or length(req)>1200 or length(rules)>7000 or length(rarity_label)>60 then
  raise exception 'Custom feat text exceeds limits' using errcode='22023';end if;
 if action_name not in('passive','action','bonus action','reaction','special')
  or recover not in('manual','short','long','dawn','none')
  or feat_state not in('draft','ready') then
  raise exception 'Unsupported feat action, recovery or state' using errcode='22023';end if;
 if coalesce(feat_spec->>'minimum_level','1') !~ '^[0-9]{1,2}$' or
  coalesce(feat_spec->>'uses_per_rest','0') !~ '^[0-9]{1,3}$' then
  raise exception 'Invalid feat level or uses' using errcode='22023';end if;
 minlevel:=(coalesce(feat_spec->>'minimum_level','1'))::int;
 uses:=(coalesce(feat_spec->>'uses_per_rest','0'))::int;
 if minlevel not between 1 and 20 or uses not between 0 and 100 then
  raise exception 'Feat level or uses outside limits' using errcode='22023';end if;
 if existing_feat is null then
  if (select count(*) from public.terravale_dm_custom_feats
   where campaign_id=target_campaign and state<>'archived')>=500 then
   raise exception 'You have reached 500 prepared feats in this campaign' using errcode='22023';end if;
  insert into public.terravale_dm_custom_feats(
   campaign_id,created_by,name,short_description,prerequisites,rules_text,
   action_type,uses_per_rest,recovery,minimum_level,rarity,state)
  values(target_campaign,caller,feat_name,summary,req,rules,action_name,
   uses,recover,minlevel,rarity_label,feat_state) returning id into feat_id;
 else
  update public.terravale_dm_custom_feats set
   name=feat_name,short_description=summary,prerequisites=req,rules_text=rules,
   action_type=action_name,uses_per_rest=uses,recovery=recover,
   minimum_level=minlevel,rarity=rarity_label,state=feat_state,updated_at=now()
  where id=existing_feat returning id into feat_id;
 end if;
 return jsonb_build_object('saved',true,'id',feat_id);
end;
$v255featsave$;
revoke all on function public.terravale_dm_save_custom_feat(uuid,uuid,jsonb,boolean) from public,anon;
grant execute on function public.terravale_dm_save_custom_feat(uuid,uuid,jsonb,boolean) to authenticated;

create or replace function public.terravale_dm_assign_custom_feat(
 target_feat uuid,target_character uuid,grant_feat boolean default true,
 reason text default ''
) returns jsonb language plpgsql security definer set search_path=''
as $v255featgrant$
declare caller uuid:=(select auth.uid());f public.terravale_dm_custom_feats%rowtype;
 c public.characters%rowtype; gid uuid; effected integer;
begin
 if caller is null or not exists(select 1 from auth.identities
  where user_id=caller and provider='discord') then
  raise exception 'Verified Discord required' using errcode='28000';end if;
 select * into f from public.terravale_dm_custom_feats where id=target_feat;
 select * into c from public.characters where id=target_character;
 if f.id is null or c.id is null or c.campaign_id<>f.campaign_id or not authz.is_dm(c.campaign_id) then
  raise exception 'Only this campaign DM may grant or revoke its feats' using errcode='42501';end if;
 if grant_feat then
  if f.state<>'ready' then raise exception 'Publish this feat before assigning it' using errcode='22023';end if;
  if coalesce((c.approved_build->>'level')::integer,1)<f.minimum_level then
   raise exception 'Character does not meet feat minimum level' using errcode='22023';end if;
  if exists(select 1 from public.terravale_character_custom_feats
    where feat_id=f.id and character_id=c.id and status='active') then
   raise exception 'Character already has this feat' using errcode='22023';end if;
  insert into public.terravale_character_custom_feats(
   feat_id,character_id,campaign_id,granted_by,grant_note)
  values(f.id,c.id,c.campaign_id,caller,left(coalesce(reason,''),250))
  returning id into gid;
  return jsonb_build_object('granted',true,'assignment_id',gid,'feat_id',f.id,'character_id',c.id);
 else
  update public.terravale_character_custom_feats
   set status='revoked',revoked_at=now(),revoked_by=caller,
       revoke_reason=left(coalesce(reason,''),250)
   where feat_id=f.id and character_id=c.id and status='active' returning id into gid;
  if gid is null then raise exception 'Character does not currently have this feat' using errcode='22023';end if;
  return jsonb_build_object('revoked',true,'assignment_id',gid);
 end if;
end;
$v255featgrant$;
revoke all on function public.terravale_dm_assign_custom_feat(uuid,uuid,boolean,text) from public,anon;
grant execute on function public.terravale_dm_assign_custom_feat(uuid,uuid,boolean,text) to authenticated;
