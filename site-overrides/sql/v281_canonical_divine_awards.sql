-- V2.81: canonical Archive 2 boon awards and status/resource tracking.
-- Source text stays in terravale_divine_archive_entries and is only revealed
-- by owner/DM after a grant. No raw source is published to the browser.
create table if not exists public.terravale_divine_canon_awards(
 id uuid primary key default gen_random_uuid(),
 character_id uuid not null references public.characters(id) on delete cascade,
 entry_id uuid not null references public.terravale_divine_archive_entries(id),
 slot text not null check(slot in ('passive','reaction','major','grace','intercession','revision','unwritten')),
 chosen_ability text check(chosen_ability is null or chosen_ability in('int','wis','cha')),
 max_uses smallint check(max_uses is null or max_uses between 1 and 99),
 uses_remaining smallint check(uses_remaining is null or uses_remaining between 0 and 99),
 recovery text not null default 'manual' check(recovery in('none','short','long','seven_days','manual')),
 next_available_at timestamptz,
 status text not null default 'active' check(status in ('active','dormant','revoked')),
 granted_by uuid not null references auth.users(id),
 granted_at timestamptz not null default now(),
 reason text not null default '',
 revoked_at timestamptz,
 revoked_by uuid references auth.users(id),
 update_at timestamptz not null default now()
);
create unique index if not exists tv281_unique_current_award
 on public.terravale_divine_canon_awards(character_id,entry_id)
 where status in ('active','dormant');
create index if not exists tv281_awards_character
 on public.terravale_divine_canon_awards(character_id,status);
alter table public.terravale_divine_canon_awards enable row level security;
revoke all on public.terravale_divine_canon_awards from public,anon,authenticated;

create table if not exists public.terravale_divine_canon_state(
 character_id uuid primary key references public.characters(id) on delete cascade,
 entanglement smallint not null default 0 check(entanglement between 0 and 5),
 divine_pressure integer not null default 0 check(divine_pressure between 0 and 100000),
 minor_intercession_remaining smallint not null default 1 check(minor_intercession_remaining in(0,1)),
 updated_at timestamptz not null default now()
);
alter table public.terravale_divine_canon_state enable row level security;
revoke all on public.terravale_divine_canon_state from public,anon,authenticated;

create table if not exists public.terravale_divine_canon_burdens(
 character_id uuid not null references public.characters(id) on delete cascade,
 patron_key text not null check(char_length(patron_key) between 2 and 80),
 burden_name text not null check(char_length(burden_name) between 2 and 80),
 stacks smallint not null default 0 check(stacks between 0 and 3),
 overflow_pending boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(character_id,patron_key)
);
alter table public.terravale_divine_canon_burdens enable row level security;
revoke all on public.terravale_divine_canon_burdens from public,anon,authenticated;

create table if not exists public.terravale_divine_canon_effects(
 character_id uuid not null references public.characters(id) on delete cascade,
 effect_key text not null check(effect_key in('Drunk','Blackout','Rapture','Scorched','Blackout Sign')),
 stacks integer not null default 1 check(stacks between 0 and 99),
 note text not null default '',
 updated_at timestamptz not null default now(),
 primary key(character_id,effect_key)
);
alter table public.terravale_divine_canon_effects enable row level security;
revoke all on public.terravale_divine_canon_effects from public,anon,authenticated;

create table if not exists public.terravale_divine_canon_fractures(
 id uuid primary key default gen_random_uuid(),
 character_id uuid not null references public.characters(id) on delete cascade,
 award_id uuid references public.terravale_divine_canon_awards(id),
 chain text not null check(chain in('Mercy','Justice','Oblivion')),
 consequence text not null check(char_length(consequence) between 1 and 1500),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 resolved_at timestamptz,
 resolution text
);
create unique index if not exists tv281_one_fracture_per_chain
 on public.terravale_divine_canon_fractures(character_id,chain) where resolved_at is null;
alter table public.terravale_divine_canon_fractures enable row level security;
revoke all on public.terravale_divine_canon_fractures from public,anon,authenticated;

create table if not exists public.terravale_divine_canon_history(
 id uuid primary key default gen_random_uuid(),
 character_id uuid not null references public.characters(id) on delete cascade,
 award_id uuid references public.terravale_divine_canon_awards(id),
 actor_id uuid not null references auth.users(id),
 action text not null check(length(action) between 2 and 80),
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists tv281_history_by_character
 on public.terravale_divine_canon_history(character_id,created_at desc);
alter table public.terravale_divine_canon_history enable row level security;
revoke all on public.terravale_divine_canon_history from public,anon,authenticated;

-- The only supported bearer of source rules is an explicit DM award.
create or replace function public.terravale_divine_canon_grant(
 target_character uuid,target_entry uuid,target_slot text default null,
 target_ability text default null,reason text default ''
) returns jsonb language plpgsql security definer set search_path=''
as $tv281_grant$
declare actor uuid:=(select auth.uid()); c public.characters%rowtype;
 e public.terravale_divine_archive_entries%rowtype; a uuid;
 state public.terravale_divine_canon_state%rowtype;
 lv integer; cap integer; count_awards integer; chosen_slot text;
 claimed_score integer; secondary_score integer; count_uses smallint; recovery_kind text;
 desired text; pname text; secondary text;
begin
 if actor is null or not exists(select 1 from auth.identities
    where user_id=actor and provider='discord') then
  raise exception 'Verified Discord required' using errcode='28000';end if;
 select * into c from public.characters where id=target_character for update;
 select * into e from public.terravale_divine_archive_entries where id=target_entry;
 if not found or c.id is null or e.campaign_id<>c.campaign_id
   or not authz.is_dm(c.campaign_id) then
  raise exception 'Campaign DM only' using errcode='42501';end if;
 if e.kind in('nyrha_revision','nyrha_state') and not exists (
    select 1 from public.terravale_divine_canon_offers o
    where o.character_id=c.id and o.entry_id=e.id and o.status in('accepted','fulfilled')
 ) then
  raise exception 'Nyrha Revisions require a fully disclosed Formal Offer and explicit player acceptance'
   using errcode='22023';end if;
 if e.kind not in ('divine','concordant','minor_grace','minor_intercession',
     'nyrha_revision','nyrha_state') then
  raise exception 'Tier 0 and Impossible Offers require their own formal story procedure, not an ordinary boon grant'
   using errcode='22023';end if;
 if exists(select 1 from public.terravale_divine_canon_awards
  where character_id=c.id and entry_id=e.id and status in('active','dormant'))
 then raise exception 'This boon is already held by the character' using errcode='23505';end if;
 insert into public.terravale_divine_canon_state(character_id)
 values(c.id) on conflict(character_id) do nothing;
 select * into state from public.terravale_divine_canon_state where character_id=c.id for update;
 lv:=case when coalesce(c.approved_build->>'level',c.approved_build->'character'->>'level','')~'^(?:[1-9]|1[0-9]|20)$'
 then coalesce(c.approved_build->>'level',c.approved_build->'character'->>'level')::integer else 1 end;
 chosen_slot:=lower(coalesce(target_slot,''));
 desired:=lower(coalesce(e.slot,''));
 pname:=lower(e.patron);secondary:=lower(coalesce(e.other_patron,''));
 if e.kind in('divine','concordant') then
  if e.required_favour is null or e.tier not between 1 and 5 then
   raise exception 'Conventional boon must have a verified tier and direct Favour threshold'
   using errcode='22023';end if;
  select f.score into claimed_score from public.terravale_divine_favour f
  join public.terravale_divine_patrons p on p.id=f.patron_id
  where f.character_id=c.id and p.campaign_id=c.campaign_id and lower(p.key_name)=pname limit 1;
  if coalesce(claimed_score,0)<e.required_favour then
   raise exception 'Direct Favour has not met this patron requirement'
    using errcode='22023';end if;
  if e.kind='concordant' then
   if secondary='' or e.required_favour_second is null then
    raise exception 'Concordant requires two verified patron thresholds' using errcode='22023';end if;
   select f.score into secondary_score from public.terravale_divine_favour f
   join public.terravale_divine_patrons p on p.id=f.patron_id
   where f.character_id=c.id and p.campaign_id=c.campaign_id and lower(p.key_name)=secondary limit 1;
   if coalesce(secondary_score,0)<e.required_favour_second then
    raise exception 'Second Concordant patron has insufficient direct Favour' using errcode='22023';end if;
   if exists(select 1 from public.terravale_divine_canon_awards x
     join public.terravale_divine_archive_entries z on z.id=x.entry_id
     where x.character_id=c.id and x.status='active' and z.kind='concordant')
   then raise exception 'Only one active Concordant is allowed' using errcode='22023';end if;
  end if;
  if chosen_slot not in('passive','reaction','major') then
   raise exception 'Choose Passive, Reaction, or Major. Unspecified source slots cannot be guessed'
    using errcode='22023';end if;
  if desired in('passive','reaction','major') and chosen_slot<>desired then
   raise exception 'Chosen slot disagrees with the original source' using errcode='22023';end if;
  if exists(select 1 from public.terravale_divine_canon_awards x
    join public.terravale_divine_archive_entries z on z.id=x.entry_id
    where x.character_id=c.id and x.status='active' and x.slot=chosen_slot
     and z.kind in('divine','concordant')
     and (lower(z.patron) in(pname,secondary) or lower(coalesce(z.other_patron,'')) in(pname,secondary)))
  then raise exception 'This patron already occupies that active Favour Slot' using errcode='22023';end if;
 elsif e.kind in('minor_grace','minor_intercession') then
  chosen_slot:=case e.kind when 'minor_grace' then 'grace' else 'intercession' end;
  if exists(select 1 from public.terravale_divine_canon_awards x
    join public.terravale_divine_archive_entries z on z.id=x.entry_id
    where x.character_id=c.id and x.status='active' and z.kind=e.kind)
  then raise exception 'Replace the existing held Minor Grace or Intercession first' using errcode='22023';end if;
  if coalesce(target_ability,'') not in('int','wis','cha') then
   raise exception 'Choose INT, WIS, or CHA as the Minor Boon Ability' using errcode='22023';end if;
 elsif e.kind like 'nyrha_%' then
  chosen_slot:=case e.kind when 'nyrha_revision' then 'revision' else 'unwritten' end;
  cap:=case when lv<=4 then 1 when lv<=8 then 2 when lv<=12 then 3 when lv<=16 then 4 else 5 end;
  if e.tier>state.entanglement or e.tier>cap then
   raise exception 'Nyrha Revision exceeds Entanglement or character-level Depth' using errcode='22023';end if;
  if e.kind='nyrha_state' and (state.entanglement<>5 or lv<17) then
   raise exception 'The Unwritten State requires Entanglement 5 and character level 17+' using errcode='22023';end if;
  if e.kind='nyrha_revision' then
   cap:=case when state.entanglement<1 then 0 when state.entanglement<3 then 1
      when state.entanglement<5 then 2 else 3 end;
   select count(*) into count_awards
   from public.terravale_divine_canon_awards x
    join public.terravale_divine_archive_entries z on z.id=x.entry_id
   where x.character_id=c.id and x.status='active' and z.kind='nyrha_revision';
   if count_awards>=cap then raise exception 'Entanglement grants no additional active Revision slots'
    using errcode='22023';end if;
  end if;
 end if;
 count_uses:=null;recovery_kind:='none';
 if e.kind='nyrha_revision' then count_uses:=1;recovery_kind:='long';end if;
 if e.kind='minor_intercession' then recovery_kind:='long';end if;
 if e.kind in('divine','concordant') then
  if coalesce(e.uses_text,'') ~* 'once per (long rest|day)' then
    count_uses:=1;recovery_kind:='long';
  elsif coalesce(e.uses_text,'') ~* 'once per short rest' then
    count_uses:=1;recovery_kind:='short';
  elsif coalesce(e.uses_text,'') ~* 'once per seven days' then
    count_uses:=1;recovery_kind:='seven_days';
  elsif coalesce(e.uses_text,'') ~* 'twice per long rest' then
    count_uses:=2;recovery_kind:='long';
  elsif coalesce(e.uses_text,'') ~* 'proficiency bonus per long rest' then
    count_uses:=2+((lv-1)/4);recovery_kind:='long';
  elsif coalesce(e.uses_text,'') ~* 'once per campaign arc' then
    count_uses:=1;recovery_kind:='manual';
  elsif coalesce(e.uses_text,'') ~* 'once per session' then
    count_uses:=1;recovery_kind:='manual';
  elsif e.uses_text is null and chosen_slot<>'passive' then
    -- A limited-use sentence in an otherwise descriptive source is still explicit.
    if e.source_excerpt ~* 'once per long rest' then
      count_uses:=1;recovery_kind:='long';
    elsif e.source_excerpt ~* 'once per short rest' then
      count_uses:=1;recovery_kind:='short';
    elsif e.source_excerpt ~* 'once per session' then
      count_uses:=1;recovery_kind:='manual';
    end if;
  end if;
 end if;
 insert into public.terravale_divine_canon_awards(
   character_id,entry_id,slot,chosen_ability,max_uses,uses_remaining,
   recovery,granted_by,reason
 ) values(c.id,e.id,chosen_slot,nullif(target_ability,''),count_uses,count_uses,
  recovery_kind,actor,left(coalesce(reason,''),500)) returning id into a;
 if e.kind='minor_intercession' then
  update public.terravale_divine_canon_state
   set minor_intercession_remaining=0,updated_at=now() where character_id=c.id;
 end if;
 insert into public.terravale_divine_canon_history(character_id,award_id,actor_id,action,details)
 values(c.id,a,actor,'grant',jsonb_build_object('kind',e.kind,'source',e.source_path,
 'slot',chosen_slot,'tier',e.tier));
 return jsonb_build_object('id',a,'granted',true,'slot',chosen_slot,
  'max_uses',count_uses,'recovery',recovery_kind);
end $tv281_grant$;
revoke all on function public.terravale_divine_canon_grant(uuid,uuid,text,text,text)
 from public,anon,authenticated;
grant execute on function public.terravale_divine_canon_grant(uuid,uuid,text,text,text) to authenticated;

create or replace function public.terravale_divine_canon_dm_set_relation(
 target_character uuid, new_entanglement smallint, reason text default ''
) returns jsonb language plpgsql security definer set search_path=''
as $tv281_relation$
declare actor uuid:=(select auth.uid());c public.characters%rowtype;prior integer;active_revisions integer;cap integer;
begin
 select * into c from public.characters where id=target_character for update;
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord')
  or c.id is null or not authz.is_dm(c.campaign_id) then
  raise exception 'Verified campaign DM only' using errcode='42501';end if;
 if new_entanglement is null or new_entanglement not between 0 and 5 then
  raise exception 'Entanglement must be 0–5' using errcode='22023';end if;
 insert into public.terravale_divine_canon_state(character_id) values(c.id)
  on conflict(character_id) do nothing;
 select entanglement into prior from public.terravale_divine_canon_state
 where character_id=c.id for update;
 cap:=case when new_entanglement<1 then 0 when new_entanglement<3 then 1
     when new_entanglement<5 then 2 else 3 end;
 select count(*) into active_revisions from public.terravale_divine_canon_awards a
 join public.terravale_divine_archive_entries e on e.id=a.entry_id
 where a.character_id=c.id and a.status='active' and e.kind='nyrha_revision';
 if active_revisions>cap then
  raise exception 'Make excess Revisions dormant before lowering Entanglement'
   using errcode='22023';end if;
 update public.terravale_divine_canon_state set entanglement=new_entanglement,
  updated_at=now() where character_id=c.id;
 insert into public.terravale_divine_canon_history(character_id,actor_id,action,details)
 values(c.id,actor,'set_entanglement',jsonb_build_object('from',prior,
   'to',new_entanglement,'note',left(coalesce(reason,''),500)));
 return jsonb_build_object('entanglement',new_entanglement);
end $tv281_relation$;
revoke all on function public.terravale_divine_canon_dm_set_relation(uuid,smallint,text)
 from public,anon,authenticated;
grant execute on function public.terravale_divine_canon_dm_set_relation(uuid,smallint,text) to authenticated;

create or replace function public.terravale_divine_canon_dm_adjust_burden(
 target_character uuid, patron text, delta smallint, reason text default ''
) returns jsonb language plpgsql security definer set search_path=''
as $tv281_burden$
declare actor uuid:=(select auth.uid());c public.characters%rowtype;key text;label text;old_value integer;new_value integer;
begin
 select * into c from public.characters where id=target_character for update;
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord')
  or c.id is null or not authz.is_dm(c.campaign_id) then
  raise exception 'Verified campaign DM only' using errcode='42501';end if;
 key:=lower(trim(patron));
 label:=case key
  when 'amora' then 'Entanglement' when 'coeus' then 'Unverified Insight'
  when 'errigan' then 'Revel' when 'eshael' then 'Charge'
  when 'fjoras' then 'Road Debt' when 'ixi' then 'Burned'
  when 'kalma' then 'Held Names' when 'kwaeth' then 'Loose Threads'
  when 'luna' then 'Moonwake' when 'pae' then 'Solar Saturation'
  when 'rao' then 'Unsettled Accord' when 'torridae' then 'Battle Reckoning'
  when 'tyrius' then 'Wake Debt' when 'vaelniv' then 'Balance Debt'
  else null end;
 if label is null or delta is null or delta not between -3 and 3 or delta=0 then
  raise exception 'Use a valid conventional Burden and delta −3 to +3' using errcode='22023';end if;
 insert into public.terravale_divine_canon_burdens(character_id,patron_key,burden_name)
 values(c.id,key,label) on conflict(character_id,patron_key) do nothing;
 select stacks into old_value from public.terravale_divine_canon_burdens
 where character_id=c.id and patron_key=key for update;
 new_value:=old_value+delta;
 if new_value not between 0 and 3 then
  raise exception 'Burden would exceed its permitted 0–3 range; overflow requires a specific event'
   using errcode='22023';end if;
 update public.terravale_divine_canon_burdens
  set stacks=new_value,overflow_pending=case when new_value<3 then false else overflow_pending end,
  updated_at=now()
 where character_id=c.id and patron_key=key;
 insert into public.terravale_divine_canon_history(character_id,actor_id,action,details)
 values(c.id,actor,'burden_adjust',jsonb_build_object('patron',key,'from',old_value,
  'to',new_value,'reason',left(coalesce(reason,''),500)));
 return jsonb_build_object('patron',key,'burden_name',label,'stacks',new_value);
end $tv281_burden$;
revoke all on function public.terravale_divine_canon_dm_adjust_burden(uuid,text,smallint,text)
 from public,anon,authenticated;
grant execute on function public.terravale_divine_canon_dm_adjust_burden(uuid,text,smallint,text) to authenticated;

-- Exact source after DM grant only; all unawarded source stays secret.
create or replace function public.terravale_divine_canon_player_state(
 target_character uuid
) returns jsonb language plpgsql stable security definer set search_path=''
as $tv281_player$
declare actor uuid:=(select auth.uid());c public.characters%rowtype;allowed boolean;payload jsonb;
begin
 select * into c from public.characters where id=target_character;
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord')
  or c.id is null or not authz.is_member(c.campaign_id) then
  raise exception 'Verified campaign membership required' using errcode='42501';end if;
 allowed:=c.owner_id=actor or authz.is_dm(c.campaign_id);
 if not allowed and not(c.status='approved' and coalesce(c.sheet_visible_to_party,false)) then
  raise exception 'Character not shared' using errcode='42501';end if;
 select jsonb_build_object(
  'granted',case when allowed then coalesce((
   select jsonb_agg(jsonb_build_object(
    'id',a.id,'name',e.name,'kind',e.kind,'summary',e.source_heading,
    'mechanics',e.source_excerpt,'patron',e.patron,'other_patron',e.other_patron,
    'slot',a.slot,'tier',e.tier,'chosen_ability',a.chosen_ability,
    'max_charges',a.max_uses,'charges_remaining',a.uses_remaining,
    'recovery',a.recovery,'available_at',a.next_available_at,
    'source_kind','canonical','grant_status',a.status
   ) order by a.granted_at)
   from public.terravale_divine_canon_awards a
   join public.terravale_divine_archive_entries e on e.id=a.entry_id
   where a.character_id=c.id and a.status='active'
  ),'[]'::jsonb) else '[]'::jsonb end,
  'divine_state',case when allowed then coalesce((
   select jsonb_build_object('entanglement',s.entanglement,
    'divine_pressure',s.divine_pressure,
    'minor_intercession_remaining',s.minor_intercession_remaining)
   from public.terravale_divine_canon_state s where s.character_id=c.id
  ),jsonb_build_object('entanglement',0,'divine_pressure',0,
   'minor_intercession_remaining',1)) else '{}'::jsonb end,
  'burdens',case when allowed then coalesce((
   select jsonb_agg(jsonb_build_object(
    'patron',b.patron_key,'name',b.burden_name,'stacks',b.stacks,
    'overflow_pending',b.overflow_pending) order by b.patron_key)
   from public.terravale_divine_canon_burdens b where b.character_id=c.id
    and (b.stacks>0 or b.overflow_pending)
  ),'[]'::jsonb) else '[]'::jsonb end,
  'statuses',case when allowed then coalesce((
   select jsonb_agg(jsonb_build_object('key',x.effect_key,
    'stacks',x.stacks,'note',x.note) order by x.effect_key)
   from public.terravale_divine_canon_effects x where x.character_id=c.id and x.stacks>0
  ),'[]'::jsonb) else '[]'::jsonb end,
  'fractures',case when allowed then coalesce((
   select jsonb_agg(jsonb_build_object('id',f.id,'chain',f.chain,
    'consequence',f.consequence,'award_id',f.award_id) order by f.created_at)
   from public.terravale_divine_canon_fractures f
   where f.character_id=c.id and f.resolved_at is null
  ),'[]'::jsonb) else '[]'::jsonb end
 ) into payload;
 return payload;
end $tv281_player$;
revoke all on function public.terravale_divine_canon_player_state(uuid)
 from public,anon,authenticated;
grant execute on function public.terravale_divine_canon_player_state(uuid) to authenticated;

create or replace function public.terravale_divine_canon_revoke(
 target_award uuid, reason text default ''
) returns jsonb language plpgsql security definer set search_path=''
as $tv281_revoke$
declare actor uuid:=(select auth.uid());a public.terravale_divine_canon_awards%rowtype;c public.characters%rowtype;
begin
 select * into a from public.terravale_divine_canon_awards where id=target_award for update;
 select * into c from public.characters where id=a.character_id;
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord')
 or a.id is null or c.id is null or not authz.is_dm(c.campaign_id) then
  raise exception 'Verified campaign DM only' using errcode='42501';end if;
 if a.status='revoked' then return jsonb_build_object('id',a.id,'revoked',true,'already_revoked',true);end if;
 update public.terravale_divine_canon_awards
 set status='revoked',revoked_at=now(),revoked_by=actor,update_at=now()
 where id=a.id;
 insert into public.terravale_divine_canon_history(character_id,award_id,actor_id,action,details)
 values(c.id,a.id,actor,'revoke',jsonb_build_object('reason',left(coalesce(reason,''),500)));
 return jsonb_build_object('id',a.id,'revoked',true);
end $tv281_revoke$;
revoke all on function public.terravale_divine_canon_revoke(uuid,text) from public,anon,authenticated;
grant execute on function public.terravale_divine_canon_revoke(uuid,text) to authenticated;
