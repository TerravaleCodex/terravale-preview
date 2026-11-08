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
  'favour',case when show_scores then
   coalesce((select jsonb_agg(jsonb_build_object(
     'key',p.key_name,'name',p.name,'rank',p.rank,'score',f.score)
      order by p.name)
     from public.terravale_divine_favour f join public.terravale_divine_patrons p
      on p.id=f.patron_id where f.character_id=c.id),'[]'::jsonb)
   else '[]'::jsonb end,
  'granted',case when show_scores then coalesce((select jsonb_agg(jsonb_build_object(
    'id',g.id,'name',b.name,'kind',b.kind,'summary',b.summary,
    'mechanics',b.mechanics,'patron',p.name,'other_patron',q.name,
    'granted_at',g.granted_at) order by g.granted_at)
   from public.terravale_character_divine_boons g
   join public.terravale_dm_divine_boons b on b.id=g.boon_id
   join public.terravale_divine_patrons p on p.id=b.patron_id
   left join public.terravale_divine_patrons q on q.id=b.second_patron_id
   where g.character_id=c.id and g.status='active'),'[]'::jsonb) else '[]'::jsonb end,
  'can_view_scores',show_scores
 ) into result;
 return result;
end $function$;
revoke all on function public.terravale_divine_player_state(uuid) from public,anon;
grant execute on function public.terravale_divine_player_state(uuid) to authenticated;

-- Match the conventional-slot error message to the total-across-patrons rule.
CREATE OR REPLACE FUNCTION public.terravale_divine_dm_grant_boon(target_character uuid, target_boon uuid, give_boon boolean DEFAULT true, reason text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    where x.character_id=c.id and x.status='active' and z.kind<>'concordant';
   if active_count>=3 then raise exception 'Only three conventional active boons are allowed' using errcode='22023';end if;
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
end $function$;
revoke all on function public.terravale_divine_dm_grant_boon(uuid,uuid,boolean,text) from public,anon;
grant execute on function public.terravale_divine_dm_grant_boon(uuid,uuid,boolean,text) to authenticated;
