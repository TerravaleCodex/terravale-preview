-- V2.82 — conservative, editable favour resonance. A suggested interpretation,
-- not a declaration that every deity with different domains is an enemy.
create table if not exists public.terravale_divine_relation_settings(
 campaign_id uuid primary key references public.campaigns(id) on delete cascade,
 enabled boolean not null default true,
 updated_at timestamptz not null default now()
);
create table if not exists public.terravale_divine_relation_links(
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 source_key text not null,
 target_key text not null,
 change_per_trigger smallint not null check(change_per_trigger in(-2,-1,1,2)),
 every_increase smallint not null default 3 check(every_increase between 1 and 10),
 enabled boolean not null default true,
 note text not null default '',
 updated_at timestamptz not null default now(),
 primary key(campaign_id,source_key,target_key),
 check(source_key<>target_key)
);
create table if not exists public.terravale_divine_relation_progress(
 character_id uuid not null references public.characters(id) on delete cascade,
 source_key text not null,
 target_key text not null,
 accumulated smallint not null default 0 check(accumulated between 0 and 9),
 primary key(character_id,source_key,target_key)
);
alter table public.terravale_divine_relation_settings enable row level security;
alter table public.terravale_divine_relation_links enable row level security;
alter table public.terravale_divine_relation_progress enable row level security;
revoke all on public.terravale_divine_relation_settings from public,anon,authenticated;
revoke all on public.terravale_divine_relation_links from public,anon,authenticated;
revoke all on public.terravale_divine_relation_progress from public,anon,authenticated;

-- Defaults are deliberately conservative and contextual. These are play rules
-- a DM can disable/edit, not automatic assertions about canonical hostility.
with suggestions(source_key,target_key,change_per_trigger,every_increase,note) as (
 values
 ('rao','torridae',-1,3,'A peace that prevents a battle may strain the martial court; meaningful deeds decide.'),
 ('torridae','rao',-1,3,'Pursuing victory without negotiated respite may strain peaceful accord.'),
 ('pae','kwaeth',-1,3,'Public revelation and protected secrecy can collide, but secrecy is not inherently evil.'),
 ('kwaeth','pae',-1,3,'A secret kept against independent witness may strain the First Flame.'),
 ('ixi','vaelniv',-1,3,'Destruction without restoration can strain the living balance.'),
 ('vaelniv','ixi',-1,3,'Absolute preservation can conflict with necessary refining fire.'),
 ('pae','coeus',1,3,'Clear revelation can strengthen careful, verifiable knowledge.'),
 ('coeus','pae',1,3,'A genuinely verified discovery may support independent solar witness.'),
 ('pae','rao',1,3,'Open protection and fair surrender may reinforce one another.'),
 ('rao','pae',1,3,'A just peace may strengthen trust in public witness.'),
 ('pae','luna',1,3,'The sources explicitly show sun and moon cooperating rather than being enemies.'),
 ('fjoras','tyrius',1,3,'Safe passages and seafaring have overlapping concerns.'),
 ('amora','eshael',1,3,'Freely chosen bonds and protection of life can reinforce each other.'),
 ('eshael','amora',1,3,'Shelter without possession can nurture freely chosen affection.')
)
insert into public.terravale_divine_relation_links(
 campaign_id,source_key,target_key,change_per_trigger,every_increase,note
)
select c.id,s.source_key,s.target_key,s.change_per_trigger,s.every_increase,s.note
from public.campaigns c cross join suggestions s
where exists(select 1 from public.terravale_divine_patrons p
 where p.campaign_id=c.id and lower(p.key_name)=s.source_key)
and exists(select 1 from public.terravale_divine_patrons p
 where p.campaign_id=c.id and lower(p.key_name)=s.target_key)
on conflict(campaign_id,source_key,target_key) do nothing;

create or replace function public.terravale_divine_dm_relationship_state(
 target_campaign uuid
) returns jsonb language plpgsql stable security definer set search_path=''
as $v282_state$
declare actor uuid:=(select auth.uid());
begin
 if actor is null or not exists(select 1 from auth.identities
  where user_id=actor and provider='discord') or not authz.is_dm(target_campaign) then
   raise exception 'Verified campaign DM only' using errcode='42501';end if;
 return jsonb_build_object(
  'enabled',coalesce((select enabled from public.terravale_divine_relation_settings
   where campaign_id=target_campaign),true),
  'links',coalesce((select jsonb_agg(jsonb_build_object('source',l.source_key,
   'target',l.target_key,'impact',l.change_per_trigger,'every',l.every_increase,
   'enabled',l.enabled,'note',l.note) order by l.source_key,l.target_key)
   from public.terravale_divine_relation_links l where l.campaign_id=target_campaign),
   '[]'::jsonb)
 );
end $v282_state$;
revoke all on function public.terravale_divine_dm_relationship_state(uuid) from public,anon,authenticated;
grant execute on function public.terravale_divine_dm_relationship_state(uuid) to authenticated;

create or replace function public.terravale_divine_dm_relationship_config(
 target_campaign uuid, enable_all boolean default null, source_key text default null,
 target_key text default null, link_enabled boolean default null,
 link_impact smallint default null, link_every smallint default null
) returns jsonb language plpgsql security definer set search_path=''
as $v282_config$
declare actor uuid:=(select auth.uid());from_key text:=lower(trim(coalesce(source_key,'')));
 to_key text:=lower(trim(coalesce(target_key,'')));
begin
 if actor is null or not exists(select 1 from auth.identities
  where user_id=actor and provider='discord') or not authz.is_dm(target_campaign) then
   raise exception 'Verified campaign DM only' using errcode='42501';end if;
 if enable_all is not null then
  insert into public.terravale_divine_relation_settings(campaign_id,enabled)
  values(target_campaign,enable_all) on conflict(campaign_id) do update
  set enabled=excluded.enabled,updated_at=now();
 end if;
 if from_key<>'' or to_key<>'' then
  if from_key='' or to_key='' or from_key=to_key
    or not exists(select 1 from public.terravale_divine_patrons p
      where p.campaign_id=target_campaign and lower(p.key_name)=from_key)
    or not exists(select 1 from public.terravale_divine_patrons p
      where p.campaign_id=target_campaign and lower(p.key_name)=to_key)
    or from_key='nyrha' or to_key='nyrha'
  then raise exception 'Unknown or incompatible conventional-pantheon link' using errcode='22023';end if;
  if link_impact is not null and link_impact not in(-2,-1,1,2) then
   raise exception 'Relationship impact must be -2, -1, +1, or +2' using errcode='22023';end if;
  if link_every is not null and link_every not between 1 and 10 then
   raise exception 'Relationship cadence must be 1 to 10 direct Favour gained' using errcode='22023';end if;
  insert into public.terravale_divine_relation_links(
   campaign_id,source_key,target_key,change_per_trigger,every_increase,enabled,note
  ) values(target_campaign,from_key,to_key,coalesce(link_impact,-1),
   coalesce(link_every,3),coalesce(link_enabled,true),'DM-created relationship')
  on conflict(campaign_id,source_key,target_key) do update set
   change_per_trigger=coalesce(link_impact,public.terravale_divine_relation_links.change_per_trigger),
   every_increase=coalesce(link_every,public.terravale_divine_relation_links.every_increase),
   enabled=coalesce(link_enabled,public.terravale_divine_relation_links.enabled),
   updated_at=now();
 end if;
 return public.terravale_divine_dm_relationship_state(target_campaign);
end $v282_config$;
revoke all on function public.terravale_divine_dm_relationship_config(
 uuid,boolean,text,text,boolean,smallint,smallint) from public,anon,authenticated;
grant execute on function public.terravale_divine_dm_relationship_config(
 uuid,boolean,text,text,boolean,smallint,smallint) to authenticated;

create or replace function public.terravale_divine_dm_set_favour_v282(
 target_character uuid, target_patron uuid, new_score integer,
 reason text default '', apply_links boolean default true
) returns jsonb language plpgsql security definer set search_path=''
as $v282_favour$
declare actor uuid:=(select auth.uid());c public.characters%rowtype;
 source_key text;old_score integer;delta integer;applied jsonb:='[]'::jsonb;
 edge record; prior_target integer;adjusted integer;allowed_upper integer;
 progress_before integer;progress_now integer;hits integer;after_progress integer;
 target_id uuid;
begin
 if actor is null or not exists(select 1 from auth.identities
 where user_id=actor and provider='discord') then
 raise exception 'Discord required' using errcode='28000';end if;
 select * into c from public.characters where id=target_character for update;
 if c.id is null or not authz.is_dm(c.campaign_id) then
 raise exception 'Campaign DM only' using errcode='42501';end if;
 select lower(p.key_name) into source_key from public.terravale_divine_patrons p
 where p.id=target_patron and p.campaign_id=c.campaign_id;
 if source_key is null or source_key='nyrha' or new_score not between -10 and 10 then
  raise exception 'Invalid conventional patron or Favour score' using errcode='22023';end if;
 select f.score into old_score from public.terravale_divine_favour f
 where f.character_id=c.id and f.patron_id=target_patron for update;
 delta:=new_score-coalesce(old_score,0);
 insert into public.terravale_divine_favour(character_id,patron_id,score,edited_by)
 values(c.id,target_patron,new_score,actor)
 on conflict(character_id,patron_id) do update set
 score=excluded.score,edited_by=excluded.edited_by,updated_at=now();
 insert into public.terravale_divine_activity(character_id,actor_id,action,patron_id,
 old_score,new_score,reason)
 values(c.id,actor,'favour',target_patron,old_score,new_score,left(coalesce(reason,''),500));
 if delta>0 and coalesce(apply_links,true)
 and coalesce((select settings.enabled from public.terravale_divine_relation_settings settings
 where settings.campaign_id=c.campaign_id),true) then
  for edge in select l.* from public.terravale_divine_relation_links l
   where l.campaign_id=c.campaign_id and l.source_key=source_key and l.enabled
   order by l.target_key
  loop
   insert into public.terravale_divine_relation_progress(character_id,source_key,
    target_key,accumulated)
   values(c.id,source_key,edge.target_key,0)
   on conflict(character_id,source_key,target_key) do nothing;
   select accumulated into progress_before from public.terravale_divine_relation_progress
   where character_id=c.id and source_key=edge.source_key and target_key=edge.target_key
   for update;
   progress_now:=progress_before+delta;
   hits:=progress_now/edge.every_increase;
   after_progress:=mod(progress_now,edge.every_increase);
   update public.terravale_divine_relation_progress set accumulated=after_progress
   where character_id=c.id and source_key=edge.source_key and target_key=edge.target_key;
   if hits<1 then continue;end if;
   select p.id into target_id from public.terravale_divine_patrons p
    where p.campaign_id=c.campaign_id and lower(p.key_name)=edge.target_key limit 1;
   if target_id is null then continue;end if;
   select f.score into prior_target from public.terravale_divine_favour f
    where f.character_id=c.id and f.patron_id=target_id for update;
   allowed_upper:=case when edge.target_key in('kalma','tyrius','pae') then 2 else 10 end;
   adjusted:=least(allowed_upper,greatest(-10,
    coalesce(prior_target,0)+hits*edge.change_per_trigger));
   -- Indirect resonance cannot touch Greater Three scores already above +2,
   -- and cannot lower a directly recognised Greater God by indirect hostility.
   if edge.target_key in('kalma','tyrius','pae') and coalesce(prior_target,0)>2
   then continue;end if;
   if adjusted=coalesce(prior_target,0) then continue;end if;
   insert into public.terravale_divine_favour(character_id,patron_id,score,edited_by)
   values(c.id,target_id,adjusted,actor)
   on conflict(character_id,patron_id) do update set
    score=excluded.score,edited_by=excluded.edited_by,updated_at=now();
   insert into public.terravale_divine_activity(character_id,actor_id,action,
    patron_id,old_score,new_score,reason)
   values(c.id,actor,'favour_resonance',target_id,prior_target,adjusted,
    left('Linked to '||source_key||': '||edge.note,500));
   applied:=applied||jsonb_build_array(jsonb_build_object(
     'source',source_key,'target',edge.target_key,
     'prior',coalesce(prior_target,0),'score',adjusted,
     'change',adjusted-coalesce(prior_target,0),'note',edge.note));
  end loop;
 end if;
 return jsonb_build_object('saved',true,'score',new_score,'relationships',applied,
  'connections_enabled',coalesce((select enabled from public.terravale_divine_relation_settings
  where campaign_id=c.campaign_id),true));
end $v282_favour$;
revoke all on function public.terravale_divine_dm_set_favour_v282(
 uuid,uuid,integer,text,boolean) from public,anon,authenticated;
grant execute on function public.terravale_divine_dm_set_favour_v282(
 uuid,uuid,integer,text,boolean) to authenticated;
