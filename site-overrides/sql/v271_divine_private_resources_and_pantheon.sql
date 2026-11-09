-- V2.71: server-side player privacy, charge metadata and resource accounting.
alter table public.terravale_dm_divine_boons
 add column if not exists max_charges integer not null default 0 check(max_charges between 0 and 99),
 add column if not exists recovery text not null default 'long' check(recovery in('short','long','dawn','manual','none'));
alter table public.terravale_character_divine_boons
 add column if not exists charges_remaining integer;
CREATE OR REPLACE FUNCTION public.terravale_divine_dm_save_boon(target_campaign uuid, boon_spec jsonb, existing_boon uuid DEFAULT NULL::uuid, archive_boon boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=(select auth.uid());bid uuid;p uuid;q uuid;
 k text;n text;s text;m text;st text;minimum integer;mc integer;rec text;
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
 mc:=coalesce((boon_spec->>'max_charges')::integer,0);
 rec:=coalesce(boon_spec->>'recovery','long');
 if mc not between 0 and 99 or rec not in('short','long','dawn','manual','none') then
  raise exception 'Invalid boon charge configuration' using errcode='22023';end if;
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
   campaign_id,patron_id,second_patron_id,kind,name,summary,mechanics,required_favour,state,max_charges,recovery)
  values(target_campaign,p,q,k,n,s,m,minimum,st,mc,rec) returning id into bid;
 else
  update public.terravale_dm_divine_boons set patron_id=p,second_patron_id=q,
   kind=k,name=n,summary=s,mechanics=m,required_favour=minimum,state=st,max_charges=mc,recovery=rec,updated_at=now()
  where id=existing_boon and campaign_id=target_campaign returning id into bid;
  if bid is null then raise exception 'Boon not found' using errcode='22023';end if;
 end if;
 return jsonb_build_object('saved',true,'id',bid);
end $function$;

-- V2.70 privacy hardening: only character owner and verified campaign DM
-- can read a character's awarded boon details, including when the sheet is party-shared.
-- The public major-deity flavour previews remain available to shared-sheet viewers.
CREATE OR REPLACE FUNCTION public.terravale_divine_player_state(target_character uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  'granted',case when show_scores then coalesce((select jsonb_agg(jsonb_build_object(
    'id',g.id,'name',b.name,'kind',b.kind,'summary',b.summary,
    'mechanics',b.mechanics,'patron',p.name,'other_patron',q.name,
    'granted_at',g.granted_at,'max_charges',b.max_charges,'charges_remaining',coalesce(g.charges_remaining,b.max_charges),'recovery',b.recovery) order by g.granted_at)
   from public.terravale_character_divine_boons g
   join public.terravale_dm_divine_boons b on b.id=g.boon_id
   join public.terravale_divine_patrons p on p.id=b.patron_id
   left join public.terravale_divine_patrons q on q.id=b.second_patron_id
   where g.character_id=c.id and g.status='active'),'[]'::jsonb) else '[]'::jsonb end
 ) into result;
 return result;
end $function$;
revoke all on function public.terravale_divine_player_state(uuid) from public,anon;
grant execute on function public.terravale_divine_player_state(uuid) to authenticated;

create or replace function public.terravale_divine_use_boon(target_grant uuid)
returns jsonb language plpgsql security definer set search_path=''
as $v271use$
declare actor uuid:=(select auth.uid()); g public.terravale_character_divine_boons%rowtype;
 c public.characters%rowtype; maxc integer; before_count integer;
begin
 if actor is null or not exists(select 1 from auth.identities
   where user_id=actor and provider='discord') then
  raise exception 'Verified Discord required' using errcode='28000';end if;
 select * into g from public.terravale_character_divine_boons where id=target_grant for update;
 if g.id is null or g.status<>'active' then raise exception 'Boon not active' using errcode='42501';end if;
 select * into c from public.characters where id=g.character_id;
 if c.id is null or not(c.owner_id=actor or authz.is_dm(c.campaign_id)) then
  raise exception 'Not permitted to use this boon' using errcode='42501';end if;
 select b.max_charges into maxc from public.terravale_dm_divine_boons b
  where b.id=g.boon_id and b.campaign_id=c.campaign_id;
 if coalesce(maxc,0)<1 then raise exception 'This boon has no charge pool' using errcode='22023';end if;
 before_count:=least(maxc,greatest(0,coalesce(g.charges_remaining,maxc)));
 if before_count<1 then raise exception 'No boon charges remaining' using errcode='22023';end if;
 update public.terravale_character_divine_boons
  set charges_remaining=before_count-1 where id=g.id;
 return jsonb_build_object('remaining',before_count-1,'maximum',maxc);
end $v271use$;
revoke all on function public.terravale_divine_use_boon(uuid) from public,anon;
grant execute on function public.terravale_divine_use_boon(uuid) to authenticated;

-- DM-approved recharge, not yet assumed automatic from an unrelated rest.
create or replace function public.terravale_divine_refill_boon(target_grant uuid)
returns jsonb language plpgsql security definer set search_path=''
as $v271refill$
declare actor uuid:=(select auth.uid()); g public.terravale_character_divine_boons%rowtype;
 c public.characters%rowtype; maxc integer;
begin
 if actor is null or not exists(select 1 from auth.identities
  where user_id=actor and provider='discord') then
  raise exception 'Verified Discord required' using errcode='28000';end if;
 select * into g from public.terravale_character_divine_boons where id=target_grant for update;
 if g.id is null or g.status<>'active' then raise exception 'Boon not active' using errcode='42501';end if;
 select * into c from public.characters where id=g.character_id;
 if c.id is null or not authz.is_dm(c.campaign_id) then
  raise exception 'Campaign DM only' using errcode='42501';end if;
 select b.max_charges into maxc from public.terravale_dm_divine_boons b
  where b.id=g.boon_id and b.campaign_id=c.campaign_id;
 if coalesce(maxc,0)<1 then raise exception 'This boon has no charges' using errcode='22023';end if;
 update public.terravale_character_divine_boons set charges_remaining=maxc where id=g.id;
 return jsonb_build_object('remaining',maxc,'maximum',maxc);
end $v271refill$;
revoke all on function public.terravale_divine_refill_boon(uuid) from public,anon;
grant execute on function public.terravale_divine_refill_boon(uuid) to authenticated;

-- Publicly recognised Twelve and four documented additional major figures.
-- Only register in campaigns with an existing divine patron register.
with canonical(key_name,name,rank,public_hint) as (
 values ('pae','Pae','greater','Sun, light and justice; fairness weighed against duty.'),
('amora','Amora','greater','Love, beauty and the bonds people choose to honour.'),
('vaelniv','Vaelniv','greater','Nature, wild places and the responsibility of the hunt.'),
('torridae','Torridae','greater','War, defence and the cost of necessary struggle.'),
('coeus','Coeus','greater','Knowledge, magic and seeking understanding.'),
('errigan','Errigan','greater','Music, revelry and the transformative power of celebration.'),
('rao','Rao','greater','Peace, protection and measured harmony.'),
('kalma','Kalma','greater','Death, farewell and the passage of souls.'),
('tyrius','Tyrius','greater','Oceans, storms and the force of changing tides.'),
('eshael','Eshael','greater','Family, childbirth and the care that sustains life.'),
('fjoras','Fjoras','greater','Journeys, departures and finding a road forward.'),
('kwaeth','Kwaeth','greater','Secrets, trickery and what is withheld from sight.'),
('luna','Luna','major','A significant divine figure beyond the conventional Twelve.'),
('ixi','Ixi','major','Fire, renewal and what must be tended after destruction.'),
('tedegra','Tedegra','major','A major divine figure honoured outside the conventional Twelve.'),
('nyrha','Nyrha','major','An ancient divine figure beyond the conventional Twelve.')
), active_campaigns as (
 select distinct campaign_id from public.terravale_divine_patrons
)
insert into public.terravale_divine_patrons(campaign_id,key_name,name,rank,public_hint)
select c.campaign_id,p.key_name,p.name,p.rank,p.public_hint
from active_campaigns c cross join canonical p
on conflict(campaign_id,key_name) do nothing;
