-- PROPOSED ONLY. Apply after v299, v300, v302 to an isolated test database.
-- No execute grants. Base known-caster initial selections only.
begin;
create function public.terravale_dm_decide_initial_spells(p_proposal uuid,p_approve boolean)
returns jsonb language plpgsql security definer set search_path='' as $f$
declare actor uuid:=(select auth.uid()); cid uuid; ch public.characters%rowtype;
 req public.terravale_spellbook_proposals%rowtype; pin public.terravale_spellbook_rule_pins%rowtype;
 ids text[]; result_status text;
begin
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord') then
  raise exception 'Verified account required' using errcode='28000';
 end if;
 if p_approve is null then raise exception 'Decision required' using errcode='22023'; end if;
 -- Lock character first, consistent with submission lock order.
 select character_id into cid from public.terravale_spellbook_proposals where id=p_proposal;
 if not found then raise exception 'Proposal unavailable' using errcode='42501'; end if;
 select * into ch from public.characters where id=cid for update;
 if not found or not authz.is_member(ch.campaign_id) or not authz.is_dm(ch.campaign_id) then
  raise exception 'Campaign DM required' using errcode='42501';
 end if;
 select * into req from public.terravale_spellbook_proposals where id=p_proposal and character_id=ch.id for update;
 if not found or req.kind is distinct from 'initial' then raise exception 'Initial proposal unavailable' using errcode='22023'; end if;
 if req.status is distinct from 'pending' then return jsonb_build_object('id',req.id,'status',req.status,'already_decided',true); end if;
 if ch.owner_id is distinct from req.requester_id or ch.owner_id is null then raise exception 'Ownership changed' using errcode='42501'; end if;
 if p_approve then
  select * into pin from public.terravale_spellbook_rule_pins where character_id=ch.id for update;
  if not found or pin.owner_id is distinct from ch.owner_id or pin.campaign_id is distinct from ch.campaign_id
   or ch.status is distinct from 'approved' or ch.approved_build->>'level' is distinct from '1'
   or ch.approved_build->>'class' is distinct from pin.class_name
   or ch.approved_build#>>'{character,className}' is distinct from pin.class_name
   or ch.approved_build#>>'{character,level}' is distinct from '1'
   or req.approved_level<>1 or req.expected_revision<>0
   or req.choices->>'rules_revision' is distinct from pin.rules_revision
   or jsonb_typeof(req.choices->'learned') is distinct from 'array'
   or exists(select 1 from public.terravale_spellbook_records where character_id=ch.id)
  then raise exception 'Stale or unverified spell proposal' using errcode='40001'; end if;
  if exists(select 1 from jsonb_array_elements(req.choices->'learned') x(v) where jsonb_typeof(x.v)<>'string') then
   raise exception 'Malformed spell choices' using errcode='22023'; end if;
  select coalesce(array_agg(x.id order by x.ord),array[]::text[]) into ids
   from jsonb_array_elements_text(req.choices->'learned') with ordinality x(id,ord);
  if public.terravale_validate_initial_known(pin.class_name,ids,pin.editions) is distinct from true then
   raise exception 'Invalid spell choices' using errcode='22023'; end if;
  -- Base selections only. No grants or prepared spells are inferred from client input.
  insert into public.terravale_spellbook_records(character_id,revision,rules_revision,approved_class,approved_level,learned)
   values(ch.id,1,pin.rules_revision,pin.class_name,1,to_jsonb(ids));
  result_status:='approved';
 else result_status:='rejected';
 end if;
 update public.terravale_spellbook_proposals set status=result_status where id=req.id;
 insert into public.audit_events(character_id,actor_id,action,previous_value,next_value)
 values(ch.id,actor,'terravale_initial_spells_'||result_status,
 jsonb_build_object('status','pending','proposal_id',req.id),
 jsonb_build_object('status',result_status,'proposal_id',req.id,'spellbook_revision',case when p_approve then 1 else null end));
 return jsonb_build_object('id',req.id,'status',result_status,'already_decided',false);
end $f$;
revoke all on function public.terravale_dm_decide_initial_spells(uuid,boolean) from public,anon,authenticated;
commit;
