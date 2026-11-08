-- V2.62 SECURITY PATCH: make every owner check Boolean even when owner_id is NULL.

-- SECURITY DEFINER procedures bypass table RLS, so these guards are mandatory.

-- Preserve existing signatures, permissions, security mode and search_path.

begin;

-- terravale_wallet_self_adjust null-safe owner authorization
CREATE OR REPLACE FUNCTION public.terravale_wallet_self_adjust(target_character uuid, target_denomination text, delta_quantity integer, purpose text DEFAULT 'Player inventory adjustment'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller uuid:=(select auth.uid());ch public.characters%rowtype;
 coin public.terravale_currency_denominations%rowtype;
 old_quantity bigint;new_quantity bigint;ledger_id uuid;
begin
 if caller is null or not exists(select 1 from auth.identities
  where user_id=caller and provider='discord') then
  raise exception 'Verified Discord account required' using errcode='28000';end if;
 select * into ch from public.characters where id=target_character;
 if ch.id is null or ch.owner_id IS DISTINCT FROM caller or not authz.is_member(ch.campaign_id) then
  raise exception 'You may only adjust the wallet of your own campaign character' using errcode='42501';end if;
 if delta_quantity is null or delta_quantity=0 or abs(delta_quantity)>1000000 then
  raise exception 'Choose 1 to 1,000,000 coins to add or remove' using errcode='22023';end if;
 select * into coin from public.terravale_currency_denominations
  where id=target_denomination and enabled=true;
 if coin.id is null then raise exception 'Unknown denomination' using errcode='22023';end if;
 insert into public.terravale_character_wallet(character_id,denomination_id,quantity)
 values(ch.id,coin.id,0) on conflict do nothing;
 select quantity into old_quantity from public.terravale_character_wallet
 where character_id=ch.id and denomination_id=coin.id for update;
 new_quantity:=old_quantity+delta_quantity;
 if new_quantity<0 then raise exception 'Cannot spend more of this physical denomination than owned' using errcode='22023';end if;
 if new_quantity>1000000000 then raise exception 'Wallet holding exceeds supported maximum' using errcode='22023';end if;
 update public.terravale_character_wallet set quantity=new_quantity,updated_at=now()
 where character_id=ch.id and denomination_id=coin.id;
 insert into public.terravale_wallet_ledger(character_id,actor_user_id,denomination_id,
  delta,balance_after,rate_gc_snapshot,operation,note)
 values(ch.id,caller,coin.id,delta_quantity,new_quantity,coin.gc_value,
  case when delta_quantity>0 then 'player_add' else 'player_remove' end,
  left(coalesce(purpose,''),240))
 returning id into ledger_id;
 return jsonb_build_object('saved',true,'character_id',ch.id,'denomination_id',coin.id,
  'quantity',new_quantity,'change',delta_quantity,'ledger_id',ledger_id);
end;
$function$
;

-- terravale_save_starting_proficiencies null-safe owner authorization
CREATE OR REPLACE FUNCTION public.terravale_save_starting_proficiencies(target_character uuid, chosen_tools text[] DEFAULT '{}'::text[], chosen_languages text[] DEFAULT '{}'::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 if ch.owner_id IS DISTINCT FROM caller and not authz.is_dm(ch.campaign_id) then
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
$function$
;

-- terravale_send_item_to_dm_vault null-safe owner authorization
CREATE OR REPLACE FUNCTION public.terravale_send_item_to_dm_vault(source_character uuid, source_item_id text, send_quantity integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller uuid:=(select auth.uid());src public.characters%rowtype;
 dm_user uuid;source_inv jsonb;new_inv jsonb;item jsonb;p jsonb;
 qty integer;existing integer;vault_id uuid;notice_id uuid;player_name text;
begin
 if caller is null or not exists(select 1 from auth.identities where user_id=caller and provider='discord')
 then raise exception 'Verified Discord required' using errcode='28000';end if;
 select * into src from public.characters where id=source_character;
 if src.id is null or src.owner_id IS DISTINCT FROM caller or not authz.is_member(src.campaign_id) then
  raise exception 'Only the real character owner can sell or return an item to the DM' using errcode='42501';end if;
 select owner_id into dm_user from public.campaigns where id=src.campaign_id;
 if dm_user is null or not exists(select 1 from auth.identities
  where user_id=dm_user and provider='discord') then
  raise exception 'The campaign has no available Dungeon Master vault' using errcode='42501';end if;
 if source_item_id is null or source_item_id !~ '^[A-Za-z0-9_-]{1,96}$' then
  raise exception 'Invalid item ID' using errcode='22023';end if;
 select inventory into source_inv from public.character_state where character_id=src.id for update;
 select e.value into item from jsonb_array_elements(source_inv)e(value)
  where e.value->>'id'=source_item_id limit 1;
 if item is null or coalesce(item->>'slot','')<>'' or
    coalesce(item->>'location','backpack')='equipped' then
  raise exception 'Unequip and place the item in your backpack before sending' using errcode='22023';end if;
 qty:=coalesce((item->>'qty')::integer,(item->>'quantity')::integer,1);
 if send_quantity is null or send_quantity<1 or send_quantity>qty then
  raise exception 'Invalid item quantity' using errcode='22023';end if;
 select properties into p from public.character_item_properties
  where character_id=src.id and item_id=source_item_id for update;
 if p is not null and send_quantity<>qty then
  raise exception 'DM-powered items must transfer whole' using errcode='22023';end if;
 select count(*) into existing from public.terravale_dm_vault_items
  where owner_user_id=dm_user and campaign_id=src.campaign_id;
 if existing>=2000 then raise exception 'DM vault is full' using errcode='22023';end if;
 if send_quantity=qty then
  select coalesce(jsonb_agg(e.value order by e.ordinality),'[]'::jsonb) into new_inv
  from jsonb_array_elements(source_inv) with ordinality e(value,ordinality)
  where e.value->>'id'<>source_item_id;
 else
  select jsonb_agg(case when e.value->>'id'=source_item_id
    then e.value||jsonb_build_object('qty',qty-send_quantity,'quantity',qty-send_quantity)
    else e.value end order by e.ordinality) into new_inv
  from jsonb_array_elements(source_inv) with ordinality e(value,ordinality);
 end if;
 insert into public.terravale_dm_vault_items(owner_user_id,campaign_id,item_data,mechanics)
 values(dm_user,src.campaign_id,
  item||jsonb_build_object('qty',send_quantity,'quantity',send_quantity,'slot','','location','backpack'),
  case when p is null then '{}'::jsonb
  else p||jsonb_build_object('attuned',false) end)
 returning id into vault_id;
 update public.character_state set inventory=new_inv,updated_at=now()
  where character_id=src.id;
 delete from public.character_item_properties
  where character_id=src.id and item_id=source_item_id;
 select coalesce(nullif(discord_username,''),'Adventurer') into player_name
  from public.terravale_profiles where user_id=caller;
 insert into public.terravale_item_transfer_notifications(
  recipient_user_id,sender_user_id,source_character_id,target_character_id,
  sender_player_name,source_character_name,target_character_name,item_name,item_quantity)
 values(dm_user,caller,src.id,null,coalesce(player_name,'Adventurer'),src.name,
  'DM Vault',item->>'name',send_quantity) returning id into notice_id;
 return jsonb_build_object('sent',true,'vault_item_id',vault_id,'notification_id',notice_id,
  'source_inventory',new_inv,'quantity',send_quantity);
end;
$function$
;

-- terravale_item_action null-safe owner authorization
CREATE OR REPLACE FUNCTION public.terravale_item_action(target_character uuid, target_item text, operation text DEFAULT 'use'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid:=(select auth.uid());
  ch public.characters%rowtype;
  inv jsonb;
  props jsonb;
  can_dm boolean;
  current_value integer; max_value integer;
  charge_cost integer; new_value integer;
  existing_attunements integer;
  changed integer:=0;
begin
  if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord')
    then raise exception 'Verified Discord sign-in required' using errcode='28000'; end if;
  select * into ch from public.characters where id=target_character;
  if not found then raise exception 'Character not found' using errcode='22023'; end if;
  can_dm:=authz.is_dm(ch.campaign_id);
  if not can_dm and not (coalesce(ch.owner_id=actor,false) and authz.is_member(ch.campaign_id))
    then raise exception 'Only this character owner or the campaign DM can use item abilities' using errcode='42501'; end if;
  if operation='dawn' and not can_dm
    then raise exception 'Only your DM can declare a dawn recharge' using errcode='42501'; end if;
  if operation not in ('use','attune','unattune','dawn')
    then raise exception 'Unknown item action' using errcode='22023'; end if;
  select inventory into inv from public.character_state where character_id=target_character;
  if jsonb_typeof(inv)<>'array' or not exists(
    select 1 from jsonb_array_elements(inv) e where e->>'id'=target_item)
    then raise exception 'The item is not in this character inventory' using errcode='22023'; end if;
  select properties into props from public.character_item_properties
   where character_id=target_character and item_id=target_item for update;
  if not found then raise exception 'DM-approved item properties not found' using errcode='22023'; end if;

  if operation='use' then
    max_value:=coalesce((props->>'max_charges')::integer,0);
    if max_value<1 then raise exception 'This item has no charge pool' using errcode='22023'; end if;
    if coalesce((props->>'attunement')::boolean,false)
       and not coalesce((props->>'attuned')::boolean,false) then
      raise exception 'Attune to this item before activating it' using errcode='22023';
    end if;
    charge_cost:=greatest(1,coalesce((props->>'charge_cost')::integer,1));
    current_value:=coalesce((props->>'charges')::integer,0);
    if current_value<charge_cost then raise exception 'Not enough charges' using errcode='22023'; end if;
    props:=jsonb_set(props,'{charges}',to_jsonb(current_value-charge_cost),true);
    changed:=-charge_cost;
  elsif operation='attune' then
    if not coalesce((props->>'attunement')::boolean,false)
      then raise exception 'This item does not require attunement' using errcode='22023'; end if;
    if not coalesce((props->>'attuned')::boolean,false) then
      select count(*) into existing_attunements from public.character_item_properties
       where character_id=target_character and item_id<>target_item
         and properties->>'attunement'='true' and properties->>'attuned'='true';
      if existing_attunements>=3 then raise exception 'Maximum three attuned items; unattune one first' using errcode='22023'; end if;
      props:=jsonb_set(props,'{attuned}','true'::jsonb,true);
    end if;
  elsif operation='unattune' then
    props:=jsonb_set(props,'{attuned}','false'::jsonb,true);
  else
    if coalesce(props->>'recovery','manual')<>'dawn' then
      raise exception 'This item does not recharge at dawn' using errcode='22023'; end if;
    max_value:=coalesce((props->>'max_charges')::integer,0);
    if max_value<1 then raise exception 'This item has no charge pool' using errcode='22023'; end if;
    current_value:=coalesce((props->>'charges')::integer,0);
    new_value:=least(max_value,current_value+
      authz.terravale_item_recharge_gain(props,max_value));
    changed:=new_value-current_value;
    props:=jsonb_set(props,'{charges}',to_jsonb(new_value),true);
  end if;
  update public.character_item_properties
    set properties=props,updated_at=now()
    where character_id=target_character and item_id=target_item;
  return jsonb_build_object('item_id',target_item,'properties',props,'charge_change',changed);
end;
$function$
;

-- terravale_item_rest null-safe owner authorization
CREATE OR REPLACE FUNCTION public.terravale_item_rest(target_character uuid, rest_kind text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid:=(select auth.uid());
  ch public.characters%rowtype;
  inv jsonb;
  row_item record;
  p jsonb;
  max_value integer; old_value integer; new_value integer;
  changed jsonb:='[]'::jsonb;
begin
  if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord')
    then raise exception 'Verified Discord sign-in required' using errcode='28000'; end if;
  select * into ch from public.characters where id=target_character;
  if not found then raise exception 'Character not found' using errcode='22023'; end if;
  if not authz.is_dm(ch.campaign_id)
    and not (coalesce(ch.owner_id=actor,false) and authz.is_member(ch.campaign_id)) then
      raise exception 'Only the character owner or DM can rest' using errcode='42501';
  end if;
  if rest_kind not in ('short','long')
    then raise exception 'Only short and long rests are supported' using errcode='22023'; end if;
  select inventory into inv from public.character_state where character_id=target_character;
  for row_item in
    select ip.item_id,ip.properties from public.character_item_properties ip
     where ip.character_id=target_character
       and (ip.properties->>'recovery'='short' or
           (rest_kind='long' and ip.properties->>'recovery'='long'))
     order by ip.item_id for update
  loop
    if not exists(select 1 from jsonb_array_elements(coalesce(inv,'[]'::jsonb)) e
                  where e->>'id'=row_item.item_id) then continue; end if;
    p:=row_item.properties;
    max_value:=coalesce((p->>'max_charges')::integer,0);
    old_value:=coalesce((p->>'charges')::integer,0);
    if max_value<1 or old_value>=max_value then continue; end if;
    new_value:=least(max_value,old_value+authz.terravale_item_recharge_gain(p,max_value));
    if new_value=old_value then continue; end if;
    p:=jsonb_set(p,'{charges}',to_jsonb(new_value),true);
    update public.character_item_properties
       set properties=p,updated_at=now()
       where character_id=target_character and item_id=row_item.item_id;
    changed:=changed||jsonb_build_array(jsonb_build_object(
      'item_id',row_item.item_id,'from',old_value,'to',new_value));
  end loop;
  return jsonb_build_object(
    'recharged',changed,
    'item_properties',(select coalesce(jsonb_object_agg(ip.item_id,ip.properties),'{}'::jsonb)
       from public.character_item_properties ip where ip.character_id=target_character)
  );
end;
$function$
;

-- terravale_send_backpack_item null-safe owner authorization
CREATE OR REPLACE FUNCTION public.terravale_send_backpack_item(source_character uuid, recipient_character uuid, source_item_id text, send_quantity integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 sender uuid:=(select auth.uid());
 src public.characters%rowtype;
 dst public.characters%rowtype;
 source_inv jsonb;
 dest_inv jsonb;
 old_item jsonb;
 new_item jsonb;
 new_id text;
 total integer;
 src_new jsonb;
 dst_new jsonb;
 old_props jsonb;
 new_props jsonb;
 notification_id uuid;
 player_label text;
begin
 if sender is null or not exists(
  select 1 from auth.identities where user_id=sender and provider='discord'
 ) then raise exception 'Verified Discord sign-in required' using errcode='28000'; end if;
 if source_character=recipient_character then
  raise exception 'Choose another character as recipient' using errcode='22023'; end if;
 if source_item_id is null or source_item_id !~ '^[A-Za-z0-9_-]{1,96}$'
   or send_quantity is null or send_quantity<1 or send_quantity>999 then
   raise exception 'Invalid item identifier or transfer quantity' using errcode='22023'; end if;
 select * into src from public.characters where id=source_character;
 select * into dst from public.characters where id=recipient_character;
 if src.id is null or dst.id is null or src.campaign_id<>dst.campaign_id then
  raise exception 'Both characters must belong to the same campaign' using errcode='42501'; end if;
 if not authz.is_dm(src.campaign_id) and not (
  coalesce(src.owner_id=sender,false) and authz.is_member(src.campaign_id)
 ) then raise exception 'You can only send from your own character or as the campaign DM' using errcode='42501'; end if;
 if dst.owner_id is null
   or dst.owner_id=sender
   or (src.owner_id is not null and dst.owner_id=src.owner_id) then
   raise exception 'Choose a character belonging to another real player' using errcode='22023'; end if;
 if dst.status not in ('approved','draft') or not exists(
  select 1 from public.campaign_members m
  where m.campaign_id=dst.campaign_id and m.user_id=dst.owner_id
 ) then raise exception 'The recipient character must belong to a campaign member' using errcode='42501'; end if;

 -- Serialize inverse transfers by locking both inventories in UUID order.
 perform 1 from public.character_state
  where character_id in (source_character,recipient_character)
  order by character_id for update;
 select inventory into source_inv from public.character_state where character_id=source_character;
 select inventory into dest_inv from public.character_state where character_id=recipient_character;
 if jsonb_typeof(source_inv)<>'array' or jsonb_typeof(dest_inv)<>'array' then
  raise exception 'A character inventory is unavailable' using errcode='22023'; end if;
 if jsonb_array_length(dest_inv)>=300 then
  raise exception 'Recipient backpack is full' using errcode='22023'; end if;
 select e.value into old_item from jsonb_array_elements(source_inv) e(value)
  where e.value->>'id'=source_item_id limit 1;
 if old_item is null then raise exception 'The item is no longer in that backpack' using errcode='22023'; end if;
 if coalesce(old_item->>'slot','') not in ('','backpack') or
   coalesce(old_item->>'location','backpack')='equipped' then
   raise exception 'Unequip the item before sending it' using errcode='22023'; end if;
 total:=coalesce((old_item->>'qty')::integer,(old_item->>'quantity')::integer,1);
 if total<send_quantity then raise exception 'Not enough items in the backpack' using errcode='22023'; end if;

 select properties into old_props from public.character_item_properties
  where character_id=source_character and item_id=source_item_id for update;
 if old_props is not null and send_quantity<total then
   raise exception 'Items with charges or DM-approved powers must be transferred whole' using errcode='22023';
 end if;
 new_id:='gift-'||replace(gen_random_uuid()::text,'-','');
 new_item:=old_item||jsonb_build_object(
   'id',new_id,'qty',send_quantity,'quantity',send_quantity,
   'slot','','location','backpack'
 );
 if send_quantity=total then
   select coalesce(jsonb_agg(e.value order by e.ordinality),'[]'::jsonb)
    into src_new from jsonb_array_elements(source_inv)
    with ordinality e(value,ordinality) where e.value->>'id'<>source_item_id;
 else
   select jsonb_agg(
     case when e.value->>'id'=source_item_id then
      e.value||jsonb_build_object('qty',total-send_quantity,'quantity',total-send_quantity)
     else e.value end order by e.ordinality
   ) into src_new from jsonb_array_elements(source_inv)
   with ordinality e(value,ordinality);
 end if;
 dst_new:=dest_inv||jsonb_build_array(new_item);

 -- All changes are committed as ONE database transaction. If any step fails,
 -- neither character's backpack is changed and no notification is created.
 update public.character_state set inventory=src_new,updated_at=now()
  where character_id=source_character;
 update public.character_state set inventory=dst_new,updated_at=now()
  where character_id=recipient_character;

 if old_props is not null then
   new_props:=old_props;
   if new_props ? 'attuned' then
     new_props:=jsonb_set(new_props,'{attuned}','false'::jsonb,true);
   end if;
   delete from public.character_item_properties
    where character_id=source_character and item_id=source_item_id;
   insert into public.character_item_properties(character_id,item_id,properties)
    values(recipient_character,new_id,new_props);
 end if;
 select coalesce(nullif(p.discord_username,''),'A fellow adventurer')
   into player_label from public.terravale_profiles p where p.user_id=sender;
 player_label:=coalesce(player_label,'A fellow adventurer');
 insert into public.terravale_item_transfer_notifications(
   recipient_user_id,sender_user_id,source_character_id,target_character_id,
   sender_player_name,source_character_name,target_character_name,item_name,item_quantity
 ) values(
   dst.owner_id,sender,src.id,dst.id,
   left(player_label,100),src.name,dst.name,coalesce(old_item->>'name','Unnamed item'),send_quantity
 ) returning id into notification_id;
 return jsonb_build_object(
  'sent',true,'source_character',src.id,'recipient_character',dst.id,
  'source_inventory',src_new,'recipient_inventory',dst_new,
  'source_item_id',source_item_id,'recipient_item_id',new_id,
  'notification_id',notification_id,'item_name',old_item->>'name',
  'quantity',send_quantity
 );
end;
$function$
;

-- terravale_wallet_transfer null-safe owner authorization
CREATE OR REPLACE FUNCTION public.terravale_wallet_transfer(source_character uuid, recipient_character uuid, target_denomination text, transfer_quantity integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller uuid:=(select auth.uid());
 src public.characters%rowtype;dst public.characters%rowtype;
 coin public.terravale_currency_denominations%rowtype;
 old_src bigint;old_dst bigint;ticket uuid:=gen_random_uuid();
begin
 if caller is null or not exists(select 1 from auth.identities
 where user_id=caller and provider='discord')
 then raise exception 'Verified Discord required' using errcode='28000'; end if;
 if source_character=recipient_character or transfer_quantity is null
   or transfer_quantity<1 or transfer_quantity>1000000
 then raise exception 'Invalid transfer request' using errcode='22023'; end if;
 select * into src from public.characters where id=source_character;
 select * into dst from public.characters where id=recipient_character;
 if src.id is null or dst.id is null or src.campaign_id<>dst.campaign_id
 then raise exception 'Both characters must belong to one campaign' using errcode='42501';end if;
 if not authz.is_dm(src.campaign_id) and not
   (coalesce(src.owner_id=caller,false) and authz.is_member(src.campaign_id))
 then raise exception 'Not permitted to spend from that character' using errcode='42501';end if;
 if dst.owner_id is null or
  (dst.owner_id<>(select c.owner_id from public.campaigns c where c.id=dst.campaign_id)
   and not exists(select 1 from public.campaign_members cm
    where cm.campaign_id=dst.campaign_id and cm.user_id=dst.owner_id))
 then raise exception 'Recipient is not an active player' using errcode='42501';end if;
 select * into coin from public.terravale_currency_denominations where id=target_denomination and enabled;
 if coin.id is null then raise exception 'Unknown denomination' using errcode='22023';end if;
 -- Rows are locked in a stable character-UUID order to prevent deadlocks.
 insert into public.terravale_character_wallet(character_id,denomination_id,quantity)
 values(src.id,coin.id,0),(dst.id,coin.id,0) on conflict do nothing;
 perform 1 from public.terravale_character_wallet w
 where w.character_id in(src.id,dst.id) and w.denomination_id=coin.id
 order by w.character_id for update;
 select quantity into old_src from public.terravale_character_wallet
  where character_id=src.id and denomination_id=coin.id;
 select quantity into old_dst from public.terravale_character_wallet
  where character_id=dst.id and denomination_id=coin.id;
 if old_src<transfer_quantity or old_dst+transfer_quantity>1000000000
 then raise exception 'Insufficient funds or recipient balance limit' using errcode='22023';end if;
 update public.terravale_character_wallet set
 quantity=case when character_id=src.id then old_src-transfer_quantity
 else old_dst+transfer_quantity end,updated_at=now()
 where character_id in(src.id,dst.id) and denomination_id=coin.id;
 insert into public.terravale_wallet_ledger(transfer_id,character_id,actor_user_id,
 denomination_id,delta,balance_after,rate_gc_snapshot,operation,note)
 values(ticket,src.id,caller,coin.id,-transfer_quantity,old_src-transfer_quantity,
 coin.gc_value,'transfer_out','Sent to '||dst.name),
 (ticket,dst.id,caller,coin.id,transfer_quantity,old_dst+transfer_quantity,
 coin.gc_value,'transfer_in','Received from '||src.name);
 return jsonb_build_object('success',true,'transfer_id',ticket,
  'denomination_id',coin.id,'amount',transfer_quantity);
end;
$function$
;

-- set_character_sheet_visibility null-safe owner authorization
CREATE OR REPLACE FUNCTION public.set_character_sheet_visibility(target_character uuid, want_visible boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare target public.characters%rowtype;
begin
 if (select auth.uid()) is null or want_visible is null then
  raise exception 'Authenticated visibility choice required' using errcode='42501';
 end if;
 select * into target from public.characters where id=target_character for update;
 if not found then raise exception 'Character not found'; end if;
 if not authz.is_dm(target.campaign_id)
  and not (coalesce(target.owner_id=(select auth.uid()),false) and authz.is_member(target.campaign_id)) then
  raise exception 'Only the owner or campaign DM can change full-sheet visibility' using errcode='42501';
 end if;
 update public.characters set sheet_visible_to_party=want_visible where id=target_character;
 return want_visible;
end
$function$
;

-- set_player_character_summary null-safe owner authorization
CREATE OR REPLACE FUNCTION public.set_player_character_summary(target_character uuid, summary_text text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare target public.characters%rowtype;
declare clean_summary text;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign-in required' using errcode='42501';
  end if;
  clean_summary := btrim(coalesce(summary_text, ''));
  if char_length(clean_summary) > 12000 then
    raise exception 'Backstory too long' using errcode='22023';
  end if;
  select * into target from public.characters where id=target_character for update;
  if not found
    or not authz.is_member(target.campaign_id)
    or not (coalesce(target.owner_id = (select auth.uid()),false) or authz.is_dm(target.campaign_id))
  then
    raise exception 'Cannot edit this character backstory' using errcode='42501';
  end if;
  update public.characters
  set approved_build = jsonb_set(target.approved_build, '{summary}', to_jsonb(clean_summary), true)
  where id=target_character;
  insert into public.audit_events(character_id,actor_id,action,previous_value,next_value)
  values(target_character,(select auth.uid()),'player_safe_summary_updated',
         jsonb_build_object('summary',target.approved_build->>'summary'),
         jsonb_build_object('summary',clean_summary));
  return clean_summary;
end;
$function$
;

-- set_character_portrait null-safe owner authorization
CREATE OR REPLACE FUNCTION public.set_character_portrait(target_character uuid, object_path text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare ch public.characters%rowtype;
begin
 select * into ch from public.characters where id=target_character;
 if ch.id is null or (select auth.uid()) is null or not
  (authz.is_dm(ch.campaign_id) or
   (coalesce(ch.owner_id=(select auth.uid()),false) and authz.is_member(ch.campaign_id)))
 then raise exception 'You cannot edit this character portrait' using errcode='42501'; end if;
 if object_path is not null then
  if object_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$'
     or split_part(object_path,'/',1)<>target_character::text
     or not exists(select 1 from storage.objects
                   where bucket_id='terravale-character-portraits' and name=object_path)
  then raise exception 'Invalid or missing character portrait' using errcode='22023';end if;
 end if;
 update public.characters set portrait_path=object_path where id=target_character;
 return object_path;
end $function$
;

commit;