-- V2.82 — respect original Tier 0 text instead of demanding duplicate term writing.
alter table public.terravale_divine_canon_offers
 add column if not exists source_exact boolean not null default false,
 add column if not exists clarifications text not null default '';
alter table public.terravale_divine_canon_awards
 drop constraint if exists terravale_divine_canon_awards_slot_check;
alter table public.terravale_divine_canon_awards
 add constraint terravale_divine_canon_awards_slot_check
 check(slot in('passive','reaction','major','grace','intercession','revision','unwritten','bargain'));
CREATE OR REPLACE FUNCTION public.terravale_divine_canon_dm_offer(target_character uuid, target_entry uuid, terms jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 if e.kind='tier_zero' and coalesce(terms->>'source_exact','false')='true' then
  if char_length(coalesce(e.source_excerpt,''))<12 then
   raise exception 'This Tier 0 source is too incomplete for an exact-source Offer' using errcode='22023';end if;
  -- Source has priority. Its complete text is always included when showing
  -- the Offer. Do not invent six new fictional terms.
  terms:=jsonb_build_object(
    'source_exact',true,
    'benefit','See original benefit and effect in the attached canon source.',
    'certain_price','See original cost and irreversible consequence in the attached canon source.',
    'affected_parties','Affected parties are as stated in the original canon source.',
    'duration','Duration is as described in the original canon source.',
    'reversibility','Reversibility is as described in the original canon source.',
    'uncertainty_boundary','Uncertainty is constrained by the original canon source.',
    'clarifications',left(coalesce(terms->>'clarifications',''),1500)
  );
 end if;
 if e.kind like 'nyrha_%' and coalesce(terms->>'fracture_chain','') not in('Mercy','Justice','Oblivion')
 then raise exception 'Nyrha Offer must disclose its Silver-Chain Fracture' using errcode='22023';end if;
 insert into public.terravale_divine_canon_offers(
 character_id,entry_id,benefit,certain_price,affected_parties,duration,
 reversibility,uncertainty_boundary,fracture_chain,dm_note,offered_by,source_exact,clarifications
 ) values(c.id,e.id,
 trim(terms->>'benefit'),trim(terms->>'certain_price'),
 trim(terms->>'affected_parties'),trim(terms->>'duration'),
 trim(terms->>'reversibility'),trim(terms->>'uncertainty_boundary'),
 nullif(terms->>'fracture_chain',''),
 left(coalesce(terms->>'dm_note',''),2500),actor,
 coalesce(terms->>'source_exact','false')='true',left(coalesce(terms->>'clarifications',''),1500))
 returning id into oid;
 insert into public.terravale_divine_canon_history(character_id,actor_id,action,details)
 values(c.id,actor,'formal_offer',jsonb_build_object('offer_id',oid,'source',e.source_path,
  'type',e.kind));
 return jsonb_build_object('offer_id',oid,'status','offered');
end $function$
;
CREATE OR REPLACE FUNCTION public.terravale_divine_canon_offers_player_state(target_character uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=(select auth.uid());c public.characters%rowtype;
begin
 select * into c from public.characters where id=target_character;
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord')
 or c.id is null or not (c.owner_id=actor or authz.is_dm(c.campaign_id)) then
  raise exception 'Character owner or campaign DM required' using errcode='42501';end if;
 return jsonb_build_object('offers',coalesce((
 select jsonb_agg(jsonb_build_object(
  'id',o.id,'entry_id',o.entry_id,'title',e.name,'patron',e.patron,'kind',e.kind,
  'source_mechanics',e.source_excerpt,'source_exact',o.source_exact,'clarifications',o.clarifications,'benefit',o.benefit,'certain_price',o.certain_price,
  'affected_parties',o.affected_parties,'duration',o.duration,
  'reversibility',o.reversibility,'uncertainty_boundary',o.uncertainty_boundary,
  'fracture_chain',o.fracture_chain,'status',o.status,'offered_at',o.offered_at,
  'responded_at',o.responded_at)
  order by o.offered_at desc)
  from public.terravale_divine_canon_offers o
  join public.terravale_divine_archive_entries e on e.id=o.entry_id
  where o.character_id=c.id and o.status in('offered','accepted','fulfilled')
 ),'[]'::jsonb));
end $function$
;
CREATE OR REPLACE FUNCTION public.terravale_divine_canon_grant(target_character uuid, target_entry uuid, target_slot text DEFAULT NULL::text, target_ability text DEFAULT NULL::text, reason text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=(select auth.uid()); c public.characters%rowtype;
 e public.terravale_divine_archive_entries%rowtype; a uuid;
 state public.terravale_divine_canon_state%rowtype;
 lv integer; cap integer; count_awards integer; chosen_slot text;
 claimed_score integer; secondary_score integer; count_uses smallint; recovery_kind text;
 desired text; pname text; secondary text;
begin
 if actor is null or not exists(select 1 from auth.identities
    where user_id=actor and provider='discord') then
  raise exception 'Verified Discord required' using errcode='28000';end if;
 select * into c from public.characters where id=target_character for update;
 select * into e from public.terravale_divine_archive_entries where id=target_entry;
 if not found or c.id is null or e.campaign_id<>c.campaign_id
   or not authz.is_dm(c.campaign_id) then
  raise exception 'Campaign DM only' using errcode='42501';end if;
 if e.kind in('nyrha_revision','nyrha_state','tier_zero') and not exists (
    select 1 from public.terravale_divine_canon_offers o
    where o.character_id=c.id and o.entry_id=e.id and o.status in('accepted','fulfilled')
 ) then
  raise exception 'This gift requires a disclosed Formal Offer and explicit player acceptance'
   using errcode='22023';end if;
 if e.kind not in ('divine','concordant','minor_grace','minor_intercession',
     'nyrha_revision','nyrha_state','tier_zero') then
  raise exception 'Impossible Offers require their own formal procedure, not an ordinary boon grant'
   using errcode='22023';end if;
 if exists(select 1 from public.terravale_divine_canon_awards
  where character_id=c.id and entry_id=e.id and status in('active','dormant'))
 then raise exception 'This boon is already held by the character' using errcode='23505';end if;
 insert into public.terravale_divine_canon_state(character_id)
 values(c.id) on conflict(character_id) do nothing;
 select * into state from public.terravale_divine_canon_state where character_id=c.id for update;
 lv:=case when coalesce(c.approved_build->>'level',c.approved_build->'character'->>'level','')~'^(?:[1-9]|1[0-9]|20)$'
 then coalesce(c.approved_build->>'level',c.approved_build->'character'->>'level')::integer else 1 end;
 chosen_slot:=lower(coalesce(target_slot,''));
 desired:=lower(coalesce(e.slot,''));
 pname:=lower(e.patron);secondary:=lower(coalesce(e.other_patron,''));
 if e.kind in('divine','concordant') then
  if e.required_favour is null or e.tier not between 1 and 5 then
   raise exception 'Conventional boon must have a verified tier and direct Favour threshold'
   using errcode='22023';end if;
  select f.score into claimed_score from public.terravale_divine_favour f
  join public.terravale_divine_patrons p on p.id=f.patron_id
  where f.character_id=c.id and p.campaign_id=c.campaign_id and lower(p.key_name)=pname limit 1;
  if coalesce(claimed_score,0)<e.required_favour then
   raise exception 'Direct Favour has not met this patron requirement'
    using errcode='22023';end if;
  if e.kind='concordant' then
   if secondary='' or e.required_favour_second is null then
    raise exception 'Concordant requires two verified patron thresholds' using errcode='22023';end if;
   select f.score into secondary_score from public.terravale_divine_favour f
   join public.terravale_divine_patrons p on p.id=f.patron_id
   where f.character_id=c.id and p.campaign_id=c.campaign_id and lower(p.key_name)=secondary limit 1;
   if coalesce(secondary_score,0)<e.required_favour_second then
    raise exception 'Second Concordant patron has insufficient direct Favour' using errcode='22023';end if;
   if exists(select 1 from public.terravale_divine_canon_awards x
     join public.terravale_divine_archive_entries z on z.id=x.entry_id
     where x.character_id=c.id and x.status='active' and z.kind='concordant')
   then raise exception 'Only one active Concordant is allowed' using errcode='22023';end if;
  end if;
  if chosen_slot not in('passive','reaction','major') then
   raise exception 'Choose Passive, Reaction, or Major. Unspecified source slots cannot be guessed'
    using errcode='22023';end if;
  if desired in('passive','reaction','major') and chosen_slot<>desired then
   raise exception 'Chosen slot disagrees with the original source' using errcode='22023';end if;
  if exists(select 1 from public.terravale_divine_canon_awards x
    join public.terravale_divine_archive_entries z on z.id=x.entry_id
    where x.character_id=c.id and x.status='active' and x.slot=chosen_slot
     and z.kind in('divine','concordant')
     and (lower(z.patron) in(pname,secondary) or lower(coalesce(z.other_patron,'')) in(pname,secondary)))
  then raise exception 'This patron already occupies that active Favour Slot' using errcode='22023';end if;
 elsif e.kind in('minor_grace','minor_intercession') then
  chosen_slot:=case e.kind when 'minor_grace' then 'grace' else 'intercession' end;
  if exists(select 1 from public.terravale_divine_canon_awards x
    join public.terravale_divine_archive_entries z on z.id=x.entry_id
    where x.character_id=c.id and x.status='active' and z.kind=e.kind)
  then raise exception 'Replace the existing held Minor Grace or Intercession first' using errcode='22023';end if;
  if coalesce(target_ability,'') not in('int','wis','cha') then
   raise exception 'Choose INT, WIS, or CHA as the Minor Boon Ability' using errcode='22023';end if;
 elsif e.kind='tier_zero' then
  -- Tier 0 can be awarded after the bearer has accepted the original terms.
  -- It is a permanent story bargain, never one of the three Favour Slots.
  chosen_slot:='bargain';
 elsif e.kind like 'nyrha_%' then
  chosen_slot:=case e.kind when 'nyrha_revision' then 'revision' else 'unwritten' end;
  cap:=case when lv<=4 then 1 when lv<=8 then 2 when lv<=12 then 3 when lv<=16 then 4 else 5 end;
  if e.tier>state.entanglement or e.tier>cap then
   raise exception 'Nyrha Revision exceeds Entanglement or character-level Depth' using errcode='22023';end if;
  if e.kind='nyrha_state' and (state.entanglement<>5 or lv<17) then
   raise exception 'The Unwritten State requires Entanglement 5 and character level 17+' using errcode='22023';end if;
  if e.kind='nyrha_revision' then
   cap:=case when state.entanglement<1 then 0 when state.entanglement<3 then 1
      when state.entanglement<5 then 2 else 3 end;
   select count(*) into count_awards
   from public.terravale_divine_canon_awards x
    join public.terravale_divine_archive_entries z on z.id=x.entry_id
   where x.character_id=c.id and x.status='active' and z.kind='nyrha_revision';
   if count_awards>=cap then raise exception 'Entanglement grants no additional active Revision slots'
    using errcode='22023';end if;
  end if;
 end if;
 count_uses:=null;recovery_kind:='none';
 if e.kind='nyrha_revision' then count_uses:=1;recovery_kind:='long';end if;
 if e.kind='minor_intercession' then recovery_kind:='long';end if;
 if e.kind in('divine','concordant') then
  if coalesce(e.uses_text,'') ~* 'once per (long rest|day)' then
    count_uses:=1;recovery_kind:='long';
  elsif coalesce(e.uses_text,'') ~* 'once per short rest' then
    count_uses:=1;recovery_kind:='short';
  elsif coalesce(e.uses_text,'') ~* 'once per seven days' then
    count_uses:=1;recovery_kind:='seven_days';
  elsif coalesce(e.uses_text,'') ~* 'twice per long rest' then
    count_uses:=2;recovery_kind:='long';
  elsif coalesce(e.uses_text,'') ~* 'proficiency bonus per long rest' then
    count_uses:=2+((lv-1)/4);recovery_kind:='long';
  elsif coalesce(e.uses_text,'') ~* 'once per campaign arc' then
    count_uses:=1;recovery_kind:='manual';
  elsif coalesce(e.uses_text,'') ~* 'once per session' then
    count_uses:=1;recovery_kind:='manual';
  elsif e.uses_text is null and chosen_slot<>'passive' then
    -- A limited-use sentence in an otherwise descriptive source is still explicit.
    if e.source_excerpt ~* 'once per long rest' then
      count_uses:=1;recovery_kind:='long';
    elsif e.source_excerpt ~* 'once per short rest' then
      count_uses:=1;recovery_kind:='short';
    elsif e.source_excerpt ~* 'once per session' then
      count_uses:=1;recovery_kind:='manual';
    end if;
  end if;
 end if;
 insert into public.terravale_divine_canon_awards(
   character_id,entry_id,slot,chosen_ability,max_uses,uses_remaining,
   recovery,granted_by,reason
 ) values(c.id,e.id,chosen_slot,nullif(target_ability,''),count_uses,count_uses,
  recovery_kind,actor,left(coalesce(reason,''),500)) returning id into a;
 if e.kind='minor_intercession' then
  update public.terravale_divine_canon_state
   set minor_intercession_remaining=0,updated_at=now() where character_id=c.id;
 end if;
 insert into public.terravale_divine_canon_history(character_id,award_id,actor_id,action,details)
 values(c.id,a,actor,'grant',jsonb_build_object('kind',e.kind,'source',e.source_path,
 'slot',chosen_slot,'tier',e.tier));
 return jsonb_build_object('id',a,'granted',true,'slot',chosen_slot,
  'max_uses',count_uses,'recovery',recovery_kind);
end $function$
;
