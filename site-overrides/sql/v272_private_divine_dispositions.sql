-- V2.72: atmospheric, non-numeric private divine relationships for owners/DMs.
-- Public/shared views still receive only general deity descriptions.
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
  -- Deliberately coarse, owner/DM-only indications. No raw score, thresholds, or percentages in player response.
  'dispositions',case when show_scores then
    coalesce((select jsonb_agg(jsonb_build_object(
      'key',p.key_name,
      'disposition',case
       when f.score<=-6 then 'ominous'
       when f.score<=-1 then 'cold'
       when f.score<=2 then 'veiled'
       when f.score<=7 then 'watchful'
       else 'favoured' end
    ) order by p.name)
     from public.terravale_divine_favour f
     join public.terravale_divine_patrons p on p.id=f.patron_id
     where f.character_id=c.id and p.campaign_id=c.campaign_id
       and p.rank in('major','greater')),'[]'::jsonb)
    else '[]'::jsonb end,
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

