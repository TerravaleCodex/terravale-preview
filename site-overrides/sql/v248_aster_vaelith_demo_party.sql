-- V2.48: add Aster Vaelith to the existing six-character demo party.
-- Preserve all six existing characters and their UUIDs for this initial addition.
alter table public.terravale_demo_presets
  drop constraint if exists terravale_demo_presets_slot_check;
alter table public.terravale_demo_presets
  add constraint terravale_demo_presets_slot_check check(slot between 1 and 7);

insert into public.terravale_demo_presets(slot,name,ancestry,class_name,approved_build,starting_state)
values(7,'Aster Vaelith','Flugel','Wizard','{"class":"Wizard","className":"Wizard","level":1,"ancestry":"Flugel","maxHp":7,"details":{"crimsonStage":1},"summary":"Born aboard a Flügel archive-vessel, Aster learned to recover fragile testimony and forgotten records. Now a Grand Library Retriever, he travels with his memory-crow Margin and a wayfaring circle of unlikely companions. He studies ordinary lives and endangered knowledge, offering protective magic, first aid and careful judgement rather than grand displays of power. This character sheet is a level-one demonstration adaptation of Aster Vaelith''s proposed recurring-NPC concept, not a new canonical campaign event.","character":{"name":"Aster Vaelith","ancestry":"Flugel","className":"Wizard","level":1,"pronouns":"he/him","age":"about 127 (working character detail)","concept":"Glass-Breath Flügel scholar, Grand Library Retriever and guardian of ordinary stories","backstory":"Born aboard a Flügel archive-vessel, Aster learned to recover fragile testimony and forgotten records. Now a Grand Library Retriever, he travels with his memory-crow Margin and a wayfaring circle of unlikely companions. He studies ordinary lives and endangered knowledge, offering protective magic, first aid and careful judgement rather than grand displays of power. This character sheet is a level-one demonstration adaptation of Aster Vaelith''s proposed recurring-NPC concept, not a new canonical campaign event.","str":8,"dex":14,"con":12,"int":16,"wis":13,"cha":10,"maxHp":7,"hp":7,"ac":12,"speed":30,"proficiency":2,"initiative":2,"bloodState":0,"skills":["Arcana","Investigation"],"savingThrows":["INT","WIS"],"ancestryVariation":"Glass-Breath","wings":"Dark Flügel wings emerge at the lower back/waist, not shoulder blades","companion":"Margin, a memory-crow; companion for flavour and research, not a free combat action","occupation":"Grand Library Retriever","partyRole":"Scholar, field medic and protective support","partyName":"The Wayfarers'' Table","inventory":[{"name":"Grand Library field notebook","quantity":1},{"name":"Ink-stained satchel","quantity":1},{"name":"Healer''s bandages","quantity":1},{"name":"Feather-marked reference folio","quantity":1}],"features":["Glass-Breath field tradition","Scholarly fieldwork","Protective magic — subject to approved class rules"],"spells":["Mending (flavour recommendation)","Mage Hand (flavour recommendation)","Shield (rules permitting)"],"sheetVisibleToParty":true,"previewStatsOnly":false,"owner":"Demo","ownerName":"Aster","ownerTvUID":"","ownerUid":"","demoCurator":"aster","demo":true,"rulesV217":{"version":"2.19","skills":["Arcana","Investigation"],"proficiency":2,"review":["Level-one demo sheet only; Aster''s proposed recurring NPC stat block was a different, provisional CR2 concept.","Wizard baseline is a playable demo adaptation; do not treat illustrative spells as imported Terravale class mechanics.","Margin is a memory-crow companion, not an additional player turn."]},"sheetV220":{"tempHp":0,"conditions":[],"resources":{},"death":{"dead":false,"fail":0,"success":0,"rolls":[]}}}}'::jsonb,'{"hp":7,"blood_state":0,"inventory":[{"name":"Grand Library field notebook","quantity":1},{"name":"Ink-stained satchel","quantity":1},{"name":"Healer''s bandages","quantity":1},{"name":"Feather-marked reference folio","quantity":1}],"resources":[],"conditions":[]}'::jsonb)
on conflict(slot) do update set name=excluded.name,ancestry=excluded.ancestry,class_name=excluded.class_name,
approved_build=excluded.approved_build,starting_state=excluded.starting_state;

-- All seven characters belong to the real playable roster.
insert into public.party_room_roster(character_id,campaign_id)
select c.id,c.campaign_id
from public.characters c join public.terravale_demo_curator_credits d on d.character_id=c.id
where c.campaign_id=(select campaign_id from public.terravale_system_campaigns where kind='wayfarers-demo')
on conflict(character_id) do nothing;

do $aster_party$
declare
 demo_id uuid;
 c_id uuid;
 preset public.terravale_demo_presets;
begin
 select campaign_id into demo_id from public.terravale_system_campaigns where kind='wayfarers-demo';
 perform pg_advisory_xact_lock(hashtextextended(demo_id::text,42));
 if not exists(select 1 from public.terravale_demo_curator_credits where template_slot=7) then
  select * into preset from public.terravale_demo_presets where slot=7;
  insert into public.characters(campaign_id,owner_id,name,status,approved_build,sheet_visible_to_party)
    values(demo_id,null,preset.name,'approved',preset.approved_build,true)
  returning id into c_id;
  update public.characters set approved_build=jsonb_set(approved_build,'{character,id}',to_jsonb(c_id::text),true)
   where id=c_id;
  update public.character_state set hp=(preset.starting_state->>'hp')::integer,
   blood_state=0,inventory=preset.starting_state->'inventory',resources='[]'::jsonb,
   conditions='[]'::jsonb,temp_hp=0,updated_at=now()
   where character_id=c_id;
  insert into public.terravale_demo_curator_credits(character_id,template_slot)
   values(c_id,7);
  insert into public.party_room_roster(character_id,campaign_id) values(c_id,demo_id);
 end if;
end $aster_party$;

create or replace function public.terravale_reset_demo_internal()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 demo_id uuid;
 action_id uuid := gen_random_uuid();
 old_char public.characters;
 preset public.terravale_demo_presets;
 new_id uuid;
 seeded int:=0; removed int:=0;
begin
 select campaign_id into demo_id from public.terravale_system_campaigns
 where kind='wayfarers-demo';
 if demo_id is null then raise exception 'Demo campaign unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(demo_id::text,42));
 for old_char in select * from public.characters where campaign_id=demo_id order by id for update loop
   perform public.terravale_archive_character(old_char,auth.uid(),'demo_reset',action_id);
   delete from public.characters where id=old_char.id;
   removed:=removed+1;
 end loop;
 for preset in select * from public.terravale_demo_presets order by slot loop
   insert into public.characters(campaign_id,owner_id,name,status,approved_build,sheet_visible_to_party)
   values(demo_id,null,preset.name,'approved',preset.approved_build,true) returning id into new_id;
   update public.characters set approved_build=jsonb_set(approved_build,
      '{character,id}',to_jsonb(new_id::text),true) where id=new_id;
   update public.character_state set
      hp=(preset.starting_state->>'hp')::integer,
      blood_state=(preset.starting_state->>'blood_state')::integer,
      inventory=preset.starting_state->'inventory',
      conditions=preset.starting_state->'conditions',
      resources=preset.starting_state->'resources',
      temp_hp=0,
      updated_at=now() where character_id=new_id;
   insert into public.terravale_demo_curator_credits(character_id,template_slot)
   values(new_id,preset.slot);
   insert into public.party_room_roster(character_id,campaign_id)
   values(new_id,demo_id)
   on conflict(character_id) do nothing;
   seeded:=seeded+1;
 end loop;
 if seeded<>7 then raise exception 'Expected seven curated demo characters, got %',seeded; end if;
 return jsonb_build_object('success',true,'removed',removed,'seeded',seeded,'operation_id',action_id);
end $$;

-- Group listing uses the real character UUIDs, not fabricated preview profiles.
create or replace function public.terravale_demo_party()
returns table(character_id uuid,character_name text,ancestry text,class_name text,
  level int,party_role text,curator text,sort_order int)
language sql stable security definer set search_path=''
as $$
 select c.id,c.name,coalesce(c.approved_build->>'ancestry',''),
        coalesce(c.approved_build->>'class',''),
        coalesce((c.approved_build->>'level')::int,1),
        coalesce(c.approved_build #>> '{character,partyRole}','Companion'),
        d.display_player,d.template_slot
 from public.terravale_demo_curator_credits d
 join public.characters c on c.id=d.character_id
 join public.terravale_system_campaigns s on s.campaign_id=c.campaign_id
 where s.kind='wayfarers-demo'
   and (authz.is_member(c.campaign_id) or authz.is_site_dm())
   and (select auth.uid()) is not null
 order by case when d.template_slot=7 then 0 else 1 end,d.template_slot;
$$;
revoke all on function public.terravale_demo_party() from public,anon;
grant execute on function public.terravale_demo_party() to authenticated;
