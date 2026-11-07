-- V2.53 — atomic same-campaign player-to-player inventory transfers.
-- No item or charges are created by a transfer; DM-authored properties move with
-- the existing item. Receiving a gift explicitly clears prior attunement.
-- Notifications persist until the recipient chooses Dismiss.

create table if not exists public.terravale_item_transfer_notifications(
 id uuid primary key default gen_random_uuid(),
 recipient_user_id uuid not null references auth.users(id) on delete cascade,
 sender_user_id uuid not null references auth.users(id) on delete cascade,
 source_character_id uuid references public.characters(id) on delete set null,
 target_character_id uuid references public.characters(id) on delete set null,
 sender_player_name text not null,
 source_character_name text not null,
 target_character_name text not null,
 item_name text not null,
 item_quantity integer not null check(item_quantity between 1 and 999),
 created_at timestamptz not null default now(),
 dismissed_at timestamptz
);
create index if not exists terravale_item_gift_pending_idx
 on public.terravale_item_transfer_notifications(recipient_user_id,created_at)
 where dismissed_at is null;

alter table public.terravale_item_transfer_notifications enable row level security;
drop policy if exists item_gift_recipient_read on public.terravale_item_transfer_notifications;
create policy item_gift_recipient_read on public.terravale_item_transfer_notifications
 for select to authenticated using (recipient_user_id=(select auth.uid()));
drop policy if exists item_gift_recipient_dismiss on public.terravale_item_transfer_notifications;
create policy item_gift_recipient_dismiss on public.terravale_item_transfer_notifications
 for update to authenticated using (recipient_user_id=(select auth.uid()))
 with check (recipient_user_id=(select auth.uid()));
revoke all on table public.terravale_item_transfer_notifications from public,anon,authenticated;
grant select on table public.terravale_item_transfer_notifications to authenticated;
grant update(dismissed_at) on table public.terravale_item_transfer_notifications to authenticated;

create or replace function public.terravale_send_backpack_item(
 source_character uuid,
 recipient_character uuid,
 source_item_id text,
 send_quantity integer default 1
) returns jsonb
language plpgsql security definer set search_path=''
as $send$
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
  src.owner_id=sender and authz.is_member(src.campaign_id)
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
$send$;
revoke all on function public.terravale_send_backpack_item(uuid,uuid,text,integer)
 from public,anon;
grant execute on function public.terravale_send_backpack_item(uuid,uuid,text,integer)
 to authenticated;
