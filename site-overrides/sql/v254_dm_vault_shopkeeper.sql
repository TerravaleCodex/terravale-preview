-- V2.54 permanent campaign-DM item store. Separate from player inventories.
create table if not exists public.terravale_dm_vault_items(
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 item_data jsonb not null,
 mechanics jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists tv_dm_vault_owner_campaign on public.terravale_dm_vault_items(owner_user_id,campaign_id);
alter table public.terravale_dm_vault_items enable row level security;
revoke all on public.terravale_dm_vault_items from public,anon,authenticated;
grant select on public.terravale_dm_vault_items to authenticated;
drop policy if exists tv_dm_vault_owner_select on public.terravale_dm_vault_items;
create policy tv_dm_vault_owner_select on public.terravale_dm_vault_items
 for select to authenticated using(owner_user_id=(select auth.uid()) and authz.is_dm(campaign_id));

create or replace function public.terravale_vault_save_item(
 target_campaign uuid,existing_item uuid,item_payload jsonb,
 mechanics_payload jsonb default '{}'::jsonb,delete_item boolean default false
) returns jsonb language plpgsql security definer set search_path=''
as $save$
declare caller uuid:=(select auth.uid());saved_id uuid;data jsonb:=coalesce(item_payload,'{}'::jsonb);
 p jsonb:=coalesce(mechanics_payload,'{}'::jsonb);count_items integer;qty integer;
begin
 if caller is null or not exists(select 1 from auth.identities where user_id=caller and provider='discord')
 then raise exception 'Verified Discord required' using errcode='28000';end if;
 if not authz.is_dm(target_campaign) then
  raise exception 'Only the campaign Dungeon Master may edit this vault' using errcode='42501';end if;
 if existing_item is not null and not exists(select 1 from public.terravale_dm_vault_items
  where id=existing_item and owner_user_id=caller and campaign_id=target_campaign) then
   raise exception 'No such vault item' using errcode='22023';end if;
 if delete_item then
  if existing_item is null then raise exception 'Choose a vault item to delete' using errcode='22023';end if;
  delete from public.terravale_dm_vault_items where id=existing_item and owner_user_id=caller
    and campaign_id=target_campaign;
  return jsonb_build_object('deleted',true,'id',existing_item);
 end if;
 if jsonb_typeof(data)<>'object' or jsonb_typeof(p)<>'object'
  or pg_column_size(data)>12000 or pg_column_size(p)>12000 then
  raise exception 'Malformed item data' using errcode='22023';end if;
 if length(btrim(coalesce(data->>'name',''))) not between 1 and 120 or
  length(coalesce(data->>'description',''))>2400 or length(coalesce(data->>'kind','item'))>40 then
   raise exception 'Invalid item name, description or type' using errcode='22023';end if;
 if coalesce(data->>'qty','1') !~ '^[0-9]{1,3}$' then
  raise exception 'Quantity must be 1 to 999' using errcode='22023';end if;
 qty:=(data->>'qty')::integer;
 if qty<1 or qty>999 then raise exception 'Quantity must be between 1 and 999' using errcode='22023';end if;
 if coalesce((p->>'charges')::integer,0)<0 or
    coalesce((p->>'max_charges')::integer,0)<0 or
    coalesce((p->>'charges')::integer,0)>coalesce((p->>'max_charges')::integer,0) or
    coalesce((p->>'max_charges')::integer,0)>999 then
  raise exception 'Invalid item charges' using errcode='22023';end if;
 if coalesce(p->>'recovery','manual') not in('manual','short','long','dawn') then
  raise exception 'Invalid recharge rule' using errcode='22023';end if;
 if length(coalesce(p->>'features',''))>5000 or
  length(coalesce(p->>'damage_dice',''))>80 or
  length(coalesce(p->>'damage_type',''))>80 or
  length(coalesce(p->>'rarity',''))>80 then
  raise exception 'Invalid mechanics description' using errcode='22023';end if;
 if coalesce(p->>'damage_dice','')<>'' and
  (p->>'damage_dice') !~* '^([1-9]|1[0-9]|20)d(4|6|8|10|12|20|100)([ ]*[+-][ ]*[0-9]{1,2})?$' then
  raise exception 'Invalid damage dice syntax' using errcode='22023';end if;
 if coalesce(p->>'recharge_dice','')<>'' and
  (p->>'recharge_dice') !~* '^([1-9]|1[0-9]|20)d(4|6|8|10|12|20)([ ]*[+-][ ]*[0-9]{1,2})?$' then
  raise exception 'Invalid recharge dice syntax' using errcode='22023';end if;
 if (select bool_or(k not in (
  'ac_bonus','attack_bonus','damage_dice','damage_type','charges','max_charges',
  'recharge','features','rarity','attunement','weapon_action','resource_tracker',
  'attack_ability','damage_ability','proficient','recovery','recharge_amount',
  'recharge_dice','charge_cost','attuned'
 )) from jsonb_object_keys(p) k) then
   raise exception 'Unsupported item mechanics field' using errcode='22023';end if;
 if coalesce((p->>'attunement')::boolean,false) then
  p:=jsonb_set(p,'{attuned}','false'::jsonb,true);
 end if;
 data:=data||jsonb_build_object('qty',qty,'quantity',qty,'slot','','location','backpack');
 if existing_item is null then
  select count(*) into count_items from public.terravale_dm_vault_items
  where owner_user_id=caller and campaign_id=target_campaign;
  if count_items>=2000 then raise exception 'DM vault has reached 2,000 item entries' using errcode='22023';end if;
  insert into public.terravale_dm_vault_items(owner_user_id,campaign_id,item_data,mechanics)
  values(caller,target_campaign,data,p) returning id into saved_id;
 else
  update public.terravale_dm_vault_items set item_data=data,
   mechanics=p,updated_at=now() where id=existing_item and owner_user_id=caller
   returning id into saved_id;
 end if;
 return jsonb_build_object('saved',true,'id',saved_id,'item',data,'mechanics',p);
end;
$save$;
revoke all on function public.terravale_vault_save_item(uuid,uuid,jsonb,jsonb,boolean) from public,anon;
grant execute on function public.terravale_vault_save_item(uuid,uuid,jsonb,jsonb,boolean) to authenticated;

create or replace function public.terravale_vault_issue_item(
 vault_item_id uuid,recipient_character uuid,send_quantity integer default 1
) returns jsonb language plpgsql security definer set search_path=''
as $issue$
declare caller uuid:=(select auth.uid());v public.terravale_dm_vault_items%rowtype;
 target public.characters%rowtype;inv jsonb;qty integer;new_item jsonb;
 out_id text;out_mechanics jsonb;who text;notice_id uuid;
begin
 if caller is null or not exists(select 1 from auth.identities where user_id=caller and provider='discord')
 then raise exception 'Verified Discord required' using errcode='28000';end if;
 select * into v from public.terravale_dm_vault_items where id=vault_item_id for update;
 if v.id is null or v.owner_user_id<>caller or not authz.is_dm(v.campaign_id)
 then raise exception 'Only the owning campaign DM may issue this item' using errcode='42501';end if;
 select * into target from public.characters where id=recipient_character;
 if target.id is null or target.campaign_id<>v.campaign_id then
  raise exception 'Recipient belongs to another campaign' using errcode='42501';end if;
 if target.owner_id is not null and not exists(select 1 from public.campaign_members cm
  where cm.campaign_id=target.campaign_id and cm.user_id=target.owner_id) then
   raise exception 'Recipient player is not a member of the campaign' using errcode='42501';end if;
 qty:=(v.item_data->>'qty')::integer;
 if send_quantity is null or send_quantity<1 or send_quantity>qty then
  raise exception 'Quantity exceeds available vault stock' using errcode='22023';end if;
 if v.mechanics<>'{}'::jsonb and send_quantity<>qty then
  raise exception 'Enchanted or charged item stacks transfer whole' using errcode='22023';end if;
 select inventory into inv from public.character_state where character_id=recipient_character for update;
 if jsonb_typeof(inv)<>'array' or jsonb_array_length(inv)>=300 then
  raise exception 'Recipient backpack is unavailable or full' using errcode='22023';end if;
 out_id:='dm-'||replace(gen_random_uuid()::text,'-','');
 new_item:=v.item_data||jsonb_build_object('id',out_id,'qty',send_quantity,'quantity',send_quantity,
  'slot','','location','backpack','origin','dm-vault');
 update public.character_state set inventory=inv||jsonb_build_array(new_item),updated_at=now()
  where character_id=recipient_character;
 out_mechanics:=v.mechanics;
 if out_mechanics<>'{}'::jsonb then
  out_mechanics:=out_mechanics||jsonb_build_object('attuned',false);
  insert into public.character_item_properties(character_id,item_id,properties)
   values(recipient_character,out_id,out_mechanics);
 end if;
 if send_quantity=qty then
  delete from public.terravale_dm_vault_items where id=v.id;
 else
  update public.terravale_dm_vault_items set
   item_data=jsonb_set(jsonb_set(item_data,'{qty}',to_jsonb(qty-send_quantity),true),
    '{quantity}',to_jsonb(qty-send_quantity),true),updated_at=now()
   where id=v.id;
 end if;
 if target.owner_id is not null and target.owner_id<>caller then
  select coalesce(nullif(discord_username,''),'Dungeon Master') into who
    from public.terravale_profiles where user_id=caller;
  insert into public.terravale_item_transfer_notifications(
   recipient_user_id,sender_user_id,source_character_id,target_character_id,
   sender_player_name,source_character_name,target_character_name,item_name,item_quantity)
  values(target.owner_id,caller,null,target.id,coalesce(who,'Dungeon Master'),
   'DM Vault',target.name,v.item_data->>'name',send_quantity) returning id into notice_id;
 end if;
 return jsonb_build_object('sent',true,'target_character',recipient_character,
  'item_id',out_id,'quantity',send_quantity,'notification_id',notice_id,
  'inventory',(select inventory from public.character_state where character_id=recipient_character));
end;
$issue$;
revoke all on function public.terravale_vault_issue_item(uuid,uuid,integer) from public,anon;
grant execute on function public.terravale_vault_issue_item(uuid,uuid,integer) to authenticated;

create or replace function public.terravale_send_item_to_dm_vault(
 source_character uuid,source_item_id text,send_quantity integer default 1
) returns jsonb language plpgsql security definer set search_path=''
as $receive$
declare caller uuid:=(select auth.uid());src public.characters%rowtype;
 dm_user uuid;source_inv jsonb;new_inv jsonb;item jsonb;p jsonb;
 qty integer;existing integer;vault_id uuid;notice_id uuid;player_name text;
begin
 if caller is null or not exists(select 1 from auth.identities where user_id=caller and provider='discord')
 then raise exception 'Verified Discord required' using errcode='28000';end if;
 select * into src from public.characters where id=source_character;
 if src.id is null or src.owner_id<>caller or not authz.is_member(src.campaign_id) then
  raise exception 'Only the real character owner can sell or return an item to the DM' using errcode='42501';end if;
 select owner_id into dm_user from public.campaigns where id=src.campaign_id;
 if dm_user is null or not exists(select 1 from public.campaign_members
  where campaign_id=src.campaign_id and user_id=dm_user and role='dm') then
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
$receive$;
revoke all on function public.terravale_send_item_to_dm_vault(uuid,text,integer) from public,anon;
grant execute on function public.terravale_send_item_to_dm_vault(uuid,text,integer) to authenticated;
