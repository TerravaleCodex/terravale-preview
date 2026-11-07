create or replace function public.terravale_save_starting_proficiencies(
 target_character uuid,chosen_tools text[] default '{}',chosen_languages text[] default '{}'
) returns jsonb language plpgsql security definer set search_path=''
as $save$
declare caller uuid:=(select auth.uid()); ch public.characters%rowtype;
 rules jsonb;slot jsonb;an text;
 needed integer:=0;lang_needed integer:=0;v text;fixed jsonb;
 slot_cursor integer:=1;slot_pick integer;slot_count integer;
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
 -- Validate each chosen item against its specific class training slot,
 -- rather than letting one broad artisan slot satisfy every distinct slot.
 for slot in select value from jsonb_array_elements(coalesce(rules->'slots','[]'::jsonb)) loop
   slot_count:=coalesce((slot->>'count')::integer,0);
   for slot_pick in 1..slot_count loop
     v:=chosen_tools[slot_cursor];
     if v is null or not public.terravale_tool_eligible(v,slot->'pool') then
       raise exception 'Training choice % is outside class slot %',coalesce(v,'(none)'),slot_cursor using errcode='22023';
     end if;
     slot_cursor:=slot_cursor+1;
   end loop;
 end loop;
 fixed:=coalesce(rules->'fixed','[]'::jsonb);
 for v in select jsonb_array_elements_text(fixed) loop
  result_tools:=result_tools||jsonb_build_array(jsonb_build_object('id',v,'source','class'));
 end loop;
 foreach v in array chosen_tools loop
  if fixed ? v then raise exception 'Already granted that tool by class' using errcode='22023';end if;
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
  if coalesce(rules->'languages','[]'::jsonb) ? v then
   raise exception 'Language already granted by class' using errcode='22023';end if;
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