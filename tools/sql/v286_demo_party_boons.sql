-- V2.86: Canonical boon showcase for the SEPARATE Wayfarers demo campaign.
-- This script is idempotent; it never touches real player-owned characters,
-- existing awards, real campaigns, inventories, HP, or approvals.
-- It uses the verified campaign-DM RPC and records no invented lore reasons.
begin;
do $v286_demo$
declare
 v_campaign public.campaigns%rowtype;
 v_character public.characters%rowtype;
 v_boon public.terravale_divine_archive_entries%rowtype;
 v_patron uuid;
 v_direct integer;
 v_result jsonb;
 v_added integer:=0;
 v_existing integer:=0;
 row record;
begin
 select * into v_campaign from public.campaigns
 where name='The Wayfarers’ Table · Demo';
 if v_campaign.id is null or v_campaign.owner_id is null then
  raise exception 'Expected unique, owned Wayfarers demo campaign';end if;
 if (select count(*) from public.characters c where c.campaign_id=v_campaign.id
      and c.status='approved' and c.owner_id is null
      and c.approved_build->'character'->>'demo'='true')<>7 then
  raise exception 'Seven approved ownerless demonstration characters are required';end if;
 perform set_config('request.jwt.claim.sub',v_campaign.owner_id::text,true);
 if not exists(select 1 from auth.identities where user_id=v_campaign.owner_id and provider='discord')
    or not authz.is_dm(v_campaign.id) then
  raise exception 'Expected verified campaign DM authorization for demo seeding'
   using errcode='42501';end if;
 for row in
  select * from (values
   ('Aster Vaelith','Coeus','Ink Remembers','passive'),
   ('Aster Vaelith','Coeus','Measured Casting','major'),
   ('Brann Copperveil','Rao','Sheltering Presence','passive'),
   ('Brann Copperveil','Rao','Joy Shared','major'),
   ('Caelis Dawnfeather','Fjoras','The Road Knows You','passive'),
   ('Caelis Dawnfeather','Fjoras','Just Keep Walking','reaction'),
   ('Elira Wren','Errigan','Living Rhythm','passive'),
   ('Morrow Vey','Eshael','Gentle Hands','passive'),
   ('Morrow Vey','Eshael','Wombwarden’s Instinct','reaction'),
   ('Pip Thornwhistle','Vaelniv','Animal Sense','passive'),
   ('Pip Thornwhistle','Vaelniv','Respect the Prey','major'),
   ('Tamsin Quickstep','Kwaeth','Hidden Hand','passive'),
   ('Tamsin Quickstep','Kwaeth','Slip of the Tongue','reaction')
  ) as gifts(character_name,patron_name,boon_name,boon_slot)
 loop
  select * into v_character from public.characters c
  where c.campaign_id=v_campaign.id and c.name=row.character_name
    and c.status='approved' and c.owner_id is null
    and c.approved_build->'character'->>'demo'='true';
  if v_character.id is null then
   raise exception 'Unsafe or missing demo character: %',row.character_name;end if;
  select * into v_boon from public.terravale_divine_archive_entries e
  where e.campaign_id=v_campaign.id and e.name=row.boon_name
   and lower(e.patron)=lower(row.patron_name)
   and e.kind='divine' and e.tier=1 and e.required_favour=1;
  if v_boon.id is null then
   raise exception 'Unverified archive boon: % / %',row.patron_name,row.boon_name;end if;
  if exists(select 1 from public.terravale_divine_canon_awards a
    where a.character_id=v_character.id and a.entry_id=v_boon.id
      and a.status in('active','dormant')) then
   v_existing:=v_existing+1;continue;
  end if;
  select p.id into v_patron from public.terravale_divine_patrons p
  where p.campaign_id=v_campaign.id and lower(p.key_name)=lower(row.patron_name);
  if v_patron is null then
   raise exception 'No canonical patron registration for %',row.patron_name;end if;
  select f.score into v_direct from public.terravale_divine_favour f
  where f.character_id=v_character.id and f.patron_id=v_patron;
  if coalesce(v_direct,0)<v_boon.required_favour then
   perform public.terravale_divine_dm_set_favour_v282(
    v_character.id,v_patron,v_boon.required_favour,
    'Demo preview setup, not campaign canon',false);
  end if;
  v_result:=public.terravale_divine_canon_grant(
   v_character.id,v_boon.id,row.boon_slot,null,'');
  if coalesce((v_result->>'granted')::boolean,false) is not true
    or v_result->>'slot'<>row.boon_slot then
   raise exception 'Boon grant failed for %: %',row.character_name,v_result;end if;
  if row.boon_name in(
    'Measured Casting','Joy Shared','Just Keep Walking','Living Rhythm',
    'Wombwarden’s Instinct','Respect the Prey','Slip of the Tongue')
    and (v_result->>'max_uses')::integer<>1 then
   raise exception 'Incorrect source charge inference for %: %',
     row.boon_name,v_result;end if;
  v_added:=v_added+1;
 end loop;
 raise notice 'Demo party: % new source-backed boons, % already present; no real players modified',
   v_added,v_existing;
end $v286_demo$;
commit;
