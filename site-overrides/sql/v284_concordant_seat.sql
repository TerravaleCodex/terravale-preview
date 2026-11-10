-- V2.84 — stop confusing Concordant source activation category with its
-- dedicated character-sheet seat. The original source's slot/activation field
-- remains untouched; dual Favour and one active Concordant are still enforced.
alter table public.terravale_divine_canon_awards
 drop constraint if exists terravale_divine_canon_awards_slot_check;
alter table public.terravale_divine_canon_awards
 add constraint terravale_divine_canon_awards_slot_check
 check(slot in('passive','reaction','major','concordant','grace','intercession',
 'revision','unwritten','bargain'));
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
  if e.kind='concordant' then
   -- A Concordant's source Slot: Major/Reaction/Passive is its activation
   -- category. The special Concordant seat is kept distinct from conventional
   -- patron Favour Slots in the six-slot character-sheet presentation.
   -- One active Concordant per bearer and both gods' direct Favour remain required.
   chosen_slot:='concordant';
  else
   if chosen_slot not in('passive','reaction','major') then
    raise exception 'Choose Passive, Reaction, or Major. Unspecified source slots cannot be guessed'
     using errcode='22023';end if;
   if desired in('passive','reaction','major') and chosen_slot<>desired then
    raise exception 'Chosen slot disagrees with the original source' using errcode='22023';end if;
   if exists(select 1 from public.terravale_divine_canon_awards x
     join public.terravale_divine_archive_entries z on z.id=x.entry_id
     where x.character_id=c.id and x.status='active' and x.slot=chosen_slot
      and z.kind='divine' and lower(z.patron)=pname)
   then raise exception 'This patron already occupies that conventional Favour Slot'
     using errcode='22023';end if;
  end if;
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
