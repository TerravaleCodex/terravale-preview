-- V2.82 accepted Tier 0 is an award, but activating it can alter the
-- campaign. Log the event without inventing mechanics or transferring costs.
create or replace function public.terravale_divine_canon_dm_record_bargain(
 target_award uuid, consequence text default ''
) returns jsonb language plpgsql security definer set search_path=''
as $v282_bargain$
declare actor uuid:=(select auth.uid());a public.terravale_divine_canon_awards%rowtype;
 c public.characters%rowtype;e public.terravale_divine_archive_entries%rowtype;
begin
 select * into a from public.terravale_divine_canon_awards where id=target_award for update;
 select * into c from public.characters where id=a.character_id;
 select * into e from public.terravale_divine_archive_entries where id=a.entry_id;
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord')
   or a.id is null or a.status<>'active' or c.id is null or e.kind<>'tier_zero'
   or not authz.is_dm(c.campaign_id) then
   raise exception 'Active, consented Tier 0 bargain and campaign DM required'
   using errcode='42501';end if;
 if not exists(select 1 from public.terravale_divine_canon_offers o
  where o.character_id=c.id and o.entry_id=e.id and o.status in('accepted','fulfilled'))
 then raise exception 'The original bargain was not accepted by this character'
 using errcode='22023';end if;
 insert into public.terravale_divine_canon_history(character_id,award_id,actor_id,action,details)
 values(c.id,a.id,actor,'tier_zero_invoked',
  jsonb_build_object('source',e.source_path,'original_title',e.name,
   'dm_outcome',left(coalesce(consequence,''),1500)));
 return jsonb_build_object('recorded',true,'award_id',a.id);
end $v282_bargain$;
revoke all on function public.terravale_divine_canon_dm_record_bargain(uuid,text)
 from public,anon,authenticated;
grant execute on function public.terravale_divine_canon_dm_record_bargain(uuid,text) to authenticated;
