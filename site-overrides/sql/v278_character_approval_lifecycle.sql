-- Terravale V2.78 · Initial character approval and real level-up reviews.
-- Never set character status back to draft when modifying ordinary sheet state.
-- RLS-protected source tables are accessed through verified, character-scoped RPCs.
create or replace function public.terravale_dm_approve_initial_character(
  target_character uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $v278_initial$
declare
 actor uuid := (select auth.uid());
 ch public.characters%rowtype;
begin
 if actor is null or not exists (
  select 1 from auth.identities where user_id=actor and provider='discord'
 ) then
  raise exception 'Verified Discord sign-in required' using errcode='28000';
 end if;
 select * into ch from public.characters where id=target_character for update;
 if not found or not authz.is_dm(ch.campaign_id) then
  raise exception 'Campaign DM access required' using errcode='42501';
 end if;
 if ch.status='approved' then
  return jsonb_build_object('approved',true,'already_approved',true,'id',ch.id);
 end if;
 if ch.status<>'draft' or ch.owner_id is null
   or ch.approved_build->>'level' <> '1' then
  raise exception 'Only an unapproved, player-created level-one character may receive initial approval'
    using errcode='22023';
 end if;
 update public.characters set status='approved' where id=ch.id;
 insert into public.audit_events(character_id,actor_id,action,previous_value,next_value)
 values (ch.id,actor,'terravale_initial_character_approval',
   jsonb_build_object('status',ch.status),
   jsonb_build_object('status','approved','level',1));
 return jsonb_build_object('approved',true,'already_approved',false,'id',ch.id);
end $v278_initial$;
revoke all on function public.terravale_dm_approve_initial_character(uuid)
 from public,anon,authenticated;
grant execute on function public.terravale_dm_approve_initial_character(uuid)
 to authenticated;

create or replace function public.terravale_request_character_level_up(
 target_character uuid
) returns jsonb
language plpgsql security definer set search_path=''
as $v278_request$
declare
 actor uuid := (select auth.uid());
 ch public.characters%rowtype;
 lv integer;
 pending public.approval_requests%rowtype;
 out_id uuid;
begin
 if actor is null or not exists(
  select 1 from auth.identities where user_id=actor and provider='discord'
 ) then
  raise exception 'Verified Discord sign-in required' using errcode='28000';
 end if;
 select * into ch from public.characters where id=target_character for update;
 if not found or ch.owner_id is distinct from actor
   or not authz.is_member(ch.campaign_id) then
  raise exception 'Only the character owner may request advancement'
   using errcode='42501';
 end if;
 if ch.status<>'approved' then
  raise exception 'First character approval is required before advancement'
    using errcode='22023';
 end if;
 if coalesce(ch.approved_build->>'level','') !~ '^([1-9]|1[0-9]|20)$' then
  raise exception 'Current level is invalid' using errcode='22023';
 end if;
 lv := (ch.approved_build->>'level')::integer;
 if lv>=20 then raise exception 'Level 20 is the maximum' using errcode='22023'; end if;
 select * into pending from public.approval_requests
 where character_id=ch.id and status='pending' and proposed_changes->>'kind'='level_up'
 order by created_at desc limit 1;
 if found then
  if (pending.proposed_changes->>'from_level')::integer=lv
    and (pending.proposed_changes->>'to_level')::integer=lv+1 then
   return jsonb_build_object('id',pending.id,'pending',true,'already_requested',true,
     'from_level',lv,'to_level',lv+1);
  end if;
  raise exception 'An earlier level-up request still requires DM review'
    using errcode='22023';
 end if;
 insert into public.approval_requests(character_id,requester_id,proposed_changes,status)
 values(ch.id,actor,
   jsonb_build_object('kind','level_up','from_level',lv,'to_level',lv+1),
   'pending') returning id into out_id;
 return jsonb_build_object('id',out_id,'pending',true,'already_requested',false,
  'from_level',lv,'to_level',lv+1);
end $v278_request$;
revoke all on function public.terravale_request_character_level_up(uuid)
 from public,anon,authenticated;
grant execute on function public.terravale_request_character_level_up(uuid)
 to authenticated;

create or replace function public.terravale_dm_decide_character_level_up(
 target_request uuid, approve_level boolean
) returns jsonb
language plpgsql security definer set search_path=''
as $v278_decide$
declare
 actor uuid := (select auth.uid());
 req public.approval_requests%rowtype;
 ch public.characters%rowtype;
 from_lv integer; to_lv integer; current_lv integer;
 new_build jsonb; decided_status text;
begin
 if actor is null or not exists(
  select 1 from auth.identities where user_id=actor and provider='discord'
 ) then
  raise exception 'Verified Discord sign-in required' using errcode='28000';
 end if;
 if approve_level is null then
  raise exception 'A decision is required' using errcode='22023';
 end if;
 select * into req from public.approval_requests where id=target_request for update;
 if not found or req.proposed_changes->>'kind' <> 'level_up' then
  raise exception 'Level-up request not found' using errcode='22023';
 end if;
 select * into ch from public.characters where id=req.character_id for update;
 if not found or not authz.is_dm(ch.campaign_id) then
  raise exception 'Campaign DM access required' using errcode='42501';
 end if;
 if req.status<>'pending' then
  return jsonb_build_object('id',req.id,'status',req.status,
    'already_decided',true);
 end if;
 if ch.status <> 'approved' or ch.owner_id is distinct from req.requester_id
  or coalesce(req.proposed_changes->>'from_level','') !~ '^([1-9]|1[0-9]|20)$'
  or coalesce(req.proposed_changes->>'to_level','') !~ '^([1-9]|1[0-9]|20)$'
  or coalesce(ch.approved_build->>'level','') !~ '^([1-9]|1[0-9]|20)$'
 then raise exception 'Character or level-up request is no longer eligible'
   using errcode='22023'; end if;
 from_lv := (req.proposed_changes->>'from_level')::integer;
 to_lv := (req.proposed_changes->>'to_level')::integer;
 current_lv := (ch.approved_build->>'level')::integer;
 if to_lv<>from_lv+1 or current_lv<>from_lv then
  raise exception 'The character level has changed; review a fresh request'
    using errcode='22023';
 end if;
 if approve_level then
  new_build := jsonb_set(
    jsonb_set(ch.approved_build,'{level}',to_jsonb(to_lv),true),
    '{character,level}',to_jsonb(to_lv),true
  );
  update public.characters set approved_build=new_build where id=ch.id;
  decided_status:='approved';
  insert into public.audit_events(character_id,actor_id,action,previous_value,next_value)
  values(ch.id,actor,'terravale_level_up_approved',
    jsonb_build_object('level',from_lv),
    jsonb_build_object('level',to_lv,'request_id',req.id));
 else
  decided_status:='rejected';
  insert into public.audit_events(character_id,actor_id,action,previous_value,next_value)
  values(ch.id,actor,'terravale_level_up_rejected',
    jsonb_build_object('level',from_lv),
    jsonb_build_object('level',from_lv,'request_id',req.id));
 end if;
 update public.approval_requests
 set status=decided_status,
     resolution_note=case when approve_level
        then 'Level-up approved by campaign DM'
        else 'Level-up declined by campaign DM' end
 where id=req.id;
 return jsonb_build_object('id',req.id,'status',decided_status,
  'already_decided',false,'from_level',from_lv,
  'to_level',case when approve_level then to_lv else from_lv end);
end $v278_decide$;
revoke all on function public.terravale_dm_decide_character_level_up(uuid,boolean)
 from public,anon,authenticated;
grant execute on function public.terravale_dm_decide_character_level_up(uuid,boolean)
 to authenticated;
