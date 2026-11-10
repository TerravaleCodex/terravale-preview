-- V2.81 canonical source-aware activations, rests, Burdens and limited status automation.
-- All actor RPCs validate ownership or campaign DM access. No raw catalogue exposure.
create or replace function public.terravale_divine_canon_use(
 target_award uuid, material_invocation boolean default true
) returns jsonb language plpgsql security definer set search_path=''
as $tv281_use$
declare actor uuid:=(select auth.uid()); a public.terravale_divine_canon_awards%rowtype;
 c public.characters%rowtype; e public.terravale_divine_archive_entries%rowtype;
 state public.terravale_divine_canon_state%rowtype;
 key text; pname text; label text; old_stacks integer; overflow_count integer:=0;
 rest_block boolean; drunk_inc integer:=0;
begin
 select * into a from public.terravale_divine_canon_awards where id=target_award for update;
 select * into c from public.characters where id=a.character_id for update;
 select * into e from public.terravale_divine_archive_entries where id=a.entry_id;
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord')
   or a.id is null or a.status<>'active' or c.id is null or e.campaign_id<>c.campaign_id
   or not(c.owner_id=actor or authz.is_dm(c.campaign_id)) then
  raise exception 'Active boon belongs to an authorised character only' using errcode='42501';end if;
 if e.kind in('minor_grace','nyrha_state','tier_zero','nyrha_offer') or a.slot='passive' then
  raise exception 'This source is passive or story-only; it cannot be spent as a charge'
   using errcode='22023';end if;
 if e.kind='nyrha_revision' then
  raise exception 'Break the Pattern requires explicit Fracture choice and consent. Use the DM-confirmed Revision action.'
   using errcode='22023';end if;
 insert into public.terravale_divine_canon_state(character_id) values(c.id)
  on conflict(character_id) do nothing;
 select * into state from public.terravale_divine_canon_state where character_id=c.id for update;
 if e.kind='minor_intercession' then
  if state.minor_intercession_remaining<>1 then
   raise exception 'The shared Minor Intercession slot is expended until the next long rest' using errcode='22023';end if;
  update public.terravale_divine_canon_state
  set minor_intercession_remaining=0,updated_at=now() where character_id=c.id;
 else
  if a.max_uses is not null then
   if a.recovery='seven_days' and coalesce(a.uses_remaining,0)=0
      and a.next_available_at is not null and a.next_available_at<=now() then
    update public.terravale_divine_canon_awards
      set uses_remaining=a.max_uses,next_available_at=null where id=a.id;
    a.uses_remaining:=a.max_uses;
   end if;
   if coalesce(a.uses_remaining,0)<1 then
    raise exception 'All uses are expended until the listed recovery condition' using errcode='22023';end if;
   update public.terravale_divine_canon_awards set
    uses_remaining=a.uses_remaining-1,
    next_available_at=case when a.recovery='seven_days' then now()+interval '7 days' else next_available_at end,
    update_at=now()
   where id=a.id;
  end if;
 end if;
 if e.kind in('divine','concordant') and (coalesce(material_invocation,true) or e.kind='concordant') then
  for key in select distinct x from unnest(array[lower(e.patron),
         case when e.kind='concordant' then lower(e.other_patron) else null end]) x
         where x is not null loop
   pname:=key;
   label:=case key
    when 'amora' then 'Entanglement' when 'coeus' then 'Unverified Insight'
    when 'errigan' then 'Revel' when 'eshael' then 'Charge'
    when 'fjoras' then 'Road Debt' when 'ixi' then 'Burned'
    when 'kalma' then 'Held Names' when 'kwaeth' then 'Loose Threads'
    when 'luna' then 'Moonwake' when 'pae' then 'Solar Saturation'
    when 'rao' then 'Unsettled Accord' when 'torridae' then 'Battle Reckoning'
    when 'tyrius' then 'Wake Debt' when 'vaelniv' then 'Balance Debt'
    else 'Patron Burden' end;
   insert into public.terravale_divine_canon_burdens(character_id,patron_key,burden_name)
   values(c.id,key,label) on conflict(character_id,patron_key) do nothing;
   select stacks into old_stacks from public.terravale_divine_canon_burdens
    where character_id=c.id and patron_key=key for update;
   if exists(select 1 from public.terravale_divine_canon_burdens
       where character_id=c.id and patron_key=key and overflow_pending) then
    raise exception 'Resolve the pending patron overflow before another activation' using errcode='22023';end if;
   if old_stacks=3 then
    overflow_count:=overflow_count+1;
    update public.terravale_divine_canon_burdens
      set overflow_pending=true,updated_at=now()
    where character_id=c.id and patron_key=key;
    if key='ixi' then
     insert into public.terravale_divine_canon_effects(character_id,effect_key,stacks,note)
     values(c.id,'Scorched',1,'Burned overflow: permanent-looking mark until at least one Burned is settled')
     on conflict(character_id,effect_key) do update set stacks=1,updated_at=now();
    elsif key='errigan' then
     insert into public.terravale_divine_canon_effects(character_id,effect_key,stacks,note)
     values(c.id,'Blackout Sign',1,'Revel overflow: DM determines the consequential uncertain detail')
     on conflict(character_id,effect_key) do update set stacks=1,updated_at=now();
    end if;
   else
    update public.terravale_divine_canon_burdens
     set stacks=old_stacks+1,updated_at=now() where character_id=c.id and patron_key=key;
   end if;
  end loop;
 end if;
 if overflow_count>0 then
  update public.terravale_divine_canon_state
  set divine_pressure=least(100000,divine_pressure+least(overflow_count,2)),updated_at=now()
  where character_id=c.id;
 end if;
 -- Only an *explicit numeric* Drunk gain is machine applied. Blackout/Rapture
 -- thresholds are not specified in the archive and remain DM-adjudicated.
 if lower(e.patron)='errigan' and e.source_excerpt ~* 'gain [1-9] drunk stacks?' then
  drunk_inc:=coalesce((regexp_match(e.source_excerpt,'(?i)gain ([1-9]) drunk stacks?'))[1]::integer,0);
  if drunk_inc>0 then
   insert into public.terravale_divine_canon_effects(character_id,effect_key,stacks,note)
   values(c.id,'Drunk',drunk_inc,'Numeric Drunk gain from an activated Errigan boon; DM determines unlisted thresholds')
   on conflict(character_id,effect_key) do update set stacks=least(99,public.terravale_divine_canon_effects.stacks+excluded.stacks),updated_at=now();
  end if;
 end if;
 insert into public.terravale_divine_canon_history(character_id,award_id,actor_id,action,details)
 values(c.id,a.id,actor,'invoke',jsonb_build_object('source',e.name,'patron',e.patron,
  'material',material_invocation,'burden_overflows',overflow_count,
  'numeric_drunk_gained',drunk_inc,'uses_left',
  case when a.max_uses is not null then a.uses_remaining-1 else null end));
 return jsonb_build_object('used',true,'remaining',
   case when e.kind='minor_intercession' then 0
      when a.max_uses is not null then a.uses_remaining-1 else null end,
   'burden_overflows',overflow_count,'numeric_drunk_gained',drunk_inc);
end $tv281_use$;
revoke all on function public.terravale_divine_canon_use(uuid,boolean) from public,anon,authenticated;
grant execute on function public.terravale_divine_canon_use(uuid,boolean) to authenticated;

create or replace function public.terravale_divine_canon_rest(
 target_character uuid, rest_kind text
) returns jsonb language plpgsql security definer set search_path=''
as $tv281_rest$
declare actor uuid:=(select auth.uid());c public.characters%rowtype;refreshed integer:=0;
begin
 select * into c from public.characters where id=target_character for update;
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord')
  or c.id is null or not(c.owner_id=actor or authz.is_dm(c.campaign_id)) then
  raise exception 'Character owner or campaign DM required' using errcode='42501';end if;
 if rest_kind not in('short','long') then raise exception 'Choose short or long rest' using errcode='22023';end if;
 -- A maximum patron Burden blocks long-rest recovery even if later settled.
 update public.terravale_divine_canon_awards a set
  uses_remaining=a.max_uses,update_at=now()
 from public.terravale_divine_archive_entries e
 where a.entry_id=e.id and a.character_id=c.id and a.status in('active','dormant')
   and a.max_uses is not null and
     (a.recovery='short' or (rest_kind='long' and a.recovery='long'))
   and not exists (
    select 1 from public.terravale_divine_canon_burdens b
    where b.character_id=c.id and b.stacks=3
     and lower(e.kind) in('divine','concordant')
     and lower(b.patron_key) in(lower(e.patron),lower(coalesce(e.other_patron,'')))
   );
 GET DIAGNOSTICS refreshed=ROW_COUNT;
 if rest_kind='long' then
  insert into public.terravale_divine_canon_state(character_id,minor_intercession_remaining)
  values(c.id,1)
  on conflict(character_id) do update
   set minor_intercession_remaining=1,updated_at=now();
 end if;
 insert into public.terravale_divine_canon_history(character_id,actor_id,action,details)
 values(c.id,actor,'rest_recovery',jsonb_build_object('rest',rest_kind,'refreshed',refreshed));
 return jsonb_build_object('rest',rest_kind,'refreshed_awards',refreshed,
  'intercession_reset',rest_kind='long');
end $tv281_rest$;
revoke all on function public.terravale_divine_canon_rest(uuid,text) from public,anon,authenticated;
grant execute on function public.terravale_divine_canon_rest(uuid,text) to authenticated;

create or replace function public.terravale_divine_canon_dm_set_status(
 target_award uuid, new_status text, reason text default ''
) returns jsonb language plpgsql security definer set search_path=''
as $tv281_status$
declare actor uuid:=(select auth.uid());a public.terravale_divine_canon_awards%rowtype;
 c public.characters%rowtype;e public.terravale_divine_archive_entries%rowtype;
 n integer;
begin
 select * into a from public.terravale_divine_canon_awards where id=target_award for update;
 select * into c from public.characters where id=a.character_id for update;
 select * into e from public.terravale_divine_archive_entries where id=a.entry_id;
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord')
  or a.id is null or c.id is null or e.id is null or not authz.is_dm(c.campaign_id) then
  raise exception 'Verified campaign DM only' using errcode='42501';end if;
 if a.status='revoked' or new_status not in('active','dormant') then
  raise exception 'Cannot reactivate a revoked boon; request a fresh award' using errcode='22023';end if;
 if new_status='active' and a.status<>'active' then
  if e.kind in('divine','concordant') and exists(
   select 1 from public.terravale_divine_canon_burdens b where b.character_id=c.id
    and b.stacks=3 and b.patron_key in(lower(e.patron),lower(coalesce(e.other_patron,'')))
    and b.overflow_pending
  ) then raise exception 'Resolve patron overflow before reactivating' using errcode='22023';end if;
  if e.kind='nyrha_revision' then
   select count(*) into n from public.terravale_divine_canon_awards x
   join public.terravale_divine_archive_entries z on z.id=x.entry_id
   where x.character_id=c.id and x.status='active' and z.kind='nyrha_revision';
   if n >= (select case when entanglement<1 then 0 when entanglement<3 then 1
     when entanglement<5 then 2 else 3 end
     from public.terravale_divine_canon_state where character_id=c.id) then
    raise exception 'No free Nyrha active Revision slot' using errcode='22023';end if;
  end if;
 end if;
 update public.terravale_divine_canon_awards
  set status=new_status,update_at=now() where id=a.id;
 insert into public.terravale_divine_canon_history(character_id,award_id,actor_id,action,details)
 values(c.id,a.id,actor,'change_award_status',jsonb_build_object('from',a.status,
  'to',new_status,'reason',left(coalesce(reason,''),500)));
 return jsonb_build_object('id',a.id,'status',new_status);
end $tv281_status$;
revoke all on function public.terravale_divine_canon_dm_set_status(uuid,text,text) from public,anon,authenticated;
grant execute on function public.terravale_divine_canon_dm_set_status(uuid,text,text) to authenticated;

create or replace function public.terravale_divine_canon_dm_set_effect(
 target_character uuid, target_effect text, new_stacks integer, note text default ''
) returns jsonb language plpgsql security definer set search_path=''
as $tv281_effect$
declare actor uuid:=(select auth.uid());c public.characters%rowtype;
begin
 select * into c from public.characters where id=target_character for update;
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord')
 or c.id is null or not authz.is_dm(c.campaign_id) then
  raise exception 'Verified campaign DM only' using errcode='42501';end if;
 if target_effect not in('Drunk','Blackout','Rapture','Scorched','Blackout Sign')
 or new_stacks not between 0 and 99 then
  raise exception 'Unknown source condition or invalid stack count' using errcode='22023';end if;
 insert into public.terravale_divine_canon_effects(character_id,effect_key,stacks,note)
 values(c.id,target_effect,new_stacks,left(coalesce(note,''),1500))
 on conflict(character_id,effect_key) do update set
  stacks=excluded.stacks,note=excluded.note,updated_at=now();
 insert into public.terravale_divine_canon_history(character_id,actor_id,action,details)
 values(c.id,actor,'effect_adjust',jsonb_build_object('effect',target_effect,
   'stacks',new_stacks,'note',left(coalesce(note,''),300)));
 return jsonb_build_object('effect',target_effect,'stacks',new_stacks);
end $tv281_effect$;
revoke all on function public.terravale_divine_canon_dm_set_effect(uuid,text,integer,text)
 from public,anon,authenticated;
grant execute on function public.terravale_divine_canon_dm_set_effect(uuid,text,integer,text)
 to authenticated;

create or replace function public.terravale_divine_canon_dm_fracture(
 target_character uuid, target_award uuid, target_chain text,
 consequence text, consent_confirmed boolean
) returns jsonb language plpgsql security definer set search_path=''
as $tv281_fracture$
declare actor uuid:=(select auth.uid());c public.characters%rowtype;
 a public.terravale_divine_canon_awards%rowtype;e public.terravale_divine_archive_entries%rowtype;fid uuid;
begin
 select * into c from public.characters where id=target_character for update;
 select * into a from public.terravale_divine_canon_awards where id=target_award for update;
 select * into e from public.terravale_divine_archive_entries where id=a.entry_id;
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord')
  or c.id is null or a.id is null or a.character_id<>c.id or e.kind<>'nyrha_revision'
  or a.status<>'active' or not authz.is_dm(c.campaign_id) then
  raise exception 'Verified DM and active Nyrha Revision required' using errcode='42501';end if;
 if consent_confirmed is distinct from true or target_chain not in('Mercy','Justice','Oblivion')
  or char_length(trim(coalesce(consequence,''))) not between 8 and 1500 then
  raise exception 'Formal choice, explicit player consent and a bounded Fracture are required'
   using errcode='22023';end if;
 if coalesce(a.uses_remaining,0)<1 then raise exception 'Break already used this rest' using errcode='22023';end if;
 if exists(select 1 from public.terravale_divine_canon_fractures f
 where f.character_id=c.id and f.chain=target_chain and f.resolved_at is null) then
  raise exception 'Fracture Chain occupied: resolve Refuse/Collapse/Deepen explicitly'
    using errcode='22023';end if;
 insert into public.terravale_divine_canon_fractures(
  character_id,award_id,chain,consequence,created_by)
 values(c.id,a.id,target_chain,trim(consequence),actor) returning id into fid;
 update public.terravale_divine_canon_awards set uses_remaining=0,update_at=now()
 where id=a.id;
 insert into public.terravale_divine_canon_history(character_id,award_id,actor_id,action,details)
 values(c.id,a.id,actor,'break_pattern',jsonb_build_object('fracture_id',fid,'chain',target_chain,
  'consequence',left(consequence,500),'player_confirmed',true));
 return jsonb_build_object('fracture_id',fid,'chain',target_chain,'remaining_breaks',0);
end $tv281_fracture$;
revoke all on function public.terravale_divine_canon_dm_fracture(uuid,uuid,text,text,boolean)
 from public,anon,authenticated;
grant execute on function public.terravale_divine_canon_dm_fracture(uuid,uuid,text,text,boolean)
 to authenticated;

create or replace function public.terravale_divine_canon_dm_resolve_fracture(
 target_fracture uuid, resolution text
) returns jsonb language plpgsql security definer set search_path=''
as $tv281_resolve$
declare actor uuid:=(select auth.uid());f public.terravale_divine_canon_fractures%rowtype;
 c public.characters%rowtype;
begin
 select * into f from public.terravale_divine_canon_fractures where id=target_fracture for update;
 select * into c from public.characters where id=f.character_id;
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord')
 or f.id is null or c.id is null or not authz.is_dm(c.campaign_id) then
  raise exception 'Verified DM only' using errcode='42501';end if;
 if char_length(trim(coalesce(resolution,'')))<8 then raise exception 'Describe the meaningful Severance act'
 using errcode='22023';end if;
 if f.resolved_at is null then
  update public.terravale_divine_canon_fractures
   set resolved_at=now(),resolution=left(resolution,1500) where id=f.id;
  insert into public.terravale_divine_canon_history(character_id,award_id,actor_id,action,details)
  values(c.id,f.award_id,actor,'fracture_severed',
   jsonb_build_object('chain',f.chain,'resolution',left(resolution,500)));
 end if;
 return jsonb_build_object('id',f.id,'resolved',true);
end $tv281_resolve$;
revoke all on function public.terravale_divine_canon_dm_resolve_fracture(uuid,text)
 from public,anon,authenticated;
grant execute on function public.terravale_divine_canon_dm_resolve_fracture(uuid,text) to authenticated;

-- DM-only management overview, including dormant awards and all tracked burdens.
create or replace function public.terravale_divine_canon_dm_state(
 target_character uuid
) returns jsonb language plpgsql stable security definer set search_path=''
as $tv281_dm_state$
declare actor uuid:=(select auth.uid());c public.characters%rowtype;
begin
 select * into c from public.characters where id=target_character;
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord')
 or c.id is null or not authz.is_dm(c.campaign_id) then
  raise exception 'Verified campaign DM required' using errcode='42501';end if;
 return jsonb_build_object(
  'awards',coalesce((
   select jsonb_agg(jsonb_build_object(
    'id',a.id,'entry_id',e.id,'name',e.name,'kind',e.kind,'patron',e.patron,
    'other_patron',e.other_patron,'slot',a.slot,'tier',e.tier,
    'status',a.status,'max_uses',a.max_uses,'uses_remaining',a.uses_remaining,
    'recovery',a.recovery,'chosen_ability',a.chosen_ability,
    'source_path',e.source_path,'required_favour',e.required_favour,
    'required_favour_second',e.required_favour_second) order by a.granted_at)
   from public.terravale_divine_canon_awards a
   join public.terravale_divine_archive_entries e on e.id=a.entry_id
   where a.character_id=c.id and a.status in('active','dormant')
  ),'[]'::jsonb),
  'state',coalesce((
   select jsonb_build_object('entanglement',s.entanglement,
    'divine_pressure',s.divine_pressure,
    'minor_intercession_remaining',s.minor_intercession_remaining)
   from public.terravale_divine_canon_state s where s.character_id=c.id
  ),jsonb_build_object('entanglement',0,'divine_pressure',0,
   'minor_intercession_remaining',1)),
  'burdens',coalesce((
   select jsonb_agg(jsonb_build_object('patron',b.patron_key,
    'name',b.burden_name,'stacks',b.stacks,
    'overflow_pending',b.overflow_pending) order by b.patron_key)
   from public.terravale_divine_canon_burdens b where b.character_id=c.id
  ),'[]'::jsonb),
  'effects',coalesce((
   select jsonb_agg(jsonb_build_object('key',x.effect_key,'stacks',x.stacks,'note',x.note))
   from public.terravale_divine_canon_effects x where x.character_id=c.id
  ),'[]'::jsonb),
  'fractures',coalesce((
   select jsonb_agg(jsonb_build_object('id',f.id,'chain',f.chain,
    'consequence',f.consequence,'award_id',f.award_id))
   from public.terravale_divine_canon_fractures f
   where f.character_id=c.id and f.resolved_at is null
  ),'[]'::jsonb)
 );
end $tv281_dm_state$;
revoke all on function public.terravale_divine_canon_dm_state(uuid)
 from public,anon,authenticated;
grant execute on function public.terravale_divine_canon_dm_state(uuid) to authenticated;
