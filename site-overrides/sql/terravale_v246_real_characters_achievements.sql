-- V2.46 real character sheets, automatic demo approval, verified achievements.
-- No existing character rows are deleted or migrated indiscriminately.
create or replace function public.terravale_demo_character_limits()
returns trigger language plpgsql security definer set search_path=''
as $$
declare stage_number integer;
begin
 if not exists(select 1 from public.terravale_system_campaigns where campaign_id=new.campaign_id)
 then return new; end if;
 stage_number:=case when coalesce(new.approved_build #>> '{details,crimsonStage}','1') ~ '^[0-9]+$'
   then (new.approved_build #>> '{details,crimsonStage}')::int else 1 end;
 if new.owner_id is null or new.status not in ('draft','approved')
    or coalesce(new.approved_build->>'level','1')<>'1' or stage_number<>1 then
   raise exception 'Demo allows only player-owned level-one Stage 1 characters' using errcode='42501';
 end if;
 if TG_OP='INSERT' and exists(select 1 from public.characters
     where campaign_id=new.campaign_id and owner_id=new.owner_id) then
   raise exception 'Demo allows one test character per player' using errcode='23514';
 end if;
 return new;
end $$;

create or replace function public.terravale_create_character(
 target_campaign uuid, sheet jsonb
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 caller uuid:=(select auth.uid()); cid uuid; demo boolean;
 n text; ancestry text; class_name text; stage integer;
 body jsonb; char_record public.characters%rowtype;
begin
 if caller is null or not exists(select 1 from auth.identities
   where user_id=caller and provider='discord') then
   raise exception 'Verified Discord account required' using errcode='28000'; end if;
 if not authz.is_member(target_campaign) then
   raise exception 'Join a campaign before creating a character' using errcode='42501'; end if;
 if sheet is null or jsonb_typeof(sheet)<>'object' or pg_column_size(sheet)>750000 then
   raise exception 'Invalid character sheet' using errcode='22023'; end if;
 n:=btrim(coalesce(sheet->>'name',''));
 ancestry:=btrim(coalesce(sheet->>'ancestry',''));
 class_name:=btrim(coalesce(sheet->>'className',''));
 if length(n)<1 or length(n)>100 or length(ancestry)<2 or length(ancestry)>80
    or length(class_name)<2 or length(class_name)>80 then
   raise exception 'Character needs a valid name, ancestry and class' using errcode='22023'; end if;
 if coalesce(sheet->>'level','1')<>'1' then
   raise exception 'New player characters begin at level one' using errcode='22023'; end if;
 stage:=case when coalesce(sheet->>'crimsonStage','1') ~ '^[0-9]+$'
   then (sheet->>'crimsonStage')::int else 1 end;
 if lower(ancestry)='crimsonborn' and stage<>1 then
   raise exception 'Starting Crimsonborn stage requires DM advancement' using errcode='42501'; end if;
 select exists(select 1 from public.terravale_system_campaigns
   where campaign_id=target_campaign) into demo;
 perform pg_advisory_xact_lock(hashtextextended(target_campaign::text||':'||caller::text,0));
 if demo and exists(select 1 from public.characters where campaign_id=target_campaign and owner_id=caller)
 then raise exception 'Demo allows one test character per player' using errcode='23514'; end if;
 body:=(sheet - 'status' - 'ownerId' - 'isDm' - 'approvedBuild')
   || jsonb_build_object('level',1,'campaign',target_campaign,'owner','You');
 insert into public.characters(campaign_id,owner_id,name,status,approved_build,sheet_visible_to_party)
 values(target_campaign,caller,n,case when demo then 'approved' else 'draft' end,
   jsonb_build_object('level',1,'ancestry',ancestry,'class',class_name,
     'details',jsonb_build_object('crimsonStage',stage),
     'summary',left(coalesce(sheet->>'backstory',''),12000),'character',body),true)
 returning * into char_record;
 cid:=char_record.id;
 update public.character_state set
   hp=least(9999,greatest(0,coalesce(nullif(sheet->>'hp','')::int,10))),
   blood_state=least(40,greatest(-40,coalesce(nullif(sheet->>'bloodState','')::int,0))),
   inventory=case when jsonb_typeof(sheet->'inventory')='array' then sheet->'inventory' else '[]'::jsonb end,
   updated_at=now()
 where character_id=cid;
 if demo then
   perform public.codex_capture_achievement_event(caller,'character_created',cid::text);
   perform public.codex_capture_achievement_event(caller,'character_approved',cid::text);
 end if;
 return jsonb_build_object('id',cid,'status',char_record.status,'is_demo',demo);
end $$;
revoke all on function public.terravale_create_character(uuid,jsonb) from public,anon;
grant execute on function public.terravale_create_character(uuid,jsonb) to authenticated;

-- Saves only the authenticated owner's existing character, never a stranger's
-- or a character in a campaign they have left. Level/stage remain DM controlled.
create or replace function public.terravale_save_character_sheet(
 target_character uuid, sheet jsonb
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare caller uuid:=(select auth.uid()); row_data public.characters; old_build jsonb;
begin
 if caller is null then raise exception 'Sign-in required' using errcode='28000'; end if;
 select * into row_data from public.characters
 where id=target_character and owner_id=caller for update;
 if not found or not authz.is_member(row_data.campaign_id) then
   raise exception 'This character is not owned by your current campaign account' using errcode='42501';end if;
 if jsonb_typeof(sheet)<>'object' or pg_column_size(sheet)>750000 then
   raise exception 'Invalid character update' using errcode='22023'; end if;
 old_build:=row_data.approved_build;
 if coalesce(sheet->>'level',old_build->>'level')<>old_build->>'level'
   or coalesce(sheet->>'ancestry',old_build->>'ancestry')<>old_build->>'ancestry'
   or coalesce(sheet->>'className',old_build->>'class')<>old_build->>'class' then
    raise exception 'Level, class and ancestry changes require DM approval' using errcode='42501';end if;
 update public.characters set
   approved_build=jsonb_set(jsonb_set(old_build,'{character}',
     (sheet-'status'-'ownerId'-'approvedBuild')||jsonb_build_object('id',target_character,'campaign',row_data.campaign_id),
     true),'{summary}',to_jsonb(left(coalesce(sheet->>'backstory',''),12000)),true)
 where id=target_character;
 update public.character_state set
   hp=least(9999,greatest(0,coalesce(nullif(sheet->>'hp','')::int,hp))),
   inventory=case when jsonb_typeof(sheet->'inventory')='array'
       then sheet->'inventory' else inventory end,
   blood_state=least(40,greatest(-40,coalesce(nullif(sheet->>'bloodState','')::int,blood_state))),
   updated_at=now()
 where character_id=target_character;
 return jsonb_build_object('saved',true,'id',target_character);
end $$;
revoke all on function public.terravale_save_character_sheet(uuid,jsonb) from public,anon;
grant execute on function public.terravale_save_character_sheet(uuid,jsonb) to authenticated;

-- Actual Blood State critical extremes only, not a visual simulation.
create or replace function public.terravale_critical_hunger_award()
returns trigger language plpgsql security definer set search_path=''
as $$
declare c public.characters;
begin
 if (new.blood_state not in (-40,40)) or (tg_op='UPDATE' and old.blood_state in (-40,40))
 then return new; end if;
 select * into c from public.characters where id=new.character_id;
 if found and c.owner_id is not null
   and lower(coalesce(c.approved_build->>'ancestry',''))='crimsonborn'
   and authz.is_member(c.campaign_id) then
   insert into public.codex_achievement_unlocks(user_id,achievement_key)
   values(c.owner_id,'seeing_red') on conflict do nothing;
 end if;
 return new;
end $$;
drop trigger if exists terravale_critical_hunger_award on public.character_state;
create trigger terravale_critical_hunger_award after insert or update of blood_state
on public.character_state for each row execute function public.terravale_critical_hunger_award();

create or replace function public.terravale_unlock_verdant_growth()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare caller uuid:=(select auth.uid()); fresh boolean:=false;
begin
 if caller is null or not exists(select 1 from auth.identities
     where user_id=caller and provider='discord') then
   raise exception 'Discord sign-in required' using errcode='28000'; end if;
 insert into public.codex_achievement_unlocks(user_id,achievement_key)
 values(caller,'roots_in_margins') on conflict do nothing;
 get diagnostics fresh=row_count;
 return jsonb_build_object('unlocked',true,'new',fresh);
end $$;
revoke all on function public.terravale_unlock_verdant_growth() from public,anon;
grant execute on function public.terravale_unlock_verdant_growth() to authenticated;
