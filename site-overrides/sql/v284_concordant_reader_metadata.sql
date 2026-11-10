-- V2.84 — Preserve original activation/Favour slot classification when a
-- source-backed Concordant is equipped in the dedicated sheet seat.
-- This adds metadata only to an authorised recipient's already-granted boon.
CREATE OR REPLACE FUNCTION public.terravale_divine_canon_player_state(target_character uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=(select auth.uid());c public.characters%rowtype;allowed boolean;payload jsonb;
begin
 select * into c from public.characters where id=target_character;
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord')
  or c.id is null or not authz.is_member(c.campaign_id) then
  raise exception 'Verified campaign membership required' using errcode='42501';end if;
 allowed:=c.owner_id=actor or authz.is_dm(c.campaign_id);
 if not allowed and not(c.status='approved' and coalesce(c.sheet_visible_to_party,false)) then
  raise exception 'Character not shared' using errcode='42501';end if;
 select jsonb_build_object(
  'granted',case when allowed then coalesce((
   select jsonb_agg(jsonb_build_object(
    'id',a.id,'name',e.name,'kind',e.kind,'summary',e.source_heading,
    'mechanics',e.source_excerpt,'patron',e.patron,'other_patron',e.other_patron,
    'slot',a.slot,'source_slot',e.slot,'tier',e.tier,'chosen_ability',a.chosen_ability,
    'activation',e.activation,'uses_text',e.uses_text,'source_path',e.source_path,
    'required_favour',e.required_favour,'required_favour_second',e.required_favour_second,
    'max_charges',a.max_uses,'charges_remaining',a.uses_remaining,
    'recovery',a.recovery,'available_at',a.next_available_at,
    'source_kind','canonical','grant_status',a.status
   ) order by a.granted_at)
   from public.terravale_divine_canon_awards a
   join public.terravale_divine_archive_entries e on e.id=a.entry_id
   where a.character_id=c.id and a.status='active'
  ),'[]'::jsonb) else '[]'::jsonb end,
  'divine_state',case when allowed then coalesce((
   select jsonb_build_object('entanglement',s.entanglement,
    'divine_pressure',s.divine_pressure,
    'minor_intercession_remaining',s.minor_intercession_remaining)
   from public.terravale_divine_canon_state s where s.character_id=c.id
  ),jsonb_build_object('entanglement',0,'divine_pressure',0,
   'minor_intercession_remaining',1)) else '{}'::jsonb end,
  'burdens',case when allowed then coalesce((
   select jsonb_agg(jsonb_build_object(
    'patron',b.patron_key,'name',b.burden_name,'stacks',b.stacks,
    'overflow_pending',b.overflow_pending) order by b.patron_key)
   from public.terravale_divine_canon_burdens b where b.character_id=c.id
    and (b.stacks>0 or b.overflow_pending)
  ),'[]'::jsonb) else '[]'::jsonb end,
  'statuses',case when allowed then coalesce((
   select jsonb_agg(jsonb_build_object('key',x.effect_key,
    'stacks',x.stacks,'note',x.note) order by x.effect_key)
   from public.terravale_divine_canon_effects x where x.character_id=c.id and x.stacks>0
  ),'[]'::jsonb) else '[]'::jsonb end,
  'fractures',case when allowed then coalesce((
   select jsonb_agg(jsonb_build_object('id',f.id,'chain',f.chain,
    'consequence',f.consequence,'award_id',f.award_id) order by f.created_at)
   from public.terravale_divine_canon_fractures f
   where f.character_id=c.id and f.resolved_at is null
  ),'[]'::jsonb) else '[]'::jsonb end
 ) into payload;
 return payload;
end $function$
;