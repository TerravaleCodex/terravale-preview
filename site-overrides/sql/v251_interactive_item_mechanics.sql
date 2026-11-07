-- V2.51 interactive item mechanics: new DM configuration and secure player actions.

create or replace function public.terravale_dm_edit_inventory_item(
  target_character uuid,
  item_id text,
  item_payload jsonb default '{}'::jsonb,
  mechanics jsonb default '{}'::jsonb,
  delete_item boolean default false
) returns jsonb
language plpgsql security definer set search_path=''
as $fn$
declare
  caller uuid := (select auth.uid());
  campaign uuid;
  inv jsonb;
  new_inv jsonb;
  old_item jsonb;
  new_item jsonb;
  item_key text := coalesce(item_id,'');
  label text;
  kind text;
  description text;
  quantity integer;
  two_handed boolean;
  props jsonb := coalesce(mechanics,'{}'::jsonb);
  key text;
  ac integer; attack integer; charge integer; max_charge integer;
begin
  if caller is null or not exists (
      select 1 from auth.identities where user_id=caller and provider='discord'
    ) then
    raise exception 'Verified Discord connection required' using errcode='28000';
  end if;
  select c.campaign_id into campaign from public.characters c where c.id=target_character;
  if campaign is null or not authz.is_dm(campaign) then
    raise exception 'Only this campaign Dungeon Master may edit item mechanics' using errcode='42501';
  end if;
  select s.inventory into inv from public.character_state s
    where s.character_id=target_character for update;
  if not found or jsonb_typeof(inv)<>'array' then
    raise exception 'Character inventory unavailable' using errcode='22023';
  end if;
  if item_key<>'' and item_key !~ '^[A-Za-z0-9_-]{1,96}$' then
    raise exception 'Invalid item identifier' using errcode='22023';
  end if;
  if item_key<>'' then
    select e.value into old_item from jsonb_array_elements(inv) e(value)
     where e.value->>'id'=item_key limit 1;
  end if;
  if delete_item then
    if item_key='' or old_item is null then raise exception 'Item does not exist' using errcode='22023'; end if;
    select coalesce(jsonb_agg(e.value order by e.ordinality),'[]'::jsonb) into new_inv
      from jsonb_array_elements(inv) with ordinality e(value,ordinality)
      where e.value->>'id'<>item_key;
    delete from public.character_item_properties
      where character_id=target_character and character_item_properties.item_id=item_key;
  else
    if jsonb_typeof(item_payload)<>'object' or jsonb_typeof(props)<>'object'
      or pg_column_size(item_payload)>12000 or pg_column_size(props)>12000 then
      raise exception 'Invalid item details' using errcode='22023';
    end if;
    label:=btrim(coalesce(item_payload->>'name',''));
    kind:=btrim(coalesce(item_payload->>'kind','item'));
    description:=coalesce(item_payload->>'description','');
    if length(label)<1 or length(label)>120 or length(kind)>40 or length(description)>2400 then
      raise exception 'Item name, type or description is too long' using errcode='22023';
    end if;
    if coalesce(item_payload->>'qty','1') !~ '^[0-9]{1,3}$' then
      raise exception 'Quantity must be between 1 and 999' using errcode='22023';
    end if;
    quantity:=(item_payload->>'qty')::integer;
    if quantity<1 or quantity>999 then raise exception 'Invalid quantity' using errcode='22023'; end if;
    two_handed:=coalesce((item_payload->>'twoHanded')::boolean,false);
    for key in select jsonb_object_keys(props) loop
      if key not in ('ac_bonus','attack_bonus','damage_dice','damage_type','charges',
                     'max_charges','recharge','features','rarity','attunement',
                     'weapon_action','resource_tracker','attack_ability','damage_ability',
                     'proficient','recovery','recharge_amount','recharge_dice','charge_cost') then
        raise exception 'Unrecognised item mechanic: %',key using errcode='22023';
      end if;
    end loop;
    if coalesce(props->>'ac_bonus','') !~ '^[-+]?[0-9]{1,2}$'
       and props ? 'ac_bonus' then raise exception 'Invalid AC modifier' using errcode='22023'; end if;
    if coalesce(props->>'attack_bonus','') !~ '^[-+]?[0-9]{1,2}$'
       and props ? 'attack_bonus' then raise exception 'Invalid attack modifier' using errcode='22023'; end if;
    ac:=case when props ? 'ac_bonus' then (props->>'ac_bonus')::integer else 0 end;
    attack:=case when props ? 'attack_bonus' then (props->>'attack_bonus')::integer else 0 end;
    if abs(ac)>20 or abs(attack)>20 then raise exception 'Modifier outside permitted bounds' using errcode='22023'; end if;
    if (props ? 'charges' and (props->>'charges') !~ '^[0-9]{1,4}$')
       or (props ? 'max_charges' and (props->>'max_charges') !~ '^[0-9]{1,4}$') then
      raise exception 'Invalid item charges' using errcode='22023';
    end if;
    charge:=case when props ? 'charges' then (props->>'charges')::integer else 0 end;
    max_charge:=case when props ? 'max_charges' then (props->>'max_charges')::integer else 0 end;
    if charge>max_charge or max_charge>999 then
      raise exception 'Charges must be within the item maximum' using errcode='22023';
    end if;
    if length(coalesce(props->>'damage_dice',''))>80
      or length(coalesce(props->>'damage_type',''))>80
      or length(coalesce(props->>'recharge',''))>180
      or length(coalesce(props->>'rarity',''))>80
      or length(coalesce(props->>'features',''))>5000 then
      raise exception 'Item mechanics exceed text limits' using errcode='22023';
    end if;
    -- Structured DM item mechanic validation. The item actor controls attunement.
    if coalesce(props->>'recovery','manual') not in ('manual','short','long','dawn') then
      raise exception 'Invalid recharge trigger' using errcode='22023';
    end if;
    if coalesce(props->>'attack_ability','none') not in ('none','str','dex','int','wis','cha')
       or coalesce(props->>'damage_ability','none') not in ('none','str','dex','int','wis','cha') then
      raise exception 'Invalid item attack or damage ability' using errcode='22023';
    end if;
    if props ? 'recharge_dice' and coalesce(props->>'recharge_dice','') <> ''
       and (props->>'recharge_dice') !~* '^([1-9]|1[0-9]|20)d(4|6|8|10|12|20)([ ]*[+-][ ]*[0-9]{1,2})?$' then
      raise exception 'Unsupported recharge dice expression' using errcode='22023';
    end if;
    if props ? 'damage_dice' and coalesce(props->>'damage_dice','') <> ''
       and (props->>'damage_dice') !~* '^([1-9]|1[0-9]|20)d(4|6|8|10|12|20|100)([ ]*[+-][ ]*[0-9]{1,2})?$' then
      raise exception 'Unsupported weapon damage expression' using errcode='22023';
    end if;
    if (props ? 'recharge_amount' and coalesce(props->>'recharge_amount','') !~ '^[0-9]{1,3}$')
       or (props ? 'charge_cost' and coalesce(props->>'charge_cost','') !~ '^[0-9]{1,3}$') then
      raise exception 'Invalid recharge amount or activation cost' using errcode='22023';
    end if;
    if coalesce((props->>'recharge_amount')::integer,0)>999
       or coalesce((props->>'charge_cost')::integer,1) not between 1 and 999 then
      raise exception 'Item charge values outside allowed range' using errcode='22023';
    end if;
    for key in select jsonb_object_keys(props) loop
      if key in ('attunement','weapon_action','resource_tracker','proficient')
          and jsonb_typeof(props->key)<>'boolean' then
        raise exception 'Item flags must be checkboxes' using errcode='22023';
      end if;
    end loop;
    if coalesce((props->>'attunement')::boolean,false) and old_item is not null then
      props:=props||coalesce(
        (select jsonb_build_object('attuned',true)
          from public.character_item_properties ip
          where ip.character_id=target_character and ip.item_id=item_key
           and ip.properties->>'attuned'='true'),
        '{}'::jsonb
      );
    end if;
    if item_key='' then
      if jsonb_array_length(inv)>=300 then raise exception 'Inventory full' using errcode='22023'; end if;
      item_key:='dm-'||replace(gen_random_uuid()::text,'-','');
    elsif old_item is null then
      raise exception 'Item not found on this character' using errcode='22023';
    end if;
    new_item:=coalesce(old_item,'{}'::jsonb)||jsonb_build_object(
      'id',item_key,'name',label,'kind',kind,
      'qty',quantity,'quantity',quantity,'description',description,
      'twoHanded',two_handed,'origin','dm'
    );
    if old_item is null then
      new_item:=new_item||jsonb_build_object('slot','','location','backpack');
      new_inv:=inv||jsonb_build_array(new_item);
    else
      select jsonb_agg(case when e.value->>'id'=item_key then new_item else e.value end
             order by e.ordinality) into new_inv
        from jsonb_array_elements(inv) with ordinality e(value,ordinality);
    end if;
    if props='{}'::jsonb then
      delete from public.character_item_properties
        where character_id=target_character and character_item_properties.item_id=item_key;
    else
      insert into public.character_item_properties(character_id,item_id,properties)
       values(target_character,item_key,props)
       on conflict on constraint character_item_properties_pkey do update set
        properties=excluded.properties,updated_at=now();
    end if;
  end if;
  update public.character_state set inventory=new_inv,updated_at=now()
   where character_id=target_character;
  return jsonb_build_object(
    'item_id',item_key,'inventory',new_inv,
    'item_properties',(
      select coalesce(jsonb_object_agg(ip.item_id,ip.properties),'{}'::jsonb)
       from public.character_item_properties ip where ip.character_id=target_character
    )
  );
end;
$fn$;
-- Roll bounded recharge expressions inside the database. 0 from amount = full.
-- Dice may be used for partial recharges (such as 1d4 at dawn), never evaluated as SQL/JS.
create or replace function authz.terravale_item_recharge_gain(props jsonb,max_value integer)
returns integer language plpgsql volatile security invoker set search_path=''
as $gain$
declare
  dice text:=nullif(btrim(coalesce(props->>'recharge_dice','')),'');
  match text[];
  count_dice integer; faces integer; modifier integer:=0;
  rolled integer:=0; x integer;
begin
  if dice is null then
    return case when coalesce((props->>'recharge_amount')::integer,0)=0
       then max_value else (props->>'recharge_amount')::integer end;
  end if;
  match:=regexp_match(dice,'^([0-9]{1,2})d(4|6|8|10|12|20)([ ]*[+-][ ]*[0-9]{1,2})?$','i');
  if match is null then raise exception 'Invalid recharge dice expression' using errcode='22023'; end if;
  count_dice:=match[1]::integer; faces:=match[2]::integer;
  if count_dice<1 or count_dice>20 then raise exception 'Too many dice' using errcode='22023'; end if;
  if match[3] is not null then modifier:=replace(match[3],' ','')::integer; end if;
  for x in 1..count_dice loop rolled:=rolled+1+floor(random()*faces)::integer; end loop;
  return greatest(0,rolled+modifier);
end;
$gain$;
revoke all on function authz.terravale_item_recharge_gain(jsonb,integer) from public,anon,authenticated;

-- Player or DM can use charges/attune; only DM can declare an in-world dawn.
-- Each operation locks the item row and validates its actual character inventory.
create or replace function public.terravale_item_action(
  target_character uuid, target_item text, operation text default 'use'
) returns jsonb language plpgsql security definer set search_path=''
as $action$
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
  if not can_dm and not (ch.owner_id=actor and authz.is_member(ch.campaign_id))
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
$action$;

-- Called only after the native V2.38 rest is confirmed. Long rest also qualifies
-- an item's "short rest" recovery; dawn and manual never auto-recover.
create or replace function public.terravale_item_rest(
  target_character uuid, rest_kind text
) returns jsonb language plpgsql security definer set search_path=''
as $rest$
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
    and not (ch.owner_id=actor and authz.is_member(ch.campaign_id)) then
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
$rest$;
revoke all on function public.terravale_item_action(uuid,text,text) from public,anon;
grant execute on function public.terravale_item_action(uuid,text,text) to authenticated;
revoke all on function public.terravale_item_rest(uuid,text) from public,anon;
grant execute on function public.terravale_item_rest(uuid,text) to authenticated;
