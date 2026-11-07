-- V2.55: players can manually record gained/spent physical currency in
-- their own character wallets. Changes are real, never a display conversion.
alter table public.terravale_wallet_ledger
 drop constraint if exists terravale_wallet_ledger_operation_check;
alter table public.terravale_wallet_ledger
 add constraint terravale_wallet_ledger_operation_check check(
 operation in('dm_issue','dm_remove','transfer_in','transfer_out',
 'player_add','player_remove'));

create or replace function public.terravale_wallet_self_adjust(
 target_character uuid,target_denomination text,delta_quantity integer,
 purpose text default 'Player inventory adjustment'
) returns jsonb language plpgsql security definer set search_path=''
as $tv55playerwallet$
declare caller uuid:=(select auth.uid());ch public.characters%rowtype;
 coin public.terravale_currency_denominations%rowtype;
 old_quantity bigint;new_quantity bigint;ledger_id uuid;
begin
 if caller is null or not exists(select 1 from auth.identities
  where user_id=caller and provider='discord') then
  raise exception 'Verified Discord account required' using errcode='28000';end if;
 select * into ch from public.characters where id=target_character;
 if ch.id is null or ch.owner_id<>caller or not authz.is_member(ch.campaign_id) then
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
$tv55playerwallet$;
revoke all on function public.terravale_wallet_self_adjust(uuid,text,integer,text) from public,anon;
grant execute on function public.terravale_wallet_self_adjust(uuid,text,integer,text) to authenticated;
