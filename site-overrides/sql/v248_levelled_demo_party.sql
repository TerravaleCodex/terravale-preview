-- V2.48: curated party progresses independently; ordinary player demo
-- characters remain capped at level 1 (and Stage 1).
create or replace function public.terravale_demo_character_limits()
returns trigger language plpgsql security definer set search_path=''
as $$
declare stage_number integer; char_level integer;
begin
 if not exists(select 1 from public.terravale_system_campaigns
   where campaign_id=new.campaign_id) then return new; end if;
 char_level:=case when coalesce(new.approved_build->>'level','1') ~ '^[0-9]+$'
   then (new.approved_build->>'level')::int else -1 end;
 stage_number:=case when coalesce(new.approved_build #>> '{details,crimsonStage}','1') ~ '^[0-9]+$'
   then (new.approved_build #>> '{details,crimsonStage}')::int else -1 end;
 if new.status not in ('draft','approved') then
   raise exception 'Demo character status must be a draft or approved' using errcode='42501'; end if;
 if new.owner_id is null then
   if new.approved_build #>> '{character,demoCurator}' <> 'aster'
      or (auth.uid() is not null and not authz.is_site_dm()) or
      char_level not between 1 and 20 or stage_number not between 1 and 3 then
     raise exception 'Invalid curated Aster demo character sheet' using errcode='42501'; end if;
 else
   if char_level<>1 or stage_number<>1 then
     raise exception 'Player-created demo characters must remain level 1 Stage 1' using errcode='42501'; end if;
   if TG_OP='INSERT' and exists(select 1 from public.characters where
      campaign_id=new.campaign_id and owner_id=new.owner_id) then
     raise exception 'Demo allows one test character per player' using errcode='23514'; end if;
 end if;
 return new;
end $$;

create temporary table _v248_builds(
 slot integer, character_level integer, maximum_hp integer, base_ac integer, stage integer,
 abilities jsonb, skill_names jsonb, level_choices jsonb, item_list jsonb
) on commit drop;
insert into _v248_builds(slot,character_level,maximum_hp,base_ac,stage,abilities,skill_names,level_choices,item_list)
values (1,5,48,15,2,'{"str":13,"dex":16,"con":16,"int":12,"wis":11,"cha":8}'::jsonb,'["Athletics","Perception","Survival"]'::jsonb,'[{"level":2,"choice":"Trained protective blood-control routines"},{"level":3,"choice":"Blood Bind and Lock Joint discipline direction (check node catalogue)"},{"level":4,"choice":"Dexterity score improvement"},{"level":5,"choice":"Prioritise ally protection and reserve management"}]'::jsonb,'[{"id":"demo-reinforced-field-coat","name":"Reinforced field coat","kind":"equipment","slot":"chest","location":"equipped","quantity":1,"qty":1,"description":""},{"id":"demo-ironwood-defensive-staff","name":"Ironwood defensive staff","kind":"equipment","slot":"main","location":"equipped","quantity":1,"qty":1,"description":""},{"id":"demo-vial-bandolier","name":"Vial bandolier","kind":"equipment","slot":"accessory","location":"equipped","quantity":1,"qty":1,"description":""},{"id":"demo-blood-assessment-kit","name":"Blood assessment kit","kind":"item","slot":"","location":"backpack","quantity":1,"qty":1,"description":""},{"id":"demo-satchel-of-folded-bandages","name":"Satchel of folded bandages","kind":"item","slot":"","location":"backpack","quantity":1,"qty":1,"description":""},{"id":"demo-rations","name":"Rations","kind":"item","slot":"","location":"backpack","quantity":5,"qty":5,"description":""},{"id":"demo-waterskin","name":"Waterskin","kind":"item","slot":"","location":"backpack","quantity":1,"qty":1,"description":""}]'::jsonb),
(2,3,28,14,1,'{"str":10,"dex":16,"con":12,"int":11,"wis":16,"cha":8}'::jsonb,'["Survival","Perception","Stealth"]'::jsonb,'[{"level":2,"choice":"Wilderness navigation and scouting focus"},{"level":3,"choice":"Feline Perception animal-family classification; Animal Classification with Perception"}]'::jsonb,'[{"id":"demo-trail-worn-leather-jerkin","name":"Trail-worn leather jerkin","kind":"equipment","slot":"chest","location":"equipped","quantity":1,"qty":1,"description":""},{"id":"demo-shortbow","name":"Shortbow","kind":"equipment","slot":"main","location":"equipped","quantity":1,"qty":1,"description":""},{"id":"demo-fletching-quiver","name":"Fletching quiver","kind":"equipment","slot":"accessory","location":"equipped","quantity":1,"qty":1,"description":""},{"id":"demo-scout-s-hooded-cloak","name":"Scout''s hooded cloak","kind":"equipment","slot":"cloak","location":"equipped","quantity":1,"qty":1,"description":""},{"id":"demo-trailcraft-tools","name":"Trailcraft tools","kind":"item","slot":"","location":"backpack","quantity":1,"qty":1,"description":""},{"id":"demo-arrows","name":"Arrows","kind":"item","slot":"","location":"backpack","quantity":20,"qty":20,"description":""},{"id":"demo-rope-50-ft","name":"Rope, 50 ft","kind":"item","slot":"","location":"backpack","quantity":1,"qty":1,"description":""},{"id":"demo-trail-rations","name":"Trail rations","kind":"item","slot":"","location":"backpack","quantity":6,"qty":6,"description":""}]'::jsonb),
(3,4,29,13,1,'{"str":8,"dex":14,"con":12,"int":13,"wis":10,"cha":18}'::jsonb,'["Performance","Persuasion","Insight","History"]'::jsonb,'[{"level":2,"choice":"Invest in narrative memory and travelling performances"},{"level":3,"choice":"Support-oriented musical performance"},{"level":4,"choice":"Charisma score improvement"}]'::jsonb,'[{"id":"demo-lute-in-a-weatherproof-case","name":"Lute in a weatherproof case","kind":"equipment","slot":"focus","location":"equipped","quantity":1,"qty":1,"description":""},{"id":"demo-slim-duelling-blade","name":"Slim duelling blade","kind":"equipment","slot":"main","location":"equipped","quantity":1,"qty":1,"description":""},{"id":"demo-travel-cloak","name":"Travel cloak","kind":"equipment","slot":"cloak","location":"equipped","quantity":1,"qty":1,"description":""},{"id":"demo-citywear-coat","name":"Citywear coat","kind":"equipment","slot":"chest","location":"equipped","quantity":1,"qty":1,"description":""},{"id":"demo-songbook-and-old-ballads","name":"Songbook and old ballads","kind":"item","slot":"","location":"backpack","quantity":1,"qty":1,"description":""},{"id":"demo-ink-and-travel-diary","name":"Ink and travel diary","kind":"item","slot":"","location":"backpack","quantity":1,"qty":1,"description":""},{"id":"demo-spare-lute-strings","name":"Spare lute strings","kind":"item","slot":"","location":"backpack","quantity":4,"qty":4,"description":""}]'::jsonb),
(4,7,68,18,1,'{"str":18,"dex":10,"con":16,"int":12,"wis":13,"cha":8}'::jsonb,'["Athletics","Investigation","Insight"]'::jsonb,'[{"level":2,"choice":"First defensive training"},{"level":3,"choice":"Protective threshold-keeper techniques"},{"level":4,"choice":"Strength score improvement"},{"level":5,"choice":"Ward-bearing protective positioning"},{"level":6,"choice":"Durability and investigation of weak points"},{"level":7,"choice":"Allied frontline defence"}]'::jsonb,'[{"id":"demo-ward-etched-warhammer","name":"Ward-etched warhammer","kind":"equipment","slot":"main","location":"equipped","quantity":1,"qty":1,"description":""},{"id":"demo-ironbound-shield","name":"Ironbound shield","kind":"equipment","slot":"off","location":"equipped","quantity":1,"qty":1,"description":""},{"id":"demo-reinforced-mail","name":"Reinforced mail","kind":"equipment","slot":"chest","location":"equipped","quantity":1,"qty":1,"description":""},{"id":"demo-keeper-s-gauntlets","name":"Keeper''s gauntlets","kind":"equipment","slot":"gloves","location":"equipped","quantity":1,"qty":1,"description":""},{"id":"demo-iron-master-key","name":"Iron master key","kind":"equipment","slot":"accessory","location":"equipped","quantity":1,"qty":1,"description":""},{"id":"demo-chalk-for-marking-thresholds","name":"Chalk for marking thresholds","kind":"item","slot":"","location":"backpack","quantity":1,"qty":1,"description":""},{"id":"demo-repair-hammer-and-nails","name":"Repair hammer and nails","kind":"item","slot":"","location":"backpack","quantity":1,"qty":1,"description":""},{"id":"demo-travelling-lantern","name":"Travelling lantern","kind":"item","slot":"","location":"backpack","quantity":1,"qty":1,"description":""}]'::jsonb),
(5,2,17,13,1,'{"str":8,"dex":16,"con":12,"int":14,"wis":13,"cha":10}'::jsonb,'["Arcana","Perception","Nature"]'::jsonb,'[{"level":2,"choice":"Safe-descent wind observation and weather-reading focus"}]'::jsonb,'[{"id":"demo-wind-compass","name":"Wind compass","kind":"equipment","slot":"focus","location":"equipped","quantity":1,"qty":1,"description":""},{"id":"demo-feather-light-travelling-robes","name":"Feather-light travelling robes","kind":"equipment","slot":"chest","location":"equipped","quantity":1,"qty":1,"description":""},{"id":"demo-flight-safe-boots","name":"Flight-safe boots","kind":"equipment","slot":"feet","location":"equipped","quantity":1,"qty":1,"description":""},{"id":"demo-weatherproof-cape","name":"Weatherproof cape","kind":"equipment","slot":"cloak","location":"equipped","quantity":1,"qty":1,"description":""},{"id":"demo-wind-charts","name":"Wind charts","kind":"item","slot":"","location":"backpack","quantity":1,"qty":1,"description":""},{"id":"demo-dried-herbs","name":"Dried herbs","kind":"item","slot":"","location":"backpack","quantity":3,"qty":3,"description":""},{"id":"demo-traveller-s-water-bottle","name":"Traveller''s water bottle","kind":"item","slot":"","location":"backpack","quantity":1,"qty":1,"description":""}]'::jsonb),
(6,6,42,16,1,'{"str":9,"dex":18,"con":14,"int":14,"wis":12,"cha":10}'::jsonb,'["Sleight of Hand","Stealth","Acrobatics","Investigation"]'::jsonb,'[{"level":2,"choice":"Fast, quiet infiltration"},{"level":3,"choice":"Lockwork and high-mobility specialism"},{"level":4,"choice":"Dexterity score improvement"},{"level":5,"choice":"Safer scouting under pressure"},{"level":6,"choice":"Investigation and short-range tactical mobility"}]'::jsonb,'[{"id":"demo-balanced-shortblade","name":"Balanced shortblade","kind":"equipment","slot":"main","location":"equipped","quantity":1,"qty":1,"description":""},{"id":"demo-throwing-knife","name":"Throwing knife","kind":"equipment","slot":"off","location":"equipped","quantity":1,"qty":1,"description":""},{"id":"demo-fitted-leather-armour","name":"Fitted leather armour","kind":"equipment","slot":"chest","location":"equipped","quantity":1,"qty":1,"description":""},{"id":"demo-quiet-boots","name":"Quiet boots","kind":"equipment","slot":"feet","location":"equipped","quantity":1,"qty":1,"description":""},{"id":"demo-lockpick-toolkit","name":"Lockpick toolkit","kind":"item","slot":"","location":"backpack","quantity":1,"qty":1,"description":""},{"id":"demo-folded-map-of-known-shortcuts","name":"Folded map of known shortcuts","kind":"item","slot":"","location":"backpack","quantity":1,"qty":1,"description":""},{"id":"demo-smoke-coloured-cloak","name":"Smoke-coloured cloak","kind":"equipment","slot":"cloak","location":"equipped","quantity":1,"qty":1,"description":""},{"id":"demo-copper-coins","name":"Copper coins","kind":"item","slot":"","location":"backpack","quantity":16,"qty":16,"description":""}]'::jsonb),
(7,6,39,13,1,'{"str":8,"dex":14,"con":12,"int":18,"wis":14,"cha":10}'::jsonb,'["Arcana","Investigation","History","Medicine"]'::jsonb,'[{"level":2,"choice":"Protective magic and library fieldwork"},{"level":3,"choice":"Recording lost histories and minor restorative work"},{"level":4,"choice":"Intelligence score improvement"},{"level":5,"choice":"Careful defensive spell preparation and exploration"},{"level":6,"choice":"Master more advanced research and recovery techniques"}]'::jsonb,'[{"id":"demo-grand-library-field-notebook","name":"Grand Library field notebook","kind":"item","slot":"","location":"backpack","quantity":1,"qty":1,"description":""},{"id":"demo-ink-stained-satchel","name":"Ink-stained satchel","kind":"equipment","slot":"accessory","location":"equipped","quantity":1,"qty":1,"description":""},{"id":"demo-healer-s-bandages","name":"Healer''s bandages","kind":"item","slot":"","location":"backpack","quantity":3,"qty":3,"description":""},{"id":"demo-feather-marked-reference-folio","name":"Feather-marked reference folio","kind":"item","slot":"","location":"backpack","quantity":1,"qty":1,"description":""},{"id":"demo-travel-staff","name":"Travel staff","kind":"equipment","slot":"main","location":"equipped","quantity":1,"qty":1,"description":""},{"id":"demo-light-archive-robes","name":"Light archive robes","kind":"equipment","slot":"chest","location":"equipped","quantity":1,"qty":1,"description":""},{"id":"demo-quick-reference-spellbook","name":"Quick-reference spellbook","kind":"item","slot":"","location":"backpack","quantity":1,"qty":1,"description":""},{"id":"demo-fine-writing-tools","name":"Fine writing tools","kind":"item","slot":"","location":"backpack","quantity":1,"qty":1,"description":""}]'::jsonb);

with normalized as (
 select slot,character_level,maximum_hp,base_ac,stage,skill_names,level_choices,item_list,
 abilities, jsonb_build_object(
   'str',abilities->'str','dex',abilities->'dex','con',abilities->'con',
   'int',abilities->'int','wis',abilities->'wis','cha',abilities->'cha',
   'level',character_level,'maxHp',maximum_hp,'hp',maximum_hp,'ac',base_ac,
   'inventory',item_list,'skills',skill_names,
   'progressionChoices',level_choices,'demoProgressionNote',
   'This curated demo shows plausible level and equipment decisions, not unverified class mechanics.',
   'crimsonStage',stage,
   'proficiency',2+floor((character_level-1)/4)
 ) updates
 from _v248_builds
)
update public.terravale_demo_presets p
set approved_build=jsonb_set(
    jsonb_set(
     jsonb_set(
      jsonb_set(
       jsonb_set(
        jsonb_set(p.approved_build,'{level}',to_jsonb(b.character_level),true),
        '{maxHp}',to_jsonb(b.maximum_hp),true),
       '{details,crimsonStage}',to_jsonb(b.stage),true),
      '{character}',(p.approved_build->'character')||b.updates,true),
     '{character,rulesV217,skills}',b.skill_names,true),
    '{character,rulesV217,proficiency}',to_jsonb(2+floor((b.character_level-1)/4)),true),
    starting_state=jsonb_build_object('hp',b.maximum_hp,'blood_state',0,
          'inventory',b.item_list,'conditions','[]'::jsonb,'resources','[]'::jsonb)
from normalized b where b.slot=p.slot;

update public.characters c
set approved_build=p.approved_build
from public.terravale_demo_presets p
join public.terravale_demo_curator_credits cr on cr.template_slot=p.slot
where c.id=cr.character_id;
update public.characters c
set approved_build=jsonb_set(approved_build,'{character,id}',to_jsonb(c.id::text),true)
where exists(select 1 from public.terravale_demo_curator_credits cr where cr.character_id=c.id);
update public.character_state cs
set hp=(p.starting_state->>'hp')::int,
 inventory=p.starting_state->'inventory',updated_at=now()
from public.terravale_demo_curator_credits cr
join public.terravale_demo_presets p on p.slot=cr.template_slot
where cs.character_id=cr.character_id;

do $check$
declare num integer;
begin
 select count(*) into num from public.terravale_demo_presets
 where (approved_build->>'level')::int>1 and
   jsonb_array_length(approved_build #> '{character,inventory}')>0 and
   jsonb_array_length(approved_build #> '{character,progressionChoices}')>=1;
 if num<>7 then raise exception 'Expected seven complete levelled demo templates, got %',num; end if;
end $check$;
