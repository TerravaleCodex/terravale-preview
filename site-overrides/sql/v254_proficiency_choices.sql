-- Terravale V2.54 reviewed class tools and language choices, with
-- server-authorised DM bonus choice grants and preserved legacy fields.
create table if not exists public.terravale_proficiency_catalog(
 id text primary key,kind text not null check(kind in('tool','language')),
 label text not null,category text not null,
 enabled boolean not null default true,restricted boolean not null default false
);
alter table public.terravale_proficiency_catalog enable row level security;
revoke all on public.terravale_proficiency_catalog from public,anon,authenticated;
grant select on public.terravale_proficiency_catalog to authenticated;
drop policy if exists tv_proficiency_catalog_read on public.terravale_proficiency_catalog;
create policy tv_proficiency_catalog_read on public.terravale_proficiency_catalog
 for select to authenticated using (true);
insert into public.terravale_proficiency_catalog(id,kind,label,category,enabled,restricted)
select id,kind,label,category,enabled,restricted
from jsonb_to_recordset('[{"id":"alchemist-s-supplies","label":"Alchemist''s Supplies","kind":"tool","category":"Artisan''s Tools","enabled":true,"restricted":false},{"id":"brewer-s-supplies","label":"Brewer''s Supplies","kind":"tool","category":"Artisan''s Tools","enabled":true,"restricted":false},{"id":"calligrapher-s-supplies","label":"Calligrapher''s Supplies","kind":"tool","category":"Artisan''s Tools","enabled":true,"restricted":false},{"id":"carpenter-s-tools","label":"Carpenter''s Tools","kind":"tool","category":"Artisan''s Tools","enabled":true,"restricted":false},{"id":"cartographer-s-tools","label":"Cartographer''s Tools","kind":"tool","category":"Artisan''s Tools","enabled":true,"restricted":false},{"id":"cobbler-s-tools","label":"Cobbler''s Tools","kind":"tool","category":"Artisan''s Tools","enabled":true,"restricted":false},{"id":"cook-s-utensils","label":"Cook''s Utensils","kind":"tool","category":"Artisan''s Tools","enabled":true,"restricted":false},{"id":"glassblower-s-tools","label":"Glassblower''s Tools","kind":"tool","category":"Artisan''s Tools","enabled":true,"restricted":false},{"id":"jeweler-s-tools","label":"Jeweler''s Tools","kind":"tool","category":"Artisan''s Tools","enabled":true,"restricted":false},{"id":"leatherworker-s-tools","label":"Leatherworker''s Tools","kind":"tool","category":"Artisan''s Tools","enabled":true,"restricted":false},{"id":"mason-s-tools","label":"Mason''s Tools","kind":"tool","category":"Artisan''s Tools","enabled":true,"restricted":false},{"id":"painter-s-supplies","label":"Painter''s Supplies","kind":"tool","category":"Artisan''s Tools","enabled":true,"restricted":false},{"id":"potter-s-tools","label":"Potter''s Tools","kind":"tool","category":"Artisan''s Tools","enabled":true,"restricted":false},{"id":"smith-s-tools","label":"Smith''s Tools","kind":"tool","category":"Artisan''s Tools","enabled":true,"restricted":false},{"id":"tinker-s-tools","label":"Tinker''s Tools","kind":"tool","category":"Artisan''s Tools","enabled":true,"restricted":false},{"id":"weaver-s-tools","label":"Weaver''s Tools","kind":"tool","category":"Artisan''s Tools","enabled":true,"restricted":false},{"id":"woodcarver-s-tools","label":"Woodcarver''s Tools","kind":"tool","category":"Artisan''s Tools","enabled":true,"restricted":false},{"id":"disguise-kit","label":"Disguise Kit","kind":"tool","category":"Specialist Kits","enabled":true,"restricted":false},{"id":"forgery-kit","label":"Forgery Kit","kind":"tool","category":"Specialist Kits","enabled":true,"restricted":false},{"id":"herbalism-kit","label":"Herbalism Kit","kind":"tool","category":"Specialist Kits","enabled":true,"restricted":false},{"id":"poisoner-s-kit","label":"Poisoner''s Kit","kind":"tool","category":"Specialist Kits","enabled":true,"restricted":false},{"id":"thieves-tools","label":"Thieves'' Tools","kind":"tool","category":"Specialist Kits","enabled":true,"restricted":false},{"id":"dice-set","label":"Dice Set","kind":"tool","category":"Gaming Sets","enabled":true,"restricted":false},{"id":"dragonchess-set","label":"Dragonchess Set","kind":"tool","category":"Gaming Sets","enabled":true,"restricted":false},{"id":"playing-card-set","label":"Playing Card Set","kind":"tool","category":"Gaming Sets","enabled":true,"restricted":false},{"id":"three-dragon-ante-set","label":"Three-Dragon Ante Set","kind":"tool","category":"Gaming Sets","enabled":true,"restricted":false},{"id":"terr-game-black-ledger","label":"Black Ledger","kind":"tool","category":"Gaming Sets","enabled":true,"restricted":false},{"id":"terr-game-redwater","label":"Redwater","kind":"tool","category":"Gaming Sets","enabled":true,"restricted":false},{"id":"terr-game-fifth-hand","label":"The Fifth Hand","kind":"tool","category":"Gaming Sets","enabled":true,"restricted":false},{"id":"terr-game-iron-debt","label":"Iron Debt","kind":"tool","category":"Gaming Sets","enabled":true,"restricted":false},{"id":"terr-game-ash-and-bone","label":"Ash & Bone","kind":"tool","category":"Gaming Sets","enabled":true,"restricted":false},{"id":"bagpipes","label":"Bagpipes","kind":"tool","category":"Musical Instruments","enabled":true,"restricted":false},{"id":"drum","label":"Drum","kind":"tool","category":"Musical Instruments","enabled":true,"restricted":false},{"id":"dulcimer","label":"Dulcimer","kind":"tool","category":"Musical Instruments","enabled":true,"restricted":false},{"id":"flute","label":"Flute","kind":"tool","category":"Musical Instruments","enabled":true,"restricted":false},{"id":"horn","label":"Horn","kind":"tool","category":"Musical Instruments","enabled":true,"restricted":false},{"id":"lute","label":"Lute","kind":"tool","category":"Musical Instruments","enabled":true,"restricted":false},{"id":"lyre","label":"Lyre","kind":"tool","category":"Musical Instruments","enabled":true,"restricted":false},{"id":"pan-flute","label":"Pan Flute","kind":"tool","category":"Musical Instruments","enabled":true,"restricted":false},{"id":"shawm","label":"Shawm","kind":"tool","category":"Musical Instruments","enabled":true,"restricted":false},{"id":"viol","label":"Viol","kind":"tool","category":"Musical Instruments","enabled":true,"restricted":false},{"id":"terr-music-stonechimes","label":"Stonechimes","kind":"tool","category":"Musical Instruments","enabled":true,"restricted":false},{"id":"terr-music-tide-drum","label":"Tide Drum","kind":"tool","category":"Musical Instruments","enabled":true,"restricted":false},{"id":"terr-music-ashwood-zither","label":"Ashwood Zither","kind":"tool","category":"Musical Instruments","enabled":true,"restricted":false},{"id":"terr-music-skyreed-concertina","label":"Skyreed Concertina","kind":"tool","category":"Musical Instruments","enabled":true,"restricted":false},{"id":"terr-music-stringwheel","label":"Stringwheel","kind":"tool","category":"Musical Instruments","enabled":true,"restricted":false},{"id":"terr-music-resonance-bowls","label":"Resonance Bowls","kind":"tool","category":"Musical Instruments","enabled":true,"restricted":false},{"id":"terr-music-whisperbow","label":"Whisperbow","kind":"tool","category":"Musical Instruments","enabled":true,"restricted":false},{"id":"terr-music-glasswheel","label":"Glasswheel","kind":"tool","category":"Musical Instruments","enabled":true,"restricted":false},{"id":"navigator-s-tools","label":"Navigator''s Tools","kind":"tool","category":"Navigation","enabled":true,"restricted":false},{"id":"vehicles-land","label":"Vehicles (Land)","kind":"tool","category":"Vehicles (2014 compatibility)","enabled":true,"restricted":false},{"id":"vehicles-water","label":"Vehicles (Water)","kind":"tool","category":"Vehicles (2014 compatibility)","enabled":true,"restricted":false},{"id":"magitech-engineer-s-tools","label":"Magitech Engineer''s Tools","kind":"tool","category":"Artisan & Engineering Tools","enabled":true,"restricted":true},{"id":"runecarver-s-tools","label":"Runecarver''s Tools","kind":"tool","category":"Artisan & Engineering Tools","enabled":true,"restricted":true},{"id":"nullcraft-engineer-s-tools","label":"Nullcraft Engineer''s Tools","kind":"tool","category":"Artisan & Engineering Tools","enabled":true,"restricted":true},{"id":"archive-conservator-s-tools","label":"Archive Conservator''s Tools","kind":"tool","category":"Artisan & Engineering Tools","enabled":true,"restricted":true},{"id":"pressurewright-s-tools","label":"Pressurewright''s Tools","kind":"tool","category":"Artisan & Engineering Tools","enabled":true,"restricted":true},{"id":"aetheric-calibration-instruments","label":"Aetheric Calibration Instruments","kind":"tool","category":"Aetheric & Magical Instruments","enabled":true,"restricted":true},{"id":"wardwright-s-instruments","label":"Wardwright''s Instruments","kind":"tool","category":"Aetheric & Magical Instruments","enabled":true,"restricted":true},{"id":"resonance-tuning-instruments","label":"Resonance Tuning Instruments","kind":"tool","category":"Aetheric & Magical Instruments","enabled":true,"restricted":true},{"id":"corewright-s-instruments","label":"Corewright''s Instruments","kind":"tool","category":"Aetheric & Magical Instruments","enabled":true,"restricted":true},{"id":"aetherfauna-harvester-s-kit","label":"Aetherfauna Harvester''s Kit","kind":"tool","category":"Biological & Field Kits","enabled":true,"restricted":true},{"id":"hematurgical-instruments","label":"Hematurgical Instruments","kind":"tool","category":"Biological & Field Kits","enabled":true,"restricted":true},{"id":"healer-s-kit","label":"Healer''s Kit","kind":"tool","category":"Biological & Field Kits","enabled":true,"restricted":false},{"id":"common","label":"Common","kind":"language","category":"spoken-written","enabled":true,"restricted":false},{"id":"elven","label":"Elven","kind":"language","category":"spoken-written","enabled":true,"restricted":false},{"id":"dvergr","label":"Dvergr","kind":"language","category":"spoken-written","enabled":true,"restricted":false},{"id":"oni","label":"Oni","kind":"language","category":"spoken-written","enabled":true,"restricted":false},{"id":"fl-gel","label":"Flügel","kind":"language","category":"spoken-written","enabled":true,"restricted":false},{"id":"daemonic","label":"Daemonic","kind":"language","category":"spoken-written","enabled":true,"restricted":false},{"id":"fey","label":"Fey","kind":"language","category":"spoken-written","enabled":true,"restricted":true},{"id":"draconic","label":"Draconic","kind":"language","category":"spoken-written","enabled":true,"restricted":true},{"id":"celestial","label":"Celestial","kind":"language","category":"spoken-written","enabled":true,"restricted":true},{"id":"primordial","label":"Primordial","kind":"language","category":"spoken-written","enabled":true,"restricted":true},{"id":"deep-speech","label":"Deep Speech","kind":"language","category":"spoken-written","enabled":true,"restricted":true},{"id":"druidic","label":"Druidic","kind":"language","category":"cant","enabled":true,"restricted":true},{"id":"thieves-cant","label":"Thieves'' Cant","kind":"language","category":"cant","enabled":true,"restricted":true},{"id":"hunter-field-cant","label":"Hunter Field Cant","kind":"language","category":"cant-and-signage","enabled":true,"restricted":true},{"id":"ancient-elven","label":"Ancient Elven","kind":"language","category":"spoken-written","enabled":true,"restricted":true},{"id":"dvergr-runic","label":"Dvergr Runic","kind":"language","category":"written-script","enabled":true,"restricted":true},{"id":"aurethian","label":"Aurethian","kind":"language","category":"spoken-written","enabled":true,"restricted":true},{"id":"infernal","label":"Infernal","kind":"language","category":"spoken-written","enabled":false,"restricted":true}]'::jsonb)
 as c(id text,kind text,label text,category text,enabled boolean,restricted boolean)
on conflict(id) do update set kind=excluded.kind,label=excluded.label,
 category=excluded.category,enabled=excluded.enabled,restricted=excluded.restricted;

create table if not exists public.terravale_class_proficiency_rules(
 class_key text primary key,rule jsonb not null default '{}'::jsonb,
 reviewed_version text not null default 'v4'
);
alter table public.terravale_class_proficiency_rules enable row level security;
revoke all on public.terravale_class_proficiency_rules from public,anon,authenticated;
grant select on public.terravale_class_proficiency_rules to authenticated;
drop policy if exists tv_class_proficiency_read on public.terravale_class_proficiency_rules;
create policy tv_class_proficiency_read on public.terravale_class_proficiency_rules
 for select to authenticated using(true);
insert into public.terravale_class_proficiency_rules(class_key,rule)
select class_key,rule from jsonb_to_recordset('[{"class_key":"Artificer","rule":{"fixed":["thieves-tools","tinker-s-tools"],"slots":[{"label":"Artisan''s tool","count":1,"pool":"artisan"}]}},{"class_key":"Barbarian","rule":{}},{"class_key":"Bard","rule":{"slots":[{"label":"Musical instruments","count":3,"pool":"instrument"}]}},{"class_key":"Cleric","rule":{}},{"class_key":"Druid","rule":{"fixed":["herbalism-kit"],"languages":["druidic"]}},{"class_key":"Fighter","rule":{}},{"class_key":"Monk","rule":{"slots":[{"label":"One artisan tool or musical instrument","count":1,"pool":"artisan-instrument"}]}},{"class_key":"Paladin","rule":{}},{"class_key":"Ranger","rule":{}},{"class_key":"Rogue","rule":{"fixed":["thieves-tools"],"languages":["thieves-cant"]}},{"class_key":"Sorcerer","rule":{}},{"class_key":"Warlock","rule":{}},{"class_key":"Wizard","rule":{}},{"class_key":"Ashheir","rule":{"slots":[{"label":"Starting tool","count":1,"pool":["calligrapher-s-supplies","mason-s-tools"]}]}},{"class_key":"Bloodforger","rule":{"review":"Not source-verified; no automatic tool grant."}},{"class_key":"Chaos Arsenal","rule":{}},{"class_key":"Crimson Conduit","rule":{"fixed":["healer-s-kit"],"slots":[{"label":"Starting field tool","count":1,"pool":["alchemist-s-supplies","herbalism-kit","calligrapher-s-supplies"]}]}},{"class_key":"Dream-Eater","rule":{"slots":[{"label":"Starting tool","count":1,"pool":["calligrapher-s-supplies","disguise-kit","forgery-kit","painter-s-supplies","instrument"]}]}},{"class_key":"Echo-Bearer","rule":{"slots":[{"label":"Artisan tool or musical instrument","count":1,"pool":"artisan-instrument"}]}},{"class_key":"Gatewarden","rule":{"slots":[{"label":"Artisan tools","count":2,"pool":"artisan"}]}},{"class_key":"Lineage Adept","rule":{"slots":[{"label":"Starting tool or vehicles","count":1,"pool":["cartographer-s-tools","herbalism-kit","navigator-s-tools","artisan","vehicles-land"]}]}},{"class_key":"Nullwatcher","rule":{"slots":[{"label":"Starting field tool","count":1,"pool":["healer-s-kit","navigator-s-tools","thieves-tools","artisan"]}]}},{"class_key":"Oracle of the Two Waters","rule":{"slots":[{"label":"Starting tool","count":1,"pool":["instrument","calligrapher-s-supplies","navigator-s-tools","healer-s-kit"]}]}},{"class_key":"Pressurebearer","rule":{"slots":[{"label":"Starting tool","count":1,"pool":["artisan","healer-s-kit","vehicles-land"]}]}},{"class_key":"Ripperbound","rule":{"slots":[{"label":"Starting tool","count":1,"pool":["healer-s-kit","leatherworker-s-tools","thieves-tools","game"]}]}},{"class_key":"Scarlet Masque","rule":{"fixed":["disguise-kit"],"slots":[{"label":"Starting tool","count":1,"pool":["forgery-kit","calligrapher-s-supplies","jeweler-s-tools","instrument"]}]}},{"class_key":"Seal-Maintainer","rule":{"fixed":["calligrapher-s-supplies"]}},{"class_key":"Shadowforger","rule":{"fixed":["smith-s-tools"],"slots":[{"label":"Another artisan tool","count":1,"pool":"artisan"}]}},{"class_key":"Shaman","rule":{"review":"No explicit starting proficiency confirmed."}},{"class_key":"Summoner","rule":{"review":"No explicit starting proficiency confirmed."}},{"class_key":"Ventweaver","rule":{"slots":[{"label":"Starting tool","count":1,"pool":["navigator-s-tools","cartographer-s-tools","instrument","healer-s-kit"]}]}},{"class_key":"Vhaeros Cantor","rule":{"slots":[{"label":"Starting tool","count":1,"pool":["instrument","calligrapher-s-supplies","cartographer-s-tools"]}]}},{"class_key":"Vitaeforge","rule":{"slots":[{"label":"Starting tool","count":1,"pool":["alchemist-s-supplies","leatherworker-s-tools","smith-s-tools","healer-s-kit"]}]}}]'::jsonb)
 as c(class_key text,rule jsonb)
on conflict(class_key) do update set rule=excluded.rule,reviewed_version='v4';

create table if not exists public.terravale_character_proficiencies(
 character_id uuid primary key references public.characters(id) on delete cascade,
 tools jsonb not null default '[]'::jsonb,
 languages jsonb not null default '[]'::jsonb,
 pending_languages jsonb not null default '[]'::jsonb,
 dm_bonus jsonb not null default '[]'::jsonb,
 submitted boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.terravale_character_proficiencies enable row level security;
revoke all on public.terravale_character_proficiencies from public,anon,authenticated;
grant select on public.terravale_character_proficiencies to authenticated;
drop policy if exists tv_char_proficiency_read on public.terravale_character_proficiencies;
create policy tv_char_proficiency_read on public.terravale_character_proficiencies
 for select to authenticated using(exists(
  select 1 from public.characters c where c.id=character_id and
  (c.owner_id=(select auth.uid()) or authz.is_dm(c.campaign_id)
   or (c.status='approved' and c.sheet_visible_to_party and authz.is_member(c.campaign_id)))
 ));
insert into public.terravale_character_proficiencies(character_id)
 select id from public.characters on conflict do nothing;

create table if not exists public.terravale_proficiency_bonus_choices(
 id uuid primary key default gen_random_uuid(),
 character_id uuid not null references public.characters(id) on delete cascade,
 recipient_user_id uuid not null references auth.users(id) on delete cascade,
 created_by uuid not null references auth.users(id),
 kind text not null check(kind in('tool','language')),
 choice_pool text not null default 'any',
 choice_count integer not null check(choice_count between 1 and 5),
 selected_ids jsonb not null default '[]'::jsonb,
 status text not null default 'pending' check(status in('pending','completed','cancelled')),
 note text not null default '',
 created_at timestamptz not null default now(),
 completed_at timestamptz
);
create index if not exists tv_bonus_pending_by_recipient
 on public.terravale_proficiency_bonus_choices(recipient_user_id,status,created_at);
alter table public.terravale_proficiency_bonus_choices enable row level security;
revoke all on public.terravale_proficiency_bonus_choices from public,anon,authenticated;
grant select on public.terravale_proficiency_bonus_choices to authenticated;
drop policy if exists tv_bonus_select on public.terravale_proficiency_bonus_choices;
create policy tv_bonus_select on public.terravale_proficiency_bonus_choices
 for select to authenticated using(recipient_user_id=(select auth.uid())
  or exists(select 1 from public.characters c where c.id=character_id and authz.is_dm(c.campaign_id)));

-- No specialist magic item is automatically substituted for an artisan choice.
create or replace function public.terravale_tool_eligible(item text,pool jsonb)
returns boolean language sql stable security invoker set search_path=''
as $pool$
select exists(
 select 1 from public.terravale_proficiency_catalog t
 where t.id=item and t.kind='tool' and t.enabled and
 ((
   jsonb_typeof(pool)='string' and (
    (pool#>>'{}'='artisan' and t.category='Artisan''s Tools') or
    (pool#>>'{}'='instrument' and t.category='Musical Instruments') or
    (pool#>>'{}'='game' and t.category='Gaming Sets') or
    (pool#>>'{}'='artisan-instrument' and t.category in('Artisan''s Tools','Musical Instruments'))
   )
 ) or (
   jsonb_typeof(pool)='array' and
   (pool ? item or
     (pool ? 'artisan' and t.category='Artisan''s Tools') or
     (pool ? 'instrument' and t.category='Musical Instruments') or
     (pool ? 'game' and t.category='Gaming Sets'))
  ))
);
$pool$;

create or replace function public.terravale_save_starting_proficiencies(
 target_character uuid,chosen_tools text[] default '{}',chosen_languages text[] default '{}'
) returns jsonb language plpgsql security definer set search_path=''
as $save$
declare caller uuid:=(select auth.uid()); ch public.characters%rowtype;
 rules jsonb;slot jsonb;an text;
 needed integer:=0;lang_needed integer:=0;v text;fixed jsonb;
 result_tools jsonb:='[]'::jsonb;
 result_langs jsonb:='[]'::jsonb;pending jsonb:='[]'::jsonb;
 submitted_before boolean;
begin
 if caller is null or not exists(select 1 from auth.identities
  where user_id=caller and provider='discord')
 then raise exception 'Verified Discord required' using errcode='28000';end if;
 select * into ch from public.characters where id=target_character for update;
 if ch.id is null or not authz.is_member(ch.campaign_id) then
   raise exception 'Character is not in your campaign' using errcode='42501';end if;
 if ch.owner_id<>caller and not authz.is_dm(ch.campaign_id) then
  raise exception 'Only the owner or campaign DM can submit choices' using errcode='42501';end if;
 insert into public.terravale_character_proficiencies(character_id) values(ch.id)
 on conflict do nothing;
 select submitted into submitted_before from public.terravale_character_proficiencies
 where character_id=ch.id for update;
 if submitted_before and ch.status='approved' and not authz.is_dm(ch.campaign_id) then
  raise exception 'Starting proficiencies are locked after approval; ask the DM for bonus choices'
  using errcode='42501';end if;
 select coalesce(r.rule,'{}'::jsonb) into rules from public.terravale_class_proficiency_rules r
 where lower(r.class_key)=lower(ch.approved_build->>'class');
 rules:=coalesce(rules,'{}'::jsonb);
 for slot in select value from jsonb_array_elements(coalesce(rules->'slots','[]'::jsonb)) loop
  needed:=needed+coalesce((slot->>'count')::int,0);
 end loop;
 if coalesce(array_length(chosen_tools,1),0)<>needed then
  raise exception 'This class requires % starting tool choices',needed using errcode='22023';end if;
 if (select count(distinct x) from unnest(chosen_tools) x)<>needed then
  raise exception 'Starting tools must be different' using errcode='22023';end if;
 fixed:=coalesce(rules->'fixed','[]'::jsonb);
 for v in select jsonb_array_elements_text(fixed) loop
  result_tools:=result_tools||jsonb_build_array(jsonb_build_object('id',v,'source','class'));
 end loop;
 foreach v in array chosen_tools loop
  if fixed ? v then raise exception 'Already granted that tool by class' using errcode='22023';end if;
  if not exists(select 1 from jsonb_array_elements(coalesce(rules->'slots','[]'::jsonb)) sl
    where public.terravale_tool_eligible(v,sl->'pool')) then
    raise exception 'Invalid tool proficiency for class: %',v using errcode='22023';end if;
  result_tools:=result_tools||jsonb_build_array(jsonb_build_object('id',v,'source','class choice'));
 end loop;
 an:=lower(coalesce(ch.approved_build->>'ancestry',''));
 lang_needed:=case when an in('flügel','flugel') then 2 else 0 end;
 if coalesce(array_length(chosen_languages,1),0)<>lang_needed then
  raise exception 'This ancestry requires % language choices',lang_needed using errcode='22023';end if;
 if (select count(distinct x) from unnest(chosen_languages) x)<>lang_needed then
  raise exception 'Choose different languages' using errcode='22023';end if;
 result_langs:='[{"id":"common","source":"ancestry","modes":["speak","read","write"]}]'::jsonb;
 if an='daemon' then
  result_langs:=result_langs||'[{"id":"daemonic","source":"ancestry","modes":["speak","read","write"]}]'::jsonb;
 elsif an in('flügel','flugel') then
  result_langs:=result_langs||'[{"id":"fl-gel","source":"ancestry","modes":["speak","read","write"]}]'::jsonb;
 end if;
 for v in select jsonb_array_elements_text(coalesce(rules->'languages','[]'::jsonb)) loop
  result_langs:=result_langs||jsonb_build_array(jsonb_build_object('id',v,'source','class'));
 end loop;
 foreach v in array chosen_languages loop
  if v in('common','fl-gel','daemonic') then
   raise exception 'Choose new, non-duplicate languages' using errcode='22023';end if;
  if not exists(select 1 from public.terravale_proficiency_catalog
   where id=v and kind='language' and enabled) then
   raise exception 'Unknown or inactive language: %',v using errcode='22023';end if;
  if exists(select 1 from public.terravale_proficiency_catalog
   where id=v and kind='language' and restricted) then
   pending:=pending||jsonb_build_array(jsonb_build_object('id',v,'source','ancestry choice','status','DM approval required'));
  else
   result_langs:=result_langs||jsonb_build_array(jsonb_build_object('id',v,'source','ancestry choice'));
  end if;
 end loop;
 update public.terravale_character_proficiencies set
  tools=result_tools,languages=result_langs,pending_languages=pending,
  submitted=true,updated_at=now() where character_id=ch.id;
 return jsonb_build_object('saved',true,'tools',result_tools,'languages',result_langs,
  'pending_languages',pending);
end;
$save$;
revoke all on function public.terravale_save_starting_proficiencies(uuid,text[],text[]) from public,anon;
grant execute on function public.terravale_save_starting_proficiencies(uuid,text[],text[]) to authenticated;

create or replace function public.terravale_dm_grant_proficiency_choice(
 target_character uuid,proficiency_kind text,choice_pool text default 'any',
 number_of_choices integer default 1,purpose text default ''
) returns jsonb language plpgsql security definer set search_path=''
as $grant$
declare caller uuid:=(select auth.uid());ch public.characters%rowtype;id uuid;
begin
 if caller is null or not exists(select 1 from auth.identities where user_id=caller and provider='discord')
 then raise exception 'Verified Discord required' using errcode='28000';end if;
 select * into ch from public.characters where id=target_character;
 if ch.id is null or not authz.is_dm(ch.campaign_id) or ch.owner_id is null then
  raise exception 'Only campaign DM can grant a real player additional choices' using errcode='42501';end if;
 if proficiency_kind not in('tool','language') or choice_pool not in('any','artisan','instrument','game','artisan-instrument')
  or number_of_choices not between 1 and 5 then
  raise exception 'Invalid bonus choice specification' using errcode='22023';end if;
 if proficiency_kind='language' and choice_pool<>'any' then
  raise exception 'Language choices use the language list' using errcode='22023';end if;
 if (select count(*) from public.terravale_proficiency_bonus_choices
   where character_id=ch.id and status='pending')>=12 then
  raise exception 'Resolve outstanding choices before granting more' using errcode='22023';end if;
 insert into public.terravale_proficiency_bonus_choices(character_id,recipient_user_id,
  created_by,kind,choice_pool,choice_count,note)
 values(ch.id,ch.owner_id,caller,proficiency_kind,choice_pool,number_of_choices,left(purpose,240))
 returning id into id;
 return jsonb_build_object('created',true,'id',id);
end;
$grant$;
revoke all on function public.terravale_dm_grant_proficiency_choice(uuid,text,text,integer,text)
 from public,anon;
grant execute on function public.terravale_dm_grant_proficiency_choice(uuid,text,text,integer,text)
 to authenticated;

create or replace function public.terravale_claim_proficiency_choice(
 request_id uuid,chosen_ids text[]
) returns jsonb language plpgsql security definer set search_path=''
as $claim$
declare caller uuid:=(select auth.uid());req public.terravale_proficiency_bonus_choices%rowtype;
 v text; catalog public.terravale_proficiency_catalog%rowtype;entry jsonb;array_new jsonb:='[]'::jsonb;existing jsonb;
begin
 if caller is null or not exists(select 1 from auth.identities
  where user_id=caller and provider='discord')
 then raise exception 'Verified Discord required' using errcode='28000';end if;
 select * into req from public.terravale_proficiency_bonus_choices where id=request_id for update;
 if req.id is null or req.recipient_user_id<>caller or req.status<>'pending' then
  raise exception 'This bonus choice is not available to your account' using errcode='42501';end if;
 if coalesce(array_length(chosen_ids,1),0)<>req.choice_count or
  (select count(distinct x) from unnest(chosen_ids) x)<>req.choice_count then
  raise exception 'Choose exactly % different proficiencies',req.choice_count using errcode='22023';end if;
 insert into public.terravale_character_proficiencies(character_id)
 values(req.character_id) on conflict do nothing;
 select case when req.kind='tool' then tools else languages end into existing
 from public.terravale_character_proficiencies
 where character_id=req.character_id for update;
 foreach v in array chosen_ids loop
  select * into catalog from public.terravale_proficiency_catalog where id=v and enabled;
  if catalog.id is null or catalog.kind<>req.kind then
   raise exception 'Unknown or inactive proficiency: %',v using errcode='22023';end if;
  if req.kind='tool' and req.choice_pool<>'any' and not
   public.terravale_tool_eligible(v,to_jsonb(req.choice_pool)) then
    raise exception 'Tool is outside the granted choice category' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(coalesce(existing,'[]'::jsonb)) x
    where x->>'id'=v) then
   raise exception 'Character already knows this proficiency' using errcode='22023';end if;
  if catalog.restricted and req.kind='language' then
   raise exception 'Restricted language must be explicitly approved by the DM' using errcode='42501';end if;
  entry:=jsonb_build_object('id',v,'source','DM bonus','request_id',req.id);
  array_new:=array_new||jsonb_build_array(entry);
 end loop;
 if req.kind='tool' then
  update public.terravale_character_proficiencies set
   dm_bonus=dm_bonus||array_new,updated_at=now() where character_id=req.character_id;
 else
  update public.terravale_character_proficiencies set
   dm_bonus=dm_bonus||array_new,updated_at=now() where character_id=req.character_id;
 end if;
 update public.terravale_proficiency_bonus_choices set selected_ids=to_jsonb(chosen_ids),
  status='completed',completed_at=now() where id=req.id;
 return jsonb_build_object('complete',true,'proficiencies',array_new,'character_id',req.character_id);
end;
$claim$;
revoke all on function public.terravale_claim_proficiency_choice(uuid,text[])
 from public,anon;
grant execute on function public.terravale_claim_proficiency_choice(uuid,text[])
 to authenticated;

create or replace function public.terravale_dm_approve_language(
 target_character uuid, language_id text
) returns jsonb language plpgsql security definer set search_path=''
as $approve$
declare caller uuid:=(select auth.uid());ch public.characters%rowtype;rec public.terravale_character_proficiencies%rowtype;
begin
 if caller is null or not exists(select 1 from auth.identities
  where user_id=caller and provider='discord') then raise exception 'Verified Discord required' using errcode='28000';end if;
 select * into ch from public.characters where id=target_character;
 if ch.id is null or not authz.is_dm(ch.campaign_id) then
  raise exception 'Only DM can approve restricted languages' using errcode='42501';end if;
 select * into rec from public.terravale_character_proficiencies
 where character_id=ch.id for update;
 if not exists(select 1 from jsonb_array_elements(rec.pending_languages) x
  where x->>'id'=language_id) then raise exception 'Language is not pending' using errcode='22023';end if;
 update public.terravale_character_proficiencies set
  languages=languages||jsonb_build_array(jsonb_build_object('id',language_id,'source','DM-approved ancestry choice')),
  pending_languages=(select coalesce(jsonb_agg(x),'[]'::jsonb)
   from jsonb_array_elements(rec.pending_languages)x where x->>'id'<>language_id),
  updated_at=now()
 where character_id=ch.id;
 return jsonb_build_object('approved',true,'language_id',language_id,'character_id',ch.id);
end;
$approve$;
revoke all on function public.terravale_dm_approve_language(uuid,text) from public,anon;
grant execute on function public.terravale_dm_approve_language(uuid,text) to authenticated;
