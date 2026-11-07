-- Secure campaign-DM authored item mechanics.
-- Inventory ownership, equipment locations and movement remain in character_state.inventory;
-- mechanical properties live independently so owner autosaves cannot overwrite DM rulings.
create table if not exists public.character_item_properties (
  character_id uuid not null references public.characters(id) on delete cascade,
  item_id text not null check (item_id ~ '^[A-Za-z0-9_-]{1,96}$'),
  properties jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key(character_id,item_id),
  constraint valid_character_item_properties check
    (jsonb_typeof(properties)='object' and pg_column_size(properties)<15000)
);
alter table public.character_item_properties enable row level security;
drop policy if exists dm_item_properties_read on public.character_item_properties;
create policy dm_item_properties_read on public.character_item_properties
 for select to authenticated using (
 exists (
  select 1 from public.characters c
  where c.id=character_id
    and (
       authz.is_dm(c.campaign_id)
       or ((select auth.uid())=c.owner_id and authz.is_member(c.campaign_id))
       or (authz.is_member(c.campaign_id) and c.status='approved' and c.sheet_visible_to_party)
    )
 )
);
revoke all on table public.character_item_properties from public,anon,authenticated;
grant select on table public.character_item_properties to authenticated;

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
                     'max_charges','recharge','features','rarity','attunement') then
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
       on conflict(character_id,item_id) do update set
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
revoke all on function public.terravale_dm_edit_inventory_item(uuid,text,jsonb,jsonb,boolean)
 from public,anon;
grant execute on function public.terravale_dm_edit_inventory_item(uuid,text,jsonb,jsonb,boolean)
 to authenticated;
