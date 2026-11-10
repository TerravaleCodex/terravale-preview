-- V2.81: source-backed formal Offers. Tier 0 and Impossible Offers are
-- explicit negotiated story events, never ordinary auto-granted abilities.
create table if not exists public.terravale_divine_canon_offers(
 id uuid primary key default gen_random_uuid(),
 character_id uuid not null references public.characters(id) on delete cascade,
 entry_id uuid not null references public.terravale_divine_archive_entries(id),
 benefit text not null check(char_length(benefit) between 8 and 2500),
 certain_price text not null check(char_length(certain_price) between 8 and 2500),
 affected_parties text not null check(char_length(affected_parties) between 3 and 1200),
 duration text not null check(char_length(duration) between 3 and 800),
 reversibility text not null check(char_length(reversibility) between 3 and 800),
 uncertainty_boundary text not null check(char_length(uncertainty_boundary) between 3 and 1200),
 fracture_chain text check(fracture_chain is null or fracture_chain in ('Mercy','Justice','Oblivion')),
 status text not null default 'offered' check(status in('offered','accepted','declined','fulfilled','cancelled')),
 dm_note text not null default '',
 offered_by uuid not null references auth.users(id),
 offered_at timestamptz not null default now(),
 responded_at timestamptz,
 fulfilled_at timestamptz
);
create index if not exists tv281_pending_formal_offers
 on public.terravale_divine_canon_offers(character_id,status);
alter table public.terravale_divine_canon_offers enable row level security;
revoke all on public.terravale_divine_canon_offers from public,anon,authenticated;

create or replace function public.terravale_divine_canon_dm_offer(
 target_character uuid,target_entry uuid,terms jsonb
) returns jsonb language plpgsql security definer set search_path=''
as $tv281_offer$
declare actor uuid:=(select auth.uid());c public.characters%rowtype;
 e public.terravale_divine_archive_entries%rowtype;oid uuid;
begin
 select * into c from public.characters where id=target_character for update;
 select * into e from public.terravale_divine_archive_entries where id=target_entry;
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord')
  or c.id is null or e.id is null or e.campaign_id<>c.campaign_id or not authz.is_dm(c.campaign_id) then
  raise exception 'Verified campaign DM only' using errcode='42501';end if;
 if e.kind not in ('tier_zero','nyrha_offer','nyrha_revision','nyrha_state') then
  raise exception 'Formal offers are reserved for story bargains and Nyrha Revisions'
    using errcode='22023';end if;
 if jsonb_typeof(terms)<>'object' then
  raise exception 'Write the full formal terms before presenting an Offer' using errcode='22023';end if;
 if exists(select 1 from public.terravale_divine_canon_offers o
 where o.character_id=c.id and o.entry_id=e.id and o.status='offered') then
  raise exception 'An Offer for this source is already awaiting a response' using errcode='23505';end if;
 if e.kind like 'nyrha_%' and coalesce(terms->>'fracture_chain','') not in('Mercy','Justice','Oblivion')
 then raise exception 'Nyrha Offer must disclose its Silver-Chain Fracture' using errcode='22023';end if;
 insert into public.terravale_divine_canon_offers(
 character_id,entry_id,benefit,certain_price,affected_parties,duration,
 reversibility,uncertainty_boundary,fracture_chain,dm_note,offered_by
 ) values(c.id,e.id,
 trim(terms->>'benefit'),trim(terms->>'certain_price'),
 trim(terms->>'affected_parties'),trim(terms->>'duration'),
 trim(terms->>'reversibility'),trim(terms->>'uncertainty_boundary'),
 nullif(terms->>'fracture_chain',''),
 left(coalesce(terms->>'dm_note',''),2500),actor)
 returning id into oid;
 insert into public.terravale_divine_canon_history(character_id,actor_id,action,details)
 values(c.id,actor,'formal_offer',jsonb_build_object('offer_id',oid,'source',e.source_path,
  'type',e.kind));
 return jsonb_build_object('offer_id',oid,'status','offered');
end $tv281_offer$;
revoke all on function public.terravale_divine_canon_dm_offer(uuid,uuid,jsonb)
 from public,anon,authenticated;
grant execute on function public.terravale_divine_canon_dm_offer(uuid,uuid,jsonb) to authenticated;

create or replace function public.terravale_divine_canon_respond_offer(
 target_offer uuid, accepted boolean
) returns jsonb language plpgsql security definer set search_path=''
as $tv281_respond$
declare actor uuid:=(select auth.uid());o public.terravale_divine_canon_offers%rowtype;
 c public.characters%rowtype;decision text;
begin
 select * into o from public.terravale_divine_canon_offers where id=target_offer for update;
 select * into c from public.characters where id=o.character_id;
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord')
   or o.id is null or c.id is null or c.owner_id<>actor then
  raise exception 'Only the player who owns this character may accept or decline'
    using errcode='42501';end if;
 if accepted is null then raise exception 'Choose accept or decline' using errcode='22023';end if;
 if o.status<>'offered' then return jsonb_build_object('id',o.id,'status',o.status,
    'already_responded',true);end if;
 decision:=case when accepted then 'accepted' else 'declined' end;
 update public.terravale_divine_canon_offers set status=decision,responded_at=now()
 where id=o.id;
 insert into public.terravale_divine_canon_history(character_id,actor_id,action,details)
 values(c.id,actor,'formal_offer_response',jsonb_build_object('offer_id',o.id,
  'decision',decision));
 return jsonb_build_object('id',o.id,'status',decision);
end $tv281_respond$;
revoke all on function public.terravale_divine_canon_respond_offer(uuid,boolean)
 from public,anon,authenticated;
grant execute on function public.terravale_divine_canon_respond_offer(uuid,boolean) to authenticated;

create or replace function public.terravale_divine_canon_dm_resolve_offer(
 target_offer uuid, outcome text
) returns jsonb language plpgsql security definer set search_path=''
as $tv281_resolve_offer$
declare actor uuid:=(select auth.uid());o public.terravale_divine_canon_offers%rowtype;
 c public.characters%rowtype;
begin
 select * into o from public.terravale_divine_canon_offers where id=target_offer for update;
 select * into c from public.characters where id=o.character_id;
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord')
  or o.id is null or c.id is null or not authz.is_dm(c.campaign_id) then
  raise exception 'Verified campaign DM only' using errcode='42501';end if;
 if o.status<>'accepted' then raise exception 'Cannot resolve an Offer before the player accepts'
   using errcode='22023';end if;
 if char_length(trim(coalesce(outcome,'')))<8 then
  raise exception 'Record the consequence and what remains after the bargain'
   using errcode='22023';end if;
 update public.terravale_divine_canon_offers set status='fulfilled',fulfilled_at=now(),
  dm_note=left(concat_ws(E'\n',o.dm_note,'Resolution: '||outcome),2500) where id=o.id;
 insert into public.terravale_divine_canon_history(character_id,actor_id,action,details)
 values(c.id,actor,'formal_offer_fulfilled',jsonb_build_object('offer_id',o.id,
  'outcome',left(outcome,500)));
 return jsonb_build_object('id',o.id,'status','fulfilled');
end $tv281_resolve_offer$;
revoke all on function public.terravale_divine_canon_dm_resolve_offer(uuid,text)
 from public,anon,authenticated;
grant execute on function public.terravale_divine_canon_dm_resolve_offer(uuid,text) to authenticated;

create or replace function public.terravale_divine_canon_offers_player_state(
 target_character uuid
) returns jsonb language plpgsql stable security definer set search_path=''
as $tv281_offer_list$
declare actor uuid:=(select auth.uid());c public.characters%rowtype;
begin
 select * into c from public.characters where id=target_character;
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord')
 or c.id is null or not (c.owner_id=actor or authz.is_dm(c.campaign_id)) then
  raise exception 'Character owner or campaign DM required' using errcode='42501';end if;
 return jsonb_build_object('offers',coalesce((
 select jsonb_agg(jsonb_build_object(
  'id',o.id,'entry_id',o.entry_id,'title',e.name,'patron',e.patron,'kind',e.kind,
  'source_mechanics',e.source_excerpt,'benefit',o.benefit,'certain_price',o.certain_price,
  'affected_parties',o.affected_parties,'duration',o.duration,
  'reversibility',o.reversibility,'uncertainty_boundary',o.uncertainty_boundary,
  'fracture_chain',o.fracture_chain,'status',o.status,'offered_at',o.offered_at,
  'responded_at',o.responded_at)
  order by o.offered_at desc)
  from public.terravale_divine_canon_offers o
  join public.terravale_divine_archive_entries e on e.id=o.entry_id
  where o.character_id=c.id and o.status in('offered','accepted','fulfilled')
 ),'[]'::jsonb));
end $tv281_offer_list$;
revoke all on function public.terravale_divine_canon_offers_player_state(uuid)
 from public,anon,authenticated;
grant execute on function public.terravale_divine_canon_offers_player_state(uuid) to authenticated;
