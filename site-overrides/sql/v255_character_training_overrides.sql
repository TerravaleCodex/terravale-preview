-- Terravale V2.55: per-character exceptions to inherited/class training.
-- Source grants remain available for auditing and can be restored.
create table if not exists public.terravale_character_training_overrides(
 character_id uuid primary key references public.characters(id) on delete cascade,
 hidden_tools text[] not null default '{}',
 hidden_languages text[] not null default '{}',
 extra_tools text[] not null default '{}',
 extra_languages text[] not null default '{}',
 language_modes jsonb not null default '{}'::jsonb,
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now()
);
alter table public.terravale_character_training_overrides enable row level security;
revoke all on public.terravale_character_training_overrides from anon,authenticated;
grant select on public.terravale_character_training_overrides to authenticated;
drop policy if exists tv55_training_owner_dm_read on public.terravale_character_training_overrides;
create policy tv55_training_owner_dm_read on public.terravale_character_training_overrides
 for select to authenticated using(
 exists(select 1 from public.characters c where c.id=character_id
 and(c.owner_id=(select auth.uid()) or authz.is_dm(c.campaign_id)))
);

create table if not exists public.terravale_character_training_audit(
 id uuid primary key default gen_random_uuid(),
 character_id uuid not null references public.characters(id) on delete cascade,
 actor_user_id uuid not null references auth.users(id),
 training_kind text not null,
 proficiency_id text not null,
 operation text not null,
 modes text[] not null default '{}',
 created_at timestamptz not null default now()
);
create index if not exists tv55_training_audit_character
 on public.terravale_character_training_audit(character_id,created_at desc);
alter table public.terravale_character_training_audit enable row level security;
revoke all on public.terravale_character_training_audit from anon,authenticated;
grant select on public.terravale_character_training_audit to authenticated;
drop policy if exists tv55_training_audit_read on public.terravale_character_training_audit;
create policy tv55_training_audit_read on public.terravale_character_training_audit
 for select to authenticated using(exists(select 1 from public.characters c where c.id=character_id
 and(c.owner_id=(select auth.uid()) or authz.is_dm(c.campaign_id))));

create or replace function public.terravale_dm_set_character_training(
 target_character uuid,training_kind text,proficiency_id text,
 operation text,selected_modes text[] default '{}'
) returns jsonb language plpgsql security definer set search_path=''
as $tv55training$
declare caller uuid:=(select auth.uid());ch public.characters%rowtype;
 record_ public.terravale_character_training_overrides%rowtype;
 valid_modes text[]; tid text:=lower(trim(coalesce(proficiency_id,'')));
begin
 if caller is null or not exists(select 1 from auth.identities
  where user_id=caller and provider='discord') then
  raise exception 'Verified Discord required' using errcode='28000';end if;
 select * into ch from public.characters where id=target_character;
 if ch.id is null or not authz.is_dm(ch.campaign_id) then
  raise exception 'Only the campaign DM may adjust character training' using errcode='42501';end if;
 if training_kind not in('tool','language') or operation not in('grant','hide','restore','set_modes')
  or tid !~ '^[a-z0-9][a-z0-9-]{1,79}$' then
  raise exception 'Unsupported proficiency or change request' using errcode='22023';end if;
 if operation in('grant','set_modes') and not exists(
   select 1 from public.terravale_proficiency_catalog p
   where p.kind=training_kind and p.id=tid and p.enabled) then
   raise exception 'Select an active, known proficiency' using errcode='22023';end if;
 if operation='set_modes' then
  if training_kind<>'language' or coalesce(array_length(selected_modes,1),0) not between 1 and 3
   or exists(select 1 from unnest(selected_modes) m where m not in('speak','read','write'))
   or (select count(distinct m) from unnest(selected_modes)m)<>array_length(selected_modes,1)
  then raise exception 'Choose one or more distinct language abilities: speak, read, write' using errcode='22023';end if;
 end if;
 insert into public.terravale_character_training_overrides(character_id)
 values(ch.id) on conflict do nothing;
 select * into record_ from public.terravale_character_training_overrides
  where character_id=ch.id for update;
 if training_kind='language' then
  if operation='grant' then
   record_.extra_languages:=(select array(select distinct unnest(record_.extra_languages||array[tid])));
   record_.hidden_languages:=array_remove(record_.hidden_languages,tid);
  elsif operation='hide' then
   record_.hidden_languages:=(select array(select distinct unnest(record_.hidden_languages||array[tid])));
  elsif operation='restore' then
   record_.hidden_languages:=array_remove(record_.hidden_languages,tid);
  elsif operation='set_modes' then
   record_.language_modes:=jsonb_set(record_.language_modes,array[tid],to_jsonb(selected_modes),true);
  end if;
 else
  if operation='grant' then
   record_.extra_tools:=(select array(select distinct unnest(record_.extra_tools||array[tid])));
   record_.hidden_tools:=array_remove(record_.hidden_tools,tid);
  elsif operation='hide' then
   record_.hidden_tools:=(select array(select distinct unnest(record_.hidden_tools||array[tid])));
  elsif operation='restore' then
   record_.hidden_tools:=array_remove(record_.hidden_tools,tid);
  end if;
  if operation='set_modes' then raise exception 'Only languages have spoken/written modes' using errcode='22023';end if;
 end if;
 update public.terravale_character_training_overrides set
  hidden_tools=record_.hidden_tools,hidden_languages=record_.hidden_languages,
  extra_tools=record_.extra_tools,extra_languages=record_.extra_languages,
  language_modes=record_.language_modes,updated_by=caller,updated_at=now()
  where character_id=ch.id;
 insert into public.terravale_character_training_audit(
 character_id,actor_user_id,training_kind,proficiency_id,operation,modes)
 values(ch.id,caller,training_kind,tid,operation,
  case when operation='set_modes' then selected_modes else '{}'::text[] end);
 return jsonb_build_object('updated',true,'character_id',ch.id,'kind',training_kind,
  'proficiency_id',tid,'operation',operation,'hidden_tools',record_.hidden_tools,
  'hidden_languages',record_.hidden_languages,'language_modes',record_.language_modes);
end;
$tv55training$;
revoke all on function public.terravale_dm_set_character_training(uuid,text,text,text,text[]) from public,anon;
grant execute on function public.terravale_dm_set_character_training(uuid,text,text,text,text[]) to authenticated;
