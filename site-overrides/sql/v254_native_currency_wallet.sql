-- V2.54: Native-denomination wallets; no synthetic coin creation on display.
-- Every mutation is a verified, atomic ledger entry. Values use integer GC.
create table if not exists public.terravale_currency_denominations(
 id text primary key,system_id text not null,system_name text not null,
 label text not null,gc_value bigint not null check(gc_value>0),
 enabled boolean not null default true, registry_version text not null default 'v4'
);
alter table public.terravale_currency_denominations enable row level security;
revoke all on public.terravale_currency_denominations from anon,authenticated;
grant select on public.terravale_currency_denominations to authenticated;
drop policy if exists currency_catalogue_read on public.terravale_currency_denominations;
create policy currency_catalogue_read on public.terravale_currency_denominations
 for select to authenticated using (true);

insert into public.terravale_currency_denominations(id,system_id,system_name,label,gc_value,registry_version)
select id,system_id,system_name,label,gc_value,'v4'
from jsonb_to_recordset('[{"id":"guild-seals-copper-seal","system_id":"guild-seals","system_name":"Guild Seals","label":"Copper Seal","gc_value":1},{"id":"guild-seals-silver-seal","system_id":"guild-seals","system_name":"Guild Seals","label":"Silver Seal","gc_value":10},{"id":"guild-seals-gold-seal","system_id":"guild-seals","system_name":"Guild Seals","label":"Gold Seal","gc_value":100},{"id":"guild-seals-platinum-seal","system_id":"guild-seals","system_name":"Guild Seals","label":"Platinum Seal","gc_value":1000},{"id":"human-civics-1-civic","system_id":"human-civics","system_name":"Human Civics","label":"1 Civic","gc_value":2},{"id":"human-civics-5-civics","system_id":"human-civics","system_name":"Human Civics","label":"5 Civics","gc_value":10},{"id":"human-civics-10-civics","system_id":"human-civics","system_name":"Human Civics","label":"10 Civics","gc_value":20},{"id":"human-civics-50-civics","system_id":"human-civics","system_name":"Human Civics","label":"50 Civics","gc_value":100},{"id":"human-civics-100-civics","system_id":"human-civics","system_name":"Human Civics","label":"100 Civics","gc_value":200},{"id":"human-civics-500-civics","system_id":"human-civics","system_name":"Human Civics","label":"500 Civics","gc_value":1000},{"id":"dvergr-measures-half-measure","system_id":"dvergr-measures","system_name":"Dvergr Measures","label":"Half Measure","gc_value":5},{"id":"dvergr-measures-one-measure","system_id":"dvergr-measures","system_name":"Dvergr Measures","label":"One Measure","gc_value":10},{"id":"dvergr-measures-five-measures","system_id":"dvergr-measures","system_name":"Dvergr Measures","label":"Five Measures","gc_value":50},{"id":"dvergr-measures-ten-measures","system_id":"dvergr-measures","system_name":"Dvergr Measures","label":"Ten Measures","gc_value":100},{"id":"dvergr-measures-hundred-measures","system_id":"dvergr-measures","system_name":"Dvergr Measures","label":"Hundred Measures","gc_value":1000},{"id":"ael-vaen-moons-new-moon","system_id":"ael-vaen-moons","system_name":"Ael''Vaen Moons","label":"New Moon","gc_value":1},{"id":"ael-vaen-moons-crescent-moon","system_id":"ael-vaen-moons","system_name":"Ael''Vaen Moons","label":"Crescent Moon","gc_value":2},{"id":"ael-vaen-moons-half-moon","system_id":"ael-vaen-moons","system_name":"Ael''Vaen Moons","label":"Half Moon","gc_value":5},{"id":"ael-vaen-moons-gibbous-moon","system_id":"ael-vaen-moons","system_name":"Ael''Vaen Moons","label":"Gibbous Moon","gc_value":10},{"id":"ael-vaen-moons-full-moon","system_id":"ael-vaen-moons","system_name":"Ael''Vaen Moons","label":"Full Moon","gc_value":20},{"id":"kharithen-witness-tallies-1-tally","system_id":"kharithen-witness-tallies","system_name":"Kharithen Witness Tallies","label":"1 Tally","gc_value":4},{"id":"kharithen-witness-tallies-2-tally","system_id":"kharithen-witness-tallies","system_name":"Kharithen Witness Tallies","label":"2 Tally","gc_value":8},{"id":"kharithen-witness-tallies-5-tally","system_id":"kharithen-witness-tallies","system_name":"Kharithen Witness Tallies","label":"5 Tally","gc_value":20},{"id":"kharithen-witness-tallies-10-tally","system_id":"kharithen-witness-tallies","system_name":"Kharithen Witness Tallies","label":"10 Tally","gc_value":40},{"id":"kharithen-witness-tallies-50-tally","system_id":"kharithen-witness-tallies","system_name":"Kharithen Witness Tallies","label":"50 Tally","gc_value":200},{"id":"kharithen-witness-tallies-100-tally","system_id":"kharithen-witness-tallies","system_name":"Kharithen Witness Tallies","label":"100 Tally","gc_value":400},{"id":"thalassari-tiderings-1-tidering","system_id":"thalassari-tiderings","system_name":"Thalassari Tiderings","label":"1 Tidering","gc_value":2},{"id":"thalassari-tiderings-2-tidering","system_id":"thalassari-tiderings","system_name":"Thalassari Tiderings","label":"2 Tidering","gc_value":4},{"id":"thalassari-tiderings-5-tidering","system_id":"thalassari-tiderings","system_name":"Thalassari Tiderings","label":"5 Tidering","gc_value":10},{"id":"thalassari-tiderings-10-tidering","system_id":"thalassari-tiderings","system_name":"Thalassari Tiderings","label":"10 Tidering","gc_value":20},{"id":"thalassari-tiderings-25-tidering","system_id":"thalassari-tiderings","system_name":"Thalassari Tiderings","label":"25 Tidering","gc_value":50},{"id":"thalassari-tiderings-50-tidering","system_id":"thalassari-tiderings","system_name":"Thalassari Tiderings","label":"50 Tidering","gc_value":100},{"id":"thalassari-tiderings-tidecord","system_id":"thalassari-tiderings","system_name":"Thalassari Tiderings","label":"Tidecord","gc_value":100},{"id":"beastfolk-routeknots-simple-knot","system_id":"beastfolk-routeknots","system_name":"Beastfolk Routeknots","label":"Simple Knot","gc_value":1},{"id":"beastfolk-routeknots-crossing-knot","system_id":"beastfolk-routeknots","system_name":"Beastfolk Routeknots","label":"Crossing Knot","gc_value":5},{"id":"beastfolk-routeknots-hearth-knot","system_id":"beastfolk-routeknots","system_name":"Beastfolk Routeknots","label":"Hearth Knot","gc_value":20},{"id":"beastfolk-routeknots-route-knot","system_id":"beastfolk-routeknots","system_name":"Beastfolk Routeknots","label":"Route Knot","gc_value":100},{"id":"beastfolk-routeknots-great-route-knot","system_id":"beastfolk-routeknots","system_name":"Beastfolk Routeknots","label":"Great Route Knot","gc_value":500},{"id":"daemon-concord-marks-1-concord-mark","system_id":"daemon-concord-marks","system_name":"Daemon Concord Marks","label":"1 Concord Mark","gc_value":5},{"id":"daemon-concord-marks-2-concord-mark","system_id":"daemon-concord-marks","system_name":"Daemon Concord Marks","label":"2 Concord Mark","gc_value":10},{"id":"daemon-concord-marks-5-concord-mark","system_id":"daemon-concord-marks","system_name":"Daemon Concord Marks","label":"5 Concord Mark","gc_value":25},{"id":"daemon-concord-marks-10-concord-mark","system_id":"daemon-concord-marks","system_name":"Daemon Concord Marks","label":"10 Concord Mark","gc_value":50},{"id":"daemon-concord-marks-20-concord-mark","system_id":"daemon-concord-marks","system_name":"Daemon Concord Marks","label":"20 Concord Mark","gc_value":100},{"id":"daemon-concord-marks-100-concord-mark","system_id":"daemon-concord-marks","system_name":"Daemon Concord Marks","label":"100 Concord Mark","gc_value":500},{"id":"fl-gel-currents-1-current","system_id":"fl-gel-currents","system_name":"Flügel Currents","label":"1 Current","gc_value":2},{"id":"fl-gel-currents-5-current","system_id":"fl-gel-currents","system_name":"Flügel Currents","label":"5 Current","gc_value":10},{"id":"fl-gel-currents-10-current","system_id":"fl-gel-currents","system_name":"Flügel Currents","label":"10 Current","gc_value":20},{"id":"fl-gel-currents-25-current","system_id":"fl-gel-currents","system_name":"Flügel Currents","label":"25 Current","gc_value":50},{"id":"fl-gel-currents-50-current","system_id":"fl-gel-currents","system_name":"Flügel Currents","label":"50 Current","gc_value":100},{"id":"fl-gel-currents-100-current","system_id":"fl-gel-currents","system_name":"Flügel Currents","label":"100 Current","gc_value":200},{"id":"fl-gel-currents-500-current","system_id":"fl-gel-currents","system_name":"Flügel Currents","label":"500 Current","gc_value":1000},{"id":"oni-burden-marks-1-burden-mark","system_id":"oni-burden-marks","system_name":"Oni Burden Marks","label":"1 Burden Mark","gc_value":5},{"id":"oni-burden-marks-2-burden-mark","system_id":"oni-burden-marks","system_name":"Oni Burden Marks","label":"2 Burden Mark","gc_value":10},{"id":"oni-burden-marks-5-burden-mark","system_id":"oni-burden-marks","system_name":"Oni Burden Marks","label":"5 Burden Mark","gc_value":25},{"id":"oni-burden-marks-10-burden-mark","system_id":"oni-burden-marks","system_name":"Oni Burden Marks","label":"10 Burden Mark","gc_value":50},{"id":"oni-burden-marks-20-burden-mark","system_id":"oni-burden-marks","system_name":"Oni Burden Marks","label":"20 Burden Mark","gc_value":100},{"id":"oni-burden-marks-100-mark-bar","system_id":"oni-burden-marks","system_name":"Oni Burden Marks","label":"100-Mark Bar","gc_value":500},{"id":"crimsonborn-ledger-notes-half-ledger-note","system_id":"crimsonborn-ledger-notes","system_name":"Crimsonborn Ledger Notes","label":"Half Ledger Note","gc_value":5},{"id":"crimsonborn-ledger-notes-1-ledger-note","system_id":"crimsonborn-ledger-notes","system_name":"Crimsonborn Ledger Notes","label":"1 Ledger Note","gc_value":10},{"id":"crimsonborn-ledger-notes-5-ledger-note","system_id":"crimsonborn-ledger-notes","system_name":"Crimsonborn Ledger Notes","label":"5 Ledger Note","gc_value":50},{"id":"crimsonborn-ledger-notes-10-ledger-note","system_id":"crimsonborn-ledger-notes","system_name":"Crimsonborn Ledger Notes","label":"10 Ledger Note","gc_value":100},{"id":"crimsonborn-ledger-notes-50-ledger-note","system_id":"crimsonborn-ledger-notes","system_name":"Crimsonborn Ledger Notes","label":"50 Ledger Note","gc_value":500},{"id":"crimsonborn-ledger-notes-100-ledger-note","system_id":"crimsonborn-ledger-notes","system_name":"Crimsonborn Ledger Notes","label":"100 Ledger Note","gc_value":1000},{"id":"draconic-hoardstones-shard","system_id":"draconic-hoardstones","system_name":"Draconic Hoardstones","label":"Shard","gc_value":10},{"id":"draconic-hoardstones-lesser-hoardstone","system_id":"draconic-hoardstones","system_name":"Draconic Hoardstones","label":"Lesser Hoardstone","gc_value":50},{"id":"draconic-hoardstones-hoardstone","system_id":"draconic-hoardstones","system_name":"Draconic Hoardstones","label":"Hoardstone","gc_value":100},{"id":"draconic-hoardstones-greater-hoardstone","system_id":"draconic-hoardstones","system_name":"Draconic Hoardstones","label":"Greater Hoardstone","gc_value":500},{"id":"draconic-hoardstones-grand-hoardstone","system_id":"draconic-hoardstones","system_name":"Draconic Hoardstones","label":"Grand Hoardstone","gc_value":1000},{"id":"draconic-hoardstones-sovereign-hoardstone","system_id":"draconic-hoardstones","system_name":"Draconic Hoardstones","label":"Sovereign Hoardstone","gc_value":10000},{"id":"tri-crown-crownrings-third-crownring","system_id":"tri-crown-crownrings","system_name":"Tri-Crown Crownrings","label":"Third Crownring","gc_value":4},{"id":"tri-crown-crownrings-crownring","system_id":"tri-crown-crownrings","system_name":"Tri-Crown Crownrings","label":"Crownring","gc_value":12},{"id":"tri-crown-crownrings-five-crownrings","system_id":"tri-crown-crownrings","system_name":"Tri-Crown Crownrings","label":"Five Crownrings","gc_value":60},{"id":"tri-crown-crownrings-ten-crownrings","system_id":"tri-crown-crownrings","system_name":"Tri-Crown Crownrings","label":"Ten Crownrings","gc_value":120},{"id":"tri-crown-crownrings-great-crownring","system_id":"tri-crown-crownrings","system_name":"Tri-Crown Crownrings","label":"Great Crownring","gc_value":600},{"id":"null-city-meridian-notes-1-meridian-note","system_id":"null-city-meridian-notes","system_name":"Null City Meridian Notes","label":"1 Meridian Note","gc_value":2},{"id":"null-city-meridian-notes-5-meridian-note","system_id":"null-city-meridian-notes","system_name":"Null City Meridian Notes","label":"5 Meridian Note","gc_value":10},{"id":"null-city-meridian-notes-10-meridian-note","system_id":"null-city-meridian-notes","system_name":"Null City Meridian Notes","label":"10 Meridian Note","gc_value":20},{"id":"null-city-meridian-notes-25-meridian-note","system_id":"null-city-meridian-notes","system_name":"Null City Meridian Notes","label":"25 Meridian Note","gc_value":50},{"id":"null-city-meridian-notes-50-meridian-note","system_id":"null-city-meridian-notes","system_name":"Null City Meridian Notes","label":"50 Meridian Note","gc_value":100},{"id":"null-city-meridian-notes-100-meridian-note","system_id":"null-city-meridian-notes","system_name":"Null City Meridian Notes","label":"100 Meridian Note","gc_value":200},{"id":"null-city-meridian-notes-500-meridian-note","system_id":"null-city-meridian-notes","system_name":"Null City Meridian Notes","label":"500 Meridian Note","gc_value":1000}]'::jsonb) as d(
 id text,system_id text,system_name text,label text,gc_value bigint)
on conflict(id) do update set system_id=excluded.system_id,
 system_name=excluded.system_name,label=excluded.label,gc_value=excluded.gc_value,
 registry_version='v4';

create table if not exists public.terravale_character_wallet(
 character_id uuid not null references public.characters(id) on delete cascade,
 denomination_id text not null references public.terravale_currency_denominations(id),
 quantity bigint not null default 0 check(quantity between 0 and 1000000000),
 updated_at timestamptz not null default now(),
 primary key(character_id,denomination_id)
);
create index if not exists tv_wallet_denom_idx on public.terravale_character_wallet(denomination_id);
alter table public.terravale_character_wallet enable row level security;
revoke all on public.terravale_character_wallet from anon,authenticated;
grant select on public.terravale_character_wallet to authenticated;
drop policy if exists wallet_owner_dm_read on public.terravale_character_wallet;
create policy wallet_owner_dm_read on public.terravale_character_wallet
 for select to authenticated using(exists(
  select 1 from public.characters ch where ch.id=character_id
   and (ch.owner_id=(select auth.uid()) or authz.is_dm(ch.campaign_id))
));

create table if not exists public.terravale_wallet_ledger(
 id uuid primary key default gen_random_uuid(),
 transfer_id uuid,
 character_id uuid not null references public.characters(id) on delete cascade,
 actor_user_id uuid not null references auth.users(id),
 denomination_id text not null references public.terravale_currency_denominations(id),
 delta bigint not null check(delta between -1000000 and 1000000 and delta<>0),
 balance_after bigint not null check(balance_after>=0),
 rate_gc_snapshot bigint not null check(rate_gc_snapshot>0),
 operation text not null check(operation in ('dm_issue','dm_remove','transfer_in','transfer_out')),
 note text not null default '',
 created_at timestamptz not null default now()
);
create index if not exists tv_wallet_ledger_character_idx
 on public.terravale_wallet_ledger(character_id,created_at desc);
alter table public.terravale_wallet_ledger enable row level security;
revoke all on public.terravale_wallet_ledger from anon,authenticated;
grant select on public.terravale_wallet_ledger to authenticated;
drop policy if exists wallet_ledger_owner_dm_read on public.terravale_wallet_ledger;
create policy wallet_ledger_owner_dm_read on public.terravale_wallet_ledger
 for select to authenticated using(exists(
  select 1 from public.characters ch where ch.id=character_id
    and (ch.owner_id=(select auth.uid()) or authz.is_dm(ch.campaign_id))
));

create or replace function public.terravale_wallet_adjust(
 target_character uuid,target_denomination text,delta_quantity integer,
 purpose text default 'DM grant'
) returns jsonb
language plpgsql security definer set search_path=''
as $wallet$
declare caller uuid:=(select auth.uid());ch public.characters%rowtype;
 coin public.terravale_currency_denominations%rowtype;
 old_quantity bigint:=0;new_quantity bigint;event_id uuid;
begin
 if caller is null or not exists(select 1 from auth.identities
   where user_id=caller and provider='discord')
 then raise exception 'Verified Discord required' using errcode='28000'; end if;
 select * into ch from public.characters where id=target_character;
 if ch.id is null or not authz.is_dm(ch.campaign_id)
 then raise exception 'Only the campaign DM may issue or remove currency' using errcode='42501'; end if;
 if delta_quantity is null or delta_quantity=0 or abs(delta_quantity)>1000000
 then raise exception 'Use a nonzero amount between 1 and 1,000,000 coins' using errcode='22023'; end if;
 select * into coin from public.terravale_currency_denominations
 where id=target_denomination and enabled;
 if coin.id is null then raise exception 'Unknown currency denomination' using errcode='22023'; end if;
 -- Lock an actual wallet row, even when the balance started at zero.
 insert into public.terravale_character_wallet(character_id,denomination_id,quantity)
 values(ch.id,coin.id,0) on conflict do nothing;
 select quantity into old_quantity from public.terravale_character_wallet
 where character_id=ch.id and denomination_id=coin.id for update;
 new_quantity:=old_quantity+delta_quantity;
 if new_quantity<0 or new_quantity>1000000000
 then raise exception 'Wallet cannot have negative or excessive holdings' using errcode='22023';end if;
 update public.terravale_character_wallet set quantity=new_quantity,updated_at=now()
 where character_id=ch.id and denomination_id=coin.id;
 insert into public.terravale_wallet_ledger(
 character_id,actor_user_id,denomination_id,delta,balance_after,
 rate_gc_snapshot,operation,note)
 values(ch.id,caller,coin.id,delta_quantity,new_quantity,coin.gc_value,
 case when delta_quantity>0 then 'dm_issue' else 'dm_remove' end,
 left(coalesce(purpose,''),240))
 returning id into event_id;
 return jsonb_build_object('success',true,'character_id',ch.id,
  'denomination_id',coin.id,'quantity',new_quantity,'change',delta_quantity,
  'rate_gc',coin.gc_value,'ledger_id',event_id);
end;
$wallet$;
revoke all on function public.terravale_wallet_adjust(uuid,text,integer,text) from public,anon;
grant execute on function public.terravale_wallet_adjust(uuid,text,integer,text) to authenticated;

create or replace function public.terravale_wallet_transfer(
 source_character uuid,recipient_character uuid,target_denomination text,
 transfer_quantity integer
) returns jsonb
language plpgsql security definer set search_path=''
as $transfer$
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
   (src.owner_id=caller and authz.is_member(src.campaign_id))
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
$transfer$;
revoke all on function public.terravale_wallet_transfer(uuid,uuid,text,integer) from public,anon;
grant execute on function public.terravale_wallet_transfer(uuid,uuid,text,integer) to authenticated;
