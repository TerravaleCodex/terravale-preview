-- V2.47: fixed, curated six-character demo reset and safely archived deletions.
create table if not exists public.terravale_demo_presets(
  slot int primary key check(slot between 1 and 6),
  name text not null,
  ancestry text not null,
  class_name text not null,
  approved_build jsonb not null,
  starting_state jsonb not null
);
alter table public.terravale_demo_presets enable row level security;
revoke all on public.terravale_demo_presets from public,anon,authenticated;
insert into public.terravale_demo_presets(slot,name,ancestry,class_name,approved_build,starting_state)
values (1,'Morrow Vey','Crimsonborn','Bloodforger','{"class":"Bloodforger","className":"Bloodforger","level":1,"ancestry":"Crimsonborn","maxHp":12,"details":{"crimsonStage":1},"summary":"A travelling Crimsonborn trained to defend fellow wayfarers. His story is deliberately non-canonical demo material.","character":{"id":null,"name":"Morrow Vey","ancestry":"Crimsonborn","className":"Bloodforger","level":1,"pronouns":"he/him","concept":"Quiet guardian who keeps dangerous hungers in check","backstory":"A travelling Crimsonborn trained to defend fellow wayfarers. His story is deliberately non-canonical demo material.","owner":"Demo","ownerName":"Aster","ownerTvUID":"","ownerUid":"","demoCurator":"aster","demo":true,"previewStatsOnly":false,"str":13,"dex":15,"con":14,"int":12,"wis":10,"cha":8,"maxHp":12,"hp":12,"ac":14,"speed":30,"initiative":2,"proficiency":2,"inventory":[],"bloodState":0,"crimsonStage":1,"skills":["Athletics","Perception"],"rulesV217":{"version":"2.19","skills":["Athletics","Perception"],"proficiency":2,"review":["Demonstration build: sample statistics only; consult published class rules for features."]},"sheetV220":{"tempHp":0,"resources":{},"conditions":[]}}}'::jsonb,'{"hp":12,"blood_state":0,"inventory":[],"resources":[],"conditions":[]}'::jsonb),
(2,'Pip Thornwhistle','Beastfolk','Ranger','{"class":"Ranger","className":"Ranger","level":1,"ancestry":"Beastfolk","maxHp":11,"details":{"crimsonStage":1},"summary":"A demo-only scout who records wildlife and roads for the Wayfarers'' Table.","character":{"id":null,"name":"Pip Thornwhistle","ancestry":"Beastfolk","className":"Ranger","level":1,"pronouns":"they/them","concept":"Curious pathfinder with an eye for tracks and hidden trails","backstory":"A demo-only scout who records wildlife and roads for the Wayfarers'' Table.","owner":"Demo","ownerName":"Aster","ownerTvUID":"","ownerUid":"","demoCurator":"aster","demo":true,"previewStatsOnly":false,"str":10,"dex":16,"con":12,"int":11,"wis":15,"cha":8,"maxHp":11,"hp":11,"ac":14,"speed":30,"initiative":3,"proficiency":2,"inventory":[],"bloodState":0,"crimsonStage":null,"skills":["Survival","Perception"],"rulesV217":{"version":"2.19","skills":["Survival","Perception"],"proficiency":2,"review":["Demonstration build: sample statistics only; consult published class rules for features."]},"sheetV220":{"tempHp":0,"resources":{},"conditions":[]}}}'::jsonb,'{"hp":11,"blood_state":0,"inventory":[],"resources":[],"conditions":[]}'::jsonb),
(3,'Elira Wren','Elf','Bard','{"class":"Bard","className":"Bard","level":1,"ancestry":"Elf","maxHp":9,"details":{"crimsonStage":1},"summary":"An itinerant storyteller who sees every gathering as a new chapter. Non-canonical sample character.","character":{"id":null,"name":"Elira Wren","ancestry":"Elf","className":"Bard","level":1,"pronouns":"she/her","concept":"Keeper of songs and stray histories","backstory":"An itinerant storyteller who sees every gathering as a new chapter. Non-canonical sample character.","owner":"Demo","ownerName":"Aster","ownerTvUID":"","ownerUid":"","demoCurator":"aster","demo":true,"previewStatsOnly":false,"str":8,"dex":14,"con":12,"int":13,"wis":10,"cha":16,"maxHp":9,"hp":9,"ac":12,"speed":30,"initiative":2,"proficiency":2,"inventory":[],"bloodState":0,"crimsonStage":null,"skills":["Performance","Persuasion"],"rulesV217":{"version":"2.19","skills":["Performance","Persuasion"],"proficiency":2,"review":["Demonstration build: sample statistics only; consult published class rules for features."]},"sheetV220":{"tempHp":0,"resources":{},"conditions":[]}}}'::jsonb,'{"hp":9,"blood_state":0,"inventory":[],"resources":[],"conditions":[]}'::jsonb),
(4,'Brann Copperveil','Dvergr','Gatewarden','{"class":"Gatewarden","className":"Gatewarden","level":1,"ancestry":"Dvergr","maxHp":13,"details":{"crimsonStage":1},"summary":"A demo-only dvergr who values strong doors and stronger promises.","character":{"id":null,"name":"Brann Copperveil","ancestry":"Dvergr","className":"Gatewarden","level":1,"pronouns":"he/him","concept":"Steady defender of old thresholds","backstory":"A demo-only dvergr who values strong doors and stronger promises.","owner":"Demo","ownerName":"Aster","ownerTvUID":"","ownerUid":"","demoCurator":"aster","demo":true,"previewStatsOnly":false,"str":16,"dex":10,"con":15,"int":12,"wis":13,"cha":8,"maxHp":13,"hp":13,"ac":16,"speed":25,"initiative":0,"proficiency":2,"inventory":[],"bloodState":0,"crimsonStage":null,"skills":["Athletics","Investigation"],"rulesV217":{"version":"2.19","skills":["Athletics","Investigation"],"proficiency":2,"review":["Demonstration build: sample statistics only; consult published class rules for features."]},"sheetV220":{"tempHp":0,"resources":{},"conditions":[]}}}'::jsonb,'{"hp":13,"blood_state":0,"inventory":[],"resources":[],"conditions":[]}'::jsonb),
(5,'Caelis Dawnfeather','Flugel','Ventweaver','{"class":"Ventweaver","className":"Ventweaver","level":1,"ancestry":"Flugel","maxHp":9,"details":{"crimsonStage":1},"summary":"A flugel wanderer included to preview the winged ancestry and its class pairing, without adding campaign canon.","character":{"id":null,"name":"Caelis Dawnfeather","ancestry":"Flugel","className":"Ventweaver","level":1,"pronouns":"they/them","concept":"Wind-touched observer of shifting horizons","backstory":"A flugel wanderer included to preview the winged ancestry and its class pairing, without adding campaign canon.","owner":"Demo","ownerName":"Aster","ownerTvUID":"","ownerUid":"","demoCurator":"aster","demo":true,"previewStatsOnly":false,"str":8,"dex":15,"con":12,"int":14,"wis":13,"cha":10,"maxHp":9,"hp":9,"ac":13,"speed":30,"initiative":2,"proficiency":2,"inventory":[],"bloodState":0,"crimsonStage":null,"skills":["Arcana","Perception"],"rulesV217":{"version":"2.19","skills":["Arcana","Perception"],"proficiency":2,"review":["Demonstration build: sample statistics only; consult published class rules for features."]},"sheetV220":{"tempHp":0,"resources":{},"conditions":[]}}}'::jsonb,'{"hp":9,"blood_state":0,"inventory":[],"resources":[],"conditions":[]}'::jsonb),
(6,'Tamsin Quickstep','Human','Rogue','{"class":"Rogue","className":"Rogue","level":1,"ancestry":"Human","maxHp":10,"details":{"crimsonStage":1},"summary":"An optimistic sample adventurer who insists that preparation is just another sort of luck.","character":{"id":null,"name":"Tamsin Quickstep","ancestry":"Human","className":"Rogue","level":1,"pronouns":"she/her","concept":"Clever finder of lost keys and unintended shortcuts","backstory":"An optimistic sample adventurer who insists that preparation is just another sort of luck.","owner":"Demo","ownerName":"Aster","ownerTvUID":"","ownerUid":"","demoCurator":"aster","demo":true,"previewStatsOnly":false,"str":9,"dex":16,"con":13,"int":14,"wis":12,"cha":10,"maxHp":10,"hp":10,"ac":14,"speed":30,"initiative":3,"proficiency":2,"inventory":[],"bloodState":0,"crimsonStage":null,"skills":["Sleight of Hand","Stealth"],"rulesV217":{"version":"2.19","skills":["Sleight of Hand","Stealth"],"proficiency":2,"review":["Demonstration build: sample statistics only; consult published class rules for features."]},"sheetV220":{"tempHp":0,"resources":{},"conditions":[]}}}'::jsonb,'{"hp":10,"blood_state":0,"inventory":[],"resources":[],"conditions":[]}'::jsonb)
on conflict(slot) do update set name=excluded.name,ancestry=excluded.ancestry,
 class_name=excluded.class_name,approved_build=excluded.approved_build,starting_state=excluded.starting_state;

create table if not exists public.terravale_demo_curator_credits(
 character_id uuid primary key references public.characters(id) on delete cascade,
 template_slot int not null references public.terravale_demo_presets(slot),
 display_player text not null default 'Aster',
 credit_kind text not null default 'fictional_demo_curator'
);
alter table public.terravale_demo_curator_credits enable row level security;
revoke all on public.terravale_demo_curator_credits from public,anon,authenticated;

create table if not exists public.terravale_character_delete_archive(
 archive_id bigint generated always as identity primary key,
 operation_id uuid not null,
 campaign_id uuid not null,
 character_id uuid not null,
 deleted_by uuid,
 reason text not null,
 character_snapshot jsonb not null,
 state_snapshot jsonb,
 recorded_at timestamptz not null default now()
);
alter table public.terravale_character_delete_archive enable row level security;
revoke all on public.terravale_character_delete_archive from public,anon,authenticated;

-- Real player demo chars remain limited to one per player.
-- Only the protected Aster curator fixtures may have a NULL owner.
create or replace function public.terravale_demo_character_limits()
returns trigger language plpgsql security definer set search_path=''
as $$
declare stage_number integer;
begin
 if not exists(select 1 from public.terravale_system_campaigns
   where campaign_id=new.campaign_id) then return new; end if;
 stage_number:=case when coalesce(new.approved_build #>> '{details,crimsonStage}','1') ~ '^[0-9]+$'
   then (new.approved_build #>> '{details,crimsonStage}')::int else 1 end;
 if new.status not in ('draft','approved')
    or coalesce(new.approved_build->>'level','1')<>'1' or stage_number<>1 then
   raise exception 'Demo allows level-one Stage 1 characters' using errcode='42501'; end if;
 if new.owner_id is null then
   if new.approved_build #>> '{character,demoCurator}' <> 'aster'
      or (auth.uid() is not null and not authz.is_site_dm()) then
     raise exception 'Demo curator sheets are only managed by the site DM' using errcode='42501'; end if;
 else
   if TG_OP='INSERT' and exists(select 1 from public.characters where
     campaign_id=new.campaign_id and owner_id=new.owner_id) then
     raise exception 'Demo allows one test character per player' using errcode='23514'; end if;
 end if;
 return new;
end $$;

create or replace function public.terravale_archive_character(
 c public.characters, actor uuid, action_name text, action_id uuid
) returns void language plpgsql security definer set search_path=''
as $$
begin
 insert into public.terravale_character_delete_archive(
 operation_id,campaign_id,character_id,deleted_by,reason,character_snapshot,state_snapshot)
 values(action_id,c.campaign_id,c.id,actor,action_name,to_jsonb(c),
        (select to_jsonb(cs) from public.character_state cs where cs.character_id=c.id));
end $$;
revoke all on function public.terravale_archive_character(public.characters,uuid,text,uuid) from public,anon,authenticated;

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
   seeded:=seeded+1;
 end loop;
 if seeded<>6 then raise exception 'Expected six curated demo characters, got %',seeded; end if;
 return jsonb_build_object('success',true,'removed',removed,'seeded',seeded,'operation_id',action_id);
end $$;
revoke all on function public.terravale_reset_demo_internal() from public,anon,authenticated;

create or replace function public.terravale_reset_demo(confirm_text text)
returns jsonb language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or not authz.is_site_dm()
   or not exists(select 1 from auth.identities
      where user_id=auth.uid() and provider='discord') then
   raise exception 'Verified site DM required' using errcode='42501'; end if;
 if confirm_text <> 'RESET DEMO' then
   raise exception 'Type RESET DEMO to confirm reset' using errcode='22023'; end if;
 return public.terravale_reset_demo_internal();
end $$;
revoke all on function public.terravale_reset_demo(text) from public,anon;
grant execute on function public.terravale_reset_demo(text) to authenticated;

create or replace function public.terravale_delete_character(target_character uuid,confirm_name text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 c public.characters;
 demo boolean;
 op uuid:=gen_random_uuid();
begin
 if auth.uid() is null or not exists(select 1 from auth.identities
    where user_id=auth.uid() and provider='discord') then
   raise exception 'Verified Discord account required' using errcode='28000'; end if;
 select * into c from public.characters where id=target_character for update;
 if not found then raise exception 'Character does not exist' using errcode='P0002'; end if;
 select exists(select 1 from public.terravale_system_campaigns where campaign_id=c.campaign_id) into demo;
 if not authz.is_dm(c.campaign_id) and not (demo and authz.is_site_dm()) then
   raise exception 'Only the campaign DM may delete this character' using errcode='42501'; end if;
 if confirm_name is distinct from c.name then
   raise exception 'Character name confirmation does not match' using errcode='22023'; end if;
 perform public.terravale_archive_character(c,auth.uid(),'dm_delete',op);
 delete from public.characters where id=c.id;
 return jsonb_build_object('deleted',true,'id',target_character,'name',c.name,'operation_id',op);
end $$;
revoke all on function public.terravale_delete_character(uuid,text) from public,anon;
grant execute on function public.terravale_delete_character(uuid,text) to authenticated;

create or replace function public.terravale_demo_curator_labels()
returns table(character_id uuid,display_player text,credit_kind text,template_slot int)
language sql stable security definer set search_path=''
as $$
 select d.character_id,d.display_player,d.credit_kind,d.template_slot
 from public.terravale_demo_curator_credits d
 join public.characters c on c.id=d.character_id
 where (authz.is_member(c.campaign_id) or authz.is_site_dm())
    and (select auth.uid()) is not null
 order by d.template_slot;
$$;
revoke all on function public.terravale_demo_curator_labels() from public,anon;
grant execute on function public.terravale_demo_curator_labels() to authenticated;

-- Initial explicit reset: archive the existing user's test character first.
select public.terravale_reset_demo_internal();
