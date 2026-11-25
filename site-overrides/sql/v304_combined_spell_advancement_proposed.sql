-- PROPOSED ONLY: combined known-caster level/spell advancement.
-- Requires v299-v303. No execute grants; no production deployment.
-- Legacy v278 approval must be guarded before enabling this workflow.
begin;
create function public.terravale_submit_spell_advancement(p_character uuid,p_revision integer,p_add text[],p_remove text[])
returns jsonb language plpgsql security definer set search_path='' as $f$
declare actor uuid:=(select auth.uid()); ch public.characters%rowtype;
 b public.terravale_spellbook_records%rowtype; pin public.terravale_spellbook_rule_pins%rowtype;
 ids text[]; out_id uuid;
begin
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord') then raise exception 'Verified account required' using errcode='28000'; end if;
 select * into ch from public.characters where id=p_character for update;
 if not found or ch.owner_id is distinct from actor or not authz.is_member(ch.campaign_id) then raise exception 'Character owner required' using errcode='42501'; end if;
 select * into b from public.terravale_spellbook_records where character_id=ch.id for update;
 if not found then raise exception 'Approved spellbook required' using errcode='22023'; end if;
 select * into pin from public.terravale_spellbook_rule_pins where character_id=ch.id;
 if not found or pin.owner_id is distinct from actor or pin.campaign_id is distinct from ch.campaign_id
 or ch.status is distinct from 'approved' or b.revision is distinct from p_revision
 or b.rules_revision is distinct from pin.rules_revision or b.approved_class is distinct from pin.class_name
 or ch.approved_build->>'class' is distinct from b.approved_class
 or ch.approved_build#>>'{character,className}' is distinct from b.approved_class
 or ch.approved_build->>'level' is distinct from b.approved_level::text
 or ch.approved_build#>>'{character,level}' is distinct from b.approved_level::text
 or b.approved_level>=20 or b.grants<>'[]'::jsonb or b.prepared<>'[]'::jsonb
 then raise exception 'Stale or unsupported spellbook' using errcode='40001'; end if;
 select coalesce(array_agg(x.id),array[]::text[]) into ids from jsonb_array_elements_text(b.learned) x(id);
 if public.terravale_validate_known_spell_delta(b.approved_class,b.approved_level,b.approved_level+1,ids,p_add,p_remove,pin.editions) is distinct from true then raise exception 'Invalid advancement choices' using errcode='22023'; end if;
 if exists(select 1 from public.approval_requests where character_id=ch.id and status='pending' and proposed_changes->>'kind' in ('level_up','spell_level_up'))
 then raise exception 'Advancement already pending' using errcode='22023'; end if;
 insert into public.approval_requests(character_id,requester_id,proposed_changes,status)
 values(ch.id,actor,jsonb_build_object('kind','spell_level_up','from_level',b.approved_level,'to_level',b.approved_level+1,'spellbook_revision',b.revision,'rules_revision',b.rules_revision,'add',to_jsonb(p_add),'remove',to_jsonb(p_remove)),'pending') returning id into out_id;
 return jsonb_build_object('id',out_id,'status','pending');
end $f$;
revoke all on function public.terravale_submit_spell_advancement(uuid,integer,text[],text[]) from public,anon,authenticated;

create function public.terravale_dm_decide_spell_advancement(p_request uuid,p_approve boolean)
returns jsonb language plpgsql security definer set search_path='' as $f$
declare actor uuid:=(select auth.uid()); cid uuid; ch public.characters%rowtype; req public.approval_requests%rowtype;
 b public.terravale_spellbook_records%rowtype; pin public.terravale_spellbook_rule_pins%rowtype;
 ids text[]; additions text[]; removals text[]; result_status text; next_level integer;
begin
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord') then raise exception 'Verified account required' using errcode='28000'; end if;
 if p_approve is null then raise exception 'Decision required' using errcode='22023'; end if;
 select character_id into cid from public.approval_requests where id=p_request;
 if not found then raise exception 'Request unavailable' using errcode='42501'; end if;
 select * into ch from public.characters where id=cid for update;
 if not found or not authz.is_member(ch.campaign_id) or not authz.is_dm(ch.campaign_id) then raise exception 'Campaign DM required' using errcode='42501'; end if;
 select * into req from public.approval_requests where id=p_request and character_id=ch.id for update;
 if not found or req.proposed_changes->>'kind' is distinct from 'spell_level_up' then raise exception 'Request unavailable' using errcode='22023'; end if;
 if req.status<>'pending' then return jsonb_build_object('id',req.id,'status',req.status,'already_decided',true); end if;
 if ch.owner_id is null or ch.owner_id is distinct from req.requester_id then raise exception 'Ownership changed' using errcode='42501'; end if;
 if p_approve then
  select * into b from public.terravale_spellbook_records where character_id=ch.id for update;
  if not found then raise exception 'Approved spellbook required' using errcode='22023'; end if;
  select * into pin from public.terravale_spellbook_rule_pins where character_id=ch.id;
  if not found or pin.owner_id is distinct from ch.owner_id or pin.campaign_id is distinct from ch.campaign_id
  or ch.status is distinct from 'approved' or b.rules_revision is distinct from pin.rules_revision
  or b.approved_class is distinct from pin.class_name or ch.approved_build->>'class' is distinct from b.approved_class
  or ch.approved_build#>>'{character,className}' is distinct from b.approved_class
  or ch.approved_build->>'level' is distinct from b.approved_level::text
  or ch.approved_build#>>'{character,level}' is distinct from b.approved_level::text
  or req.proposed_changes->>'from_level' is distinct from b.approved_level::text
  or req.proposed_changes->>'to_level' is distinct from (b.approved_level+1)::text
  or req.proposed_changes->>'spellbook_revision' is distinct from b.revision::text
  or req.proposed_changes->>'rules_revision' is distinct from b.rules_revision
  or b.approved_level>=20 or b.grants<>'[]'::jsonb or b.prepared<>'[]'::jsonb
  or jsonb_typeof(req.proposed_changes->'add') is distinct from 'array'
  or jsonb_typeof(req.proposed_changes->'remove') is distinct from 'array'
  then raise exception 'Stale or unsupported advancement' using errcode='40001'; end if;
  if exists(select 1 from jsonb_array_elements((req.proposed_changes->'add')||(req.proposed_changes->'remove')) x(v) where jsonb_typeof(x.v)<>'string') then raise exception 'Invalid choices' using errcode='22023'; end if;
  select coalesce(array_agg(x.id),array[]::text[]) into ids from jsonb_array_elements_text(b.learned) x(id);
  select coalesce(array_agg(x.id),array[]::text[]) into additions from jsonb_array_elements_text(req.proposed_changes->'add') x(id);
  select coalesce(array_agg(x.id),array[]::text[]) into removals from jsonb_array_elements_text(req.proposed_changes->'remove') x(id);
  next_level:=b.approved_level+1;
  if public.terravale_validate_known_spell_delta(b.approved_class,b.approved_level,next_level,ids,additions,removals,pin.editions) is distinct from true then raise exception 'Invalid advancement choices' using errcode='22023'; end if;
  update public.terravale_spellbook_records set learned=to_jsonb(array(select x from unnest(ids) x where not(x=any(removals)))||additions),approved_level=next_level,revision=b.revision+1,updated_at=now() where character_id=ch.id;
  update public.characters set approved_build=jsonb_set(jsonb_set(ch.approved_build,'{level}',to_jsonb(next_level),true),'{character,level}',to_jsonb(next_level),true) where id=ch.id;
  result_status:='approved';
 else result_status:='rejected';
 end if;
 update public.approval_requests set status=result_status,resolution_note='Combined spell advancement '||result_status where id=req.id;
 insert into public.audit_events(character_id,actor_id,action,previous_value,next_value) values(ch.id,actor,'terravale_spell_advancement_'||result_status,jsonb_build_object('request_id',req.id,'status','pending'),jsonb_build_object('request_id',req.id,'status',result_status,'level',next_level));
 return jsonb_build_object('id',req.id,'status',result_status,'already_decided',false);
end $f$;
revoke all on function public.terravale_dm_decide_spell_advancement(uuid,boolean) from public,anon,authenticated;
commit;
