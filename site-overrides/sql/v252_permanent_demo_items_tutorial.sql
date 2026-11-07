-- V2.52: Curated demonstration characters are permanent, independently saved records.
-- Never delete/reseed them on an ordinary demo restore. Keep all existing UUIDs,
-- character sheets, live HP, inventories, feats and other player-created demo chars.

create or replace function public.terravale_reset_demo(confirm_text text)
returns jsonb language plpgsql security definer set search_path=''
as $block$
begin
  raise exception 'The demo party is now permanent; no reset operation is available.'
    using errcode='42501';
end $block$;

create or replace function public.terravale_reset_demo_internal()
returns jsonb language plpgsql security definer set search_path=''
as $block$
begin
  raise exception 'Curated demo characters are permanent. Destructive reseeding is disabled.'
    using errcode='42501';
end $block$;
revoke all on function public.terravale_reset_demo_internal() from public,anon,authenticated;

-- Extend the existing verified-account tutorial's saved step range to support
-- the new invite -> campaign page -> start character flow.
create or replace function public.terravale_set_tutorial_progress(
 new_step integer, finish boolean
) returns jsonb language plpgsql security definer set search_path=''
as $tour$
declare uid uuid:=(select auth.uid()); rec public.terravale_user_preferences%rowtype;
begin
 if uid is null or not exists(
  select 1 from auth.identities where user_id=uid and provider='discord'
 ) then raise exception 'Verified Discord authentication required' using errcode='28000'; end if;
 if new_step is null or new_step<0 or new_step>20 then
  raise exception 'Invalid tutorial step' using errcode='22023';
 end if;
 insert into public.terravale_user_preferences(user_id,tutorial_last_step,tutorial_completed_at)
 values(uid,new_step,case when finish then now() else null end)
 on conflict(user_id) do update set
  tutorial_last_step=excluded.tutorial_last_step,
  tutorial_completed_at=case when finish
     then coalesce(public.terravale_user_preferences.tutorial_completed_at,now())
     else public.terravale_user_preferences.tutorial_completed_at end,
  updated_at=now()
 returning * into rec;
 return jsonb_build_object('tutorial_last_step',rec.tutorial_last_step,
  'tutorial_completed',rec.tutorial_completed_at is not null);
end $tour$;
revoke all on function public.terravale_set_tutorial_progress(integer,boolean) from public,anon;
grant execute on function public.terravale_set_tutorial_progress(integer,boolean) to authenticated;

-- Protect Aster and his six companions against ordinary character deletion:
-- they are actual permanent campaign characters, not disposable test fixtures.
create or replace function public.terravale_delete_character(
 target_character uuid, confirm_name text
) returns jsonb language plpgsql security definer set search_path=''
as $delete$
declare c public.characters; demo boolean; op uuid:=gen_random_uuid();
begin
 if auth.uid() is null or not exists(
   select 1 from auth.identities where user_id=auth.uid() and provider='discord'
 ) then raise exception 'Verified Discord account required' using errcode='28000'; end if;
 select * into c from public.characters where id=target_character for update;
 if not found then raise exception 'Character does not exist' using errcode='P0002'; end if;
 if exists(select 1 from public.terravale_demo_curator_credits
            where character_id=target_character) then
   raise exception 'Aster-curated characters are permanent campaign records and cannot be deleted'
      using errcode='42501';
 end if;
 select exists(select 1 from public.terravale_system_campaigns
                where campaign_id=c.campaign_id) into demo;
 if not authz.is_dm(c.campaign_id) and not (demo and authz.is_site_dm()) then
   raise exception 'Only the campaign DM may delete this character' using errcode='42501';
 end if;
 if confirm_name is distinct from c.name then
   raise exception 'Character name confirmation does not match' using errcode='22023';
 end if;
 perform public.terravale_archive_character(c,auth.uid(),'dm_delete',op);
 delete from public.characters where id=c.id;
 return jsonb_build_object('deleted',true,'id',target_character,'name',c.name,'operation_id',op);
end $delete$;

-- Populate meaningful, demonstration-only DM-approved equipment and consumable
-- examples, without replacing existing inventory or claiming campaign lore canon.
-- All references correspond to items already equipped / carried in each character.
with mechanics(slot,item_id,properties) as (
 values
 (1,'demo-ironwood-defensive-staff','{"weapon_action":true,"attack_ability":"str","damage_ability":"str","damage_dice":"1d6","damage_type":"bludgeoning","proficient":true,"features":"A practical, sturdy staff. This attack profile demonstrates ordinary weapon rolls, not a bespoke class ability."}'::jsonb),
 (1,'demo-vial-bandolier','{"resource_tracker":true,"charges":3,"max_charges":3,"charge_cost":1,"recovery":"manual","features":"Three prepared field vials. Expend a vial to demonstrate item charges; they do not magically refill after resting. The DM decides what each vial accomplishes."}'::jsonb),
 (2,'demo-shortbow','{"weapon_action":true,"attack_ability":"dex","damage_ability":"dex","damage_dice":"1d6","damage_type":"piercing","proficient":true,"features":"Shortbow attack demonstration. Arrows remain separately tracked in the backpack; this action does not consume ammunition automatically."}'::jsonb),
 (2,'demo-scout-s-hooded-cloak','{"resource_tracker":true,"charges":2,"max_charges":2,"charge_cost":1,"recovery":"long","recharge_amount":0,"features":"Demo-only: briefly masks tracks in the wilderness, subject to DM approval. Showcases a long-rest rechargeable item."}'::jsonb),
 (3,'demo-slim-duelling-blade','{"weapon_action":true,"attack_ability":"dex","damage_ability":"dex","damage_dice":"1d8","damage_type":"piercing","proficient":true,"features":"A slender duelling weapon. Demo attack and damage rolls; the Dungeon Master applies outcomes."}'::jsonb),
 (3,'demo-lute-in-a-weatherproof-case','{"attunement":true,"attuned":false,"resource_tracker":true,"charges":2,"max_charges":3,"charge_cost":1,"recovery":"long","recharge_amount":0,"features":"Demo-only resonant refrain. Requires attunement; expend one charge for a scene-setting musical echo. Mechanical effects require a DM ruling."}'::jsonb),
 (4,'demo-ward-etched-warhammer','{"weapon_action":true,"attack_ability":"str","damage_ability":"str","damage_dice":"1d8","damage_type":"bludgeoning","proficient":true,"features":"Gatewarden warhammer, used here to demonstrate melee attacks and damage."}'::jsonb),
 (4,'demo-keeper-s-gauntlets','{"attunement":true,"attuned":false,"ac_bonus":1,"resource_tracker":true,"charges":1,"max_charges":3,"charge_cost":1,"recovery":"short","recharge_dice":"1d4","features":"Demo-only warding gauntlets. While equipped and attuned, grant +1 effective AC. Recharge 1d4 charges on a short or long rest; effect activation is DM-adjudicated."}'::jsonb),
 (5,'demo-wind-compass','{"resource_tracker":true,"charges":3,"max_charges":5,"charge_cost":1,"recovery":"short","recharge_dice":"1d4","features":"Demo-only compass pulse: expend one charge to reveal a brief safe windward direction. Rest recovery illustrates dice-based charge restoration."}'::jsonb),
 (5,'demo-flight-safe-boots','{"resource_tracker":true,"charges":1,"max_charges":2,"charge_cost":1,"recovery":"dawn","recharge_amount":0,"features":"Demo-only stabilising gust. Recharge requires the DM to confirm dawn; a long rest alone will not trigger it."}'::jsonb),
 (6,'demo-balanced-shortblade','{"weapon_action":true,"attack_ability":"dex","damage_ability":"dex","damage_dice":"1d6","damage_type":"piercing","proficient":true,"features":"An agile shortblade, demonstrating Dexterity attack and damage rolls."}'::jsonb),
 (6,'demo-smoke-coloured-cloak','{"resource_tracker":true,"charges":1,"max_charges":2,"charge_cost":1,"recovery":"dawn","recharge_amount":0,"features":"Demo-only smoke-shroud effect. The cloak charges can be spent from Resources and recharged only by DM-confirmed dawn."}'::jsonb),
 (7,'demo-travel-staff','{"weapon_action":true,"attack_ability":"str","damage_ability":"str","damage_dice":"1d6","damage_type":"bludgeoning","proficient":true,"features":"Aster plain field staff. The weapon action is illustrative; he remains primarily a protective scholar."}'::jsonb),
 (7,'demo-grand-library-field-notebook','{"attunement":true,"attuned":false,"resource_tracker":true,"charges":2,"max_charges":4,"charge_cost":1,"recovery":"long","recharge_amount":0,"features":"Demo-only Archivist Recall: expend one charge to request a clue from the DM about an already recorded piece of knowledge. Requires attunement; it cannot create unearned lore."}'::jsonb)
), matched as (
 select credits.character_id,mechanics.item_id,mechanics.properties
 from mechanics
 join public.terravale_demo_curator_credits credits on credits.template_slot=mechanics.slot
 join public.character_state s on s.character_id=credits.character_id
 where exists(select 1 from jsonb_array_elements(s.inventory) as item
              where item->>'id'=mechanics.item_id)
)
insert into public.character_item_properties(character_id,item_id,properties)
select character_id,item_id,properties from matched
on conflict on constraint character_item_properties_pkey do nothing;

-- Aster's live party membership is restored only when missing, never replaced.
insert into public.party_room_roster(character_id,campaign_id)
select credits.character_id,c.campaign_id
from public.terravale_demo_curator_credits credits
join public.characters c on c.id=credits.character_id
on conflict(character_id) do nothing;

do $verify$
declare slots int; live int; entries int; aster int;
begin
 select count(distinct cc.template_slot),count(distinct cc.character_id) into slots,live
 from public.terravale_demo_curator_credits cc
 join public.characters c on c.id=cc.character_id
 join public.terravale_system_campaigns s on s.campaign_id=c.campaign_id
 where s.kind='wayfarers-demo';
 select count(*) into entries
 from public.character_item_properties p
 join public.terravale_demo_curator_credits cc on cc.character_id=p.character_id;
 select count(*) into aster from public.terravale_demo_curator_credits cc
 join public.characters c on c.id=cc.character_id
 join public.party_room_roster r on r.character_id=c.id
 where c.name='Aster Vaelith' and cc.template_slot=7;
 if slots<>7 or live<>7 or entries<14 or aster<>1 then
   raise exception 'Curated party integrity check failed: slots %, characters %, items %, Aster %',
      slots,live,entries,aster;
 end if;
end $verify$;
