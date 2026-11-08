-- Terravale V2.70 · Divine Favour and Boons
-- Additive migration. All unpublished boon mechanics remain hidden behind
-- DM-only security-definer RPCs; players receive only their active grants.
-- Three canonical groups: Divine, Minor God, Concordant.
begin;
create table if not exists public.terravale_divine_patrons (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 key_name text not null check (key_name ~ '^[a-z0-9-]{2,60}$'),
 name text not null check (char_length(name) between 2 and 100),
 rank text not null check (rank in ('greater','major','minor')),
 public_hint text not null default '' check (char_length(public_hint)<=500),
 created_at timestamptz not null default now(),
 unique(campaign_id,key_name),
 unique(campaign_id,id)
);
create table if not exists public.terravale_divine_favour (
 character_id uuid not null references public.characters(id) on delete cascade,
 patron_id uuid not null references public.terravale_divine_patrons(id) on delete cascade,
 score integer not null default 0 check (score between -10 and 10),
 private_note text not null default '' check (char_length(private_note)<=1200),
 edited_by uuid references auth.users(id),
 updated_at timestamptz not null default now(),
 primary key(character_id,patron_id)
);
create table if not exists public.terravale_dm_divine_boons (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 patron_id uuid not null references public.terravale_divine_patrons(id),
 second_patron_id uuid references public.terravale_divine_patrons(id),
 kind text not null check (kind in ('divine','minor','concordant')),
 name text not null check (char_length(name) between 2 and 130),
 summary text not null default '' check (char_length(summary)<=1200),
 mechanics text not null default '' check (char_length(mechanics)<=10000),
 required_favour integer not null check (required_favour between 1 and 10),
 state text not null default 'draft' check (state in ('draft','ready','archived')),
 updated_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 check ((kind='concordant' and second_patron_id is not null and patron_id<>second_patron_id)
   or (kind<>'concordant' and second_patron_id is null))
);
create table if not exists public.terravale_character_divine_boons (
 id uuid primary key default gen_random_uuid(),
 character_id uuid not null references public.characters(id) on delete cascade,
 boon_id uuid not null references public.terravale_dm_divine_boons(id),
 granted_by uuid not null references auth.users(id),
 granted_at timestamptz not null default now(),
 grant_reason text not null default '' check (char_length(grant_reason)<=500),
 status text not null default 'active' check (status in ('active','revoked')),
 revoked_at timestamptz,
 revoked_by uuid references auth.users(id),
 revoke_reason text
);
create unique index if not exists tv270_active_grant_unique
on public.terravale_character_divine_boons(character_id,boon_id)
where status='active';
create index if not exists tv270_grants_character on public.terravale_character_divine_boons(character_id,status);
create table if not exists public.terravale_divine_activity (
 id bigint generated always as identity primary key,
 character_id uuid not null references public.characters(id) on delete cascade,
 actor_id uuid not null references auth.users(id),
 action text not null check(action in ('favour','grant','revoke')),
 patron_id uuid references public.terravale_divine_patrons(id),
 boon_id uuid references public.terravale_dm_divine_boons(id),
 old_score integer,
 new_score integer,
 reason text not null default '',
 created_at timestamptz not null default now()
);
create index if not exists tv270_activity_character on public.terravale_divine_activity(character_id,created_at desc);
-- No direct API table visibility at all. RPCs below intentionally expose
-- narrowly scoped views, never unearned boon names, requirements, or mechanics.
alter table public.terravale_divine_patrons enable row level security;
alter table public.terravale_divine_favour enable row level security;
alter table public.terravale_dm_divine_boons enable row level security;
alter table public.terravale_character_divine_boons enable row level security;
alter table public.terravale_divine_activity enable row level security;
revoke all on public.terravale_divine_patrons from public,anon,authenticated;
revoke all on public.terravale_divine_favour from public,anon,authenticated;
revoke all on public.terravale_dm_divine_boons from public,anon,authenticated;
revoke all on public.terravale_character_divine_boons from public,anon,authenticated;
revoke all on public.terravale_divine_activity from public,anon,authenticated;
revoke all on sequence public.terravale_divine_activity_id_seq from public,anon,authenticated;

-- Public-safe patron cards + active boons only. Non-owners may see awarded
-- boons on an explicitly shared approved character, but never favour scores.
create or replace function public.terravale_divine_player_state(target_character uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=(select auth.uid()); c public.characters%rowtype; show_scores boolean; result jsonb;
begin
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord') then
  raise exception 'Verified Discord required' using errcode='28000';end if;
 select * into c from public.characters where id=target_character;
 if c.id is null or not authz.is_member(c.campaign_id) then
  raise exception 'Character unavailable' using errcode='42501';end if;
 show_scores:=c.owner_id=actor or authz.is_dm(c.campaign_id);
 if not show_scores and not (c.status='approved' and coalesce((to_jsonb(c)->>'sheet_visible_to_party')::boolean,false)) then
  raise exception 'Character not shared' using errcode='42501';end if;
 select jsonb_build_object(
  'previews',coalesce((select jsonb_agg(jsonb_build_object(
    'key',p.key_name,'name',p.name,'rank',p.rank,'hint',p.public_hint)
    order by p.name) from public.terravale_divine_patrons p
    where p.campaign_id=c.campaign_id and p.rank in('major','greater')),'[]'::jsonb),
  'favour',case when show_scores then
   coalesce((select jsonb_agg(jsonb_build_object(
     'key',p.key_name,'name',p.name,'rank',p.rank,'score',f.score)
      order by p.name)
     from public.terravale_divine_favour f join public.terravale_divine_patrons p
      on p.id=f.patron_id where f.character_id=c.id),'[]'::jsonb)
   else '[]'::jsonb end,
  'granted',coalesce((select jsonb_agg(jsonb_build_object(
    'id',g.id,'name',b.name,'kind',b.kind,'summary',b.summary,
    'mechanics',b.mechanics,'patron',p.name,'other_patron',q.name,
    'granted_at',g.granted_at) order by g.granted_at)
   from public.terravale_character_divine_boons g
   join public.terravale_dm_divine_boons b on b.id=g.boon_id
   join public.terravale_divine_patrons p on p.id=b.patron_id
   left join public.terravale_divine_patrons q on q.id=b.second_patron_id
   where g.character_id=c.id and g.status='active'),'[]'::jsonb),
  'can_view_scores',show_scores
 ) into result;
 return result;
end $$;

-- Full notes/catalog/history are never returned by the player RPC.
create or replace function public.terravale_divine_dm_state(target_character uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=(select auth.uid());c public.characters%rowtype;
begin
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord') then
  raise exception 'Verified Discord required' using errcode='28000';end if;
 select * into c from public.characters where id=target_character;
 if c.id is null or not authz.is_dm(c.campaign_id) then
  raise exception 'Campaign DM only' using errcode='42501';end if;
 return jsonb_build_object(
  'patrons',coalesce((select jsonb_agg(to_jsonb(p) order by p.name)
    from public.terravale_divine_patrons p where p.campaign_id=c.campaign_id),'[]'::jsonb),
  'favour',coalesce((select jsonb_agg(to_jsonb(f) order by f.updated_at desc)
    from public.terravale_divine_favour f where f.character_id=c.id),'[]'::jsonb),
  'catalog',coalesce((select jsonb_agg(to_jsonb(b) order by b.name)
    from public.terravale_dm_divine_boons b where b.campaign_id=c.campaign_id
    and b.state<>'archived'),'[]'::jsonb),
  'grants',coalesce((select jsonb_agg(to_jsonb(g) order by g.granted_at desc)
    from public.terravale_character_divine_boons g
    where g.character_id=c.id),'[]'::jsonb),
  'activity',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc)
    from (select * from public.terravale_divine_activity
     where character_id=c.id order by created_at desc limit 80) a),'[]'::jsonb)
 );
end $$;

create or replace function public.terravale_divine_dm_save_patron(
 target_campaign uuid,patron_spec jsonb,existing_patron uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=(select auth.uid()); pid uuid;k text;n text;r text;hint text;
begin
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord') then
  raise exception 'Discord required' using errcode='28000';end if;
 if not authz.is_dm(target_campaign) then raise exception 'Campaign DM only' using errcode='42501';end if;
 k:=lower(btrim(coalesce(patron_spec->>'key','')));
 n:=btrim(coalesce(patron_spec->>'name',''));
 r:=coalesce(patron_spec->>'rank','major');hint:=btrim(coalesce(patron_spec->>'public_hint',''));
 if k !~ '^[a-z0-9-]{2,60}$' or length(n) not between 2 and 100
  or r not in('major','minor','greater') or length(hint)>500 then
  raise exception 'Invalid patron details' using errcode='22023';end if;
 if existing_patron is null then
  insert into public.terravale_divine_patrons(campaign_id,key_name,name,rank,public_hint)
  values(target_campaign,k,n,r,hint) returning id into pid;
 else
  update public.terravale_divine_patrons set name=n,rank=r,public_hint=hint
  where id=existing_patron and campaign_id=target_campaign and key_name=k returning id into pid;
  if pid is null then raise exception 'Patron not found; key cannot be changed' using errcode='22023';end if;
 end if;
 return jsonb_build_object('id',pid,'saved',true);
end $$;

create or replace function public.terravale_divine_dm_set_favour(
 target_character uuid,target_patron uuid,new_score integer,reason text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=(select auth.uid());c public.characters%rowtype;old integer;
begin
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord') then
  raise exception 'Discord required' using errcode='28000';end if;
 select * into c from public.characters where id=target_character for update;
 if c.id is null or not authz.is_dm(c.campaign_id) then raise exception 'Campaign DM only' using errcode='42501';end if;
 if not exists(select 1 from public.terravale_divine_patrons where id=target_patron and campaign_id=c.campaign_id)
  or new_score not between -10 and 10 then
  raise exception 'Invalid patron or favour score' using errcode='22023';end if;
 select score into old from public.terravale_divine_favour where character_id=c.id and patron_id=target_patron;
 insert into public.terravale_divine_favour(character_id,patron_id,score,edited_by)
 values(c.id,target_patron,new_score,actor)
 on conflict(character_id,patron_id) do update set
  score=excluded.score,edited_by=excluded.edited_by,updated_at=now();
 insert into public.terravale_divine_activity(character_id,actor_id,action,patron_id,old_score,new_score,reason)
 values(c.id,actor,'favour',target_patron,old,new_score,left(coalesce(reason,''),500));
 return jsonb_build_object('saved',true,'score',new_score);
end $$;

create or replace function public.terravale_divine_dm_save_boon(
 target_campaign uuid,boon_spec jsonb,existing_boon uuid default null,archive_boon boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=(select auth.uid());bid uuid;p uuid;q uuid;
 k text;n text;s text;m text;st text;minimum integer;
begin
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord') then
  raise exception 'Discord required' using errcode='28000';end if;
 if not authz.is_dm(target_campaign) then raise exception 'Campaign DM only' using errcode='42501';end if;
 if archive_boon then
  update public.terravale_dm_divine_boons set state='archived',updated_at=now()
    where id=existing_boon and campaign_id=target_campaign returning id into bid;
  if bid is null then raise exception 'Boon not found' using errcode='22023';end if;
  return jsonb_build_object('archived',true,'id',bid);
 end if;
 if boon_spec is null or jsonb_typeof(boon_spec)<>'object' or pg_column_size(boon_spec)>16000 then
  raise exception 'Invalid boon data' using errcode='22023';end if;
 k:=coalesce(boon_spec->>'kind','');
 n:=btrim(coalesce(boon_spec->>'name',''));
 s:=btrim(coalesce(boon_spec->>'summary',''));
 m:=btrim(coalesce(boon_spec->>'mechanics',''));
 st:=coalesce(boon_spec->>'state','draft');
 if coalesce(boon_spec->>'required_favour','') !~ '^([1-9]|10)$' then
  raise exception 'Favour threshold must be 1 to 10' using errcode='22023';end if;
 minimum:=(boon_spec->>'required_favour')::integer;
 if k not in('divine','minor','concordant') or length(n) not between 2 and 130
  or length(s)>1200 or length(m)>10000 or st not in('draft','ready')
 then raise exception 'Invalid boon details' using errcode='22023';end if;
 p:=(boon_spec->>'patron_id')::uuid;
 q:=nullif(boon_spec->>'second_patron_id','')::uuid;
 if not exists(select 1 from public.terravale_divine_patrons x where x.id=p and x.campaign_id=target_campaign)
  or (k='concordant' and (q is null or q=p or not exists(
     select 1 from public.terravale_divine_patrons x where x.id=q and x.campaign_id=target_campaign)))
  or (k<>'concordant' and q is not null) then
  raise exception 'Invalid divine patron combination' using errcode='22023';end if;
 if (k='minor' and not exists(select 1 from public.terravale_divine_patrons x where x.id=p and x.rank='minor'))
  or (k='divine' and not exists(select 1 from public.terravale_divine_patrons x
       where x.id=p and x.rank in('major','greater'))) then
  raise exception 'Boon family does not match patron rank' using errcode='22023';end if;
 if existing_boon is not null and exists(
   select 1 from public.terravale_character_divine_boons g
   where g.boon_id=existing_boon and g.status='active'
 ) and exists(
   select 1 from public.terravale_dm_divine_boons old
   where old.id=existing_boon
   and (old.kind<>k or old.patron_id<>p or old.second_patron_id is distinct from q)
 ) then
  raise exception 'Cannot change the patron or family of an actively bestowed boon' using errcode='22023';end if;
 if existing_boon is null then
  insert into public.terravale_dm_divine_boons(
   campaign_id,patron_id,second_patron_id,kind,name,summary,mechanics,required_favour,state)
  values(target_campaign,p,q,k,n,s,m,minimum,st) returning id into bid;
 else
  update public.terravale_dm_divine_boons set patron_id=p,second_patron_id=q,
   kind=k,name=n,summary=s,mechanics=m,required_favour=minimum,state=st,updated_at=now()
  where id=existing_boon and campaign_id=target_campaign returning id into bid;
  if bid is null then raise exception 'Boon not found' using errcode='22023';end if;
 end if;
 return jsonb_build_object('saved',true,'id',bid);
end $$;

create or replace function public.terravale_divine_dm_grant_boon(
 target_character uuid,target_boon uuid,give_boon boolean default true,reason text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=(select auth.uid());c public.characters%rowtype;b public.terravale_dm_divine_boons%rowtype;
 g uuid; favour1 integer;favour2 integer;active_count integer;
begin
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord') then
  raise exception 'Discord required' using errcode='28000';end if;
 select * into c from public.characters where id=target_character for update;
 select * into b from public.terravale_dm_divine_boons where id=target_boon;
 if c.id is null or b.id is null or b.campaign_id<>c.campaign_id
    or not authz.is_dm(c.campaign_id) then
  raise exception 'Campaign DM only' using errcode='42501';end if;
 if give_boon then
  if b.state<>'ready' then raise exception 'Publish the boon before granting' using errcode='22023';end if;
  select score into favour1 from public.terravale_divine_favour where character_id=c.id and patron_id=b.patron_id;
  if coalesce(favour1,0)<b.required_favour then
   raise exception 'Divine Favour has not reached the requirement' using errcode='22023';end if;
  if b.kind='concordant' then
   select score into favour2 from public.terravale_divine_favour
   where character_id=c.id and patron_id=b.second_patron_id;
   if coalesce(favour2,0)<b.required_favour then
    raise exception 'The second patron has insufficient favour' using errcode='22023';end if;
   select count(*) into active_count from public.terravale_character_divine_boons x
    join public.terravale_dm_divine_boons z on z.id=x.boon_id
    where x.character_id=c.id and x.status='active' and z.kind='concordant';
   if active_count>=1 then raise exception 'Only one active Concordant Boon is allowed' using errcode='22023';end if;
  else
   select count(*) into active_count from public.terravale_character_divine_boons x
    join public.terravale_dm_divine_boons z on z.id=x.boon_id
    where x.character_id=c.id and x.status='active' and z.kind<>'concordant'
      and z.patron_id=b.patron_id;
   if active_count>=3 then raise exception 'Only three active boons per patron are allowed' using errcode='22023';end if;
  end if;
  insert into public.terravale_character_divine_boons(character_id,boon_id,granted_by,grant_reason)
  values(c.id,b.id,actor,left(coalesce(reason,''),500)) returning id into g;
 else
  update public.terravale_character_divine_boons set status='revoked',revoked_by=actor,
   revoked_at=now(),revoke_reason=left(coalesce(reason,''),500)
  where character_id=c.id and boon_id=b.id and status='active' returning id into g;
  if g is null then raise exception 'Boon is not currently granted' using errcode='22023';end if;
 end if;
 insert into public.terravale_divine_activity(character_id,actor_id,action,boon_id,reason)
 values(c.id,actor,case when give_boon then 'grant' else 'revoke' end,b.id,left(coalesce(reason,''),500));
 return jsonb_build_object('id',g,'granted',give_boon,'revoked',not give_boon);
end $$;

-- Backfill only three firmly established Greater Gods as generic, public
-- previews; no mechanics or favour values are fabricated.
insert into public.terravale_divine_patrons(campaign_id,key_name,name,rank,public_hint)
select camp.id,v.key_name,v.name,'greater',v.hint
from public.campaigns camp
cross join (values
 ('pae','Pae','A Greater God. Their attention must be earned through choices and deeds.'),
 ('kalma','Kalma','The keeper of death and the cycle of souls. Divine notice can carry a cost.'),
 ('tyrius','Tyrius','A Greater God. Their favour remains a matter of divine judgement.')
) v(key_name,name,hint)
on conflict(campaign_id,key_name) do nothing;

-- Restrict each newly created RPC to verified authenticated clients only.
revoke all on function public.terravale_divine_player_state(uuid) from public,anon;
revoke all on function public.terravale_divine_dm_state(uuid) from public,anon;
revoke all on function public.terravale_divine_dm_save_patron(uuid,jsonb,uuid) from public,anon;
revoke all on function public.terravale_divine_dm_set_favour(uuid,uuid,integer,text) from public,anon;
revoke all on function public.terravale_divine_dm_save_boon(uuid,jsonb,uuid,boolean) from public,anon;
revoke all on function public.terravale_divine_dm_grant_boon(uuid,uuid,boolean,text) from public,anon;
grant execute on function public.terravale_divine_player_state(uuid) to authenticated;
grant execute on function public.terravale_divine_dm_state(uuid) to authenticated;
grant execute on function public.terravale_divine_dm_save_patron(uuid,jsonb,uuid) to authenticated;
grant execute on function public.terravale_divine_dm_set_favour(uuid,uuid,integer,text) to authenticated;
grant execute on function public.terravale_divine_dm_save_boon(uuid,jsonb,uuid,boolean) to authenticated;
grant execute on function public.terravale_divine_dm_grant_boon(uuid,uuid,boolean,text) to authenticated;
commit;
