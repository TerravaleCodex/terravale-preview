-- Neon audit only. Campaign-owned spell policy; existing campaigns remain unconfigured.
begin;
create table public.terravale_campaign_spell_policy (
 campaign_id uuid primary key references public.campaigns(id) on delete cascade,
 ruleset text not null check(ruleset in ('2014','2024','tv5e','custom')),
 override_catalogues boolean not null default false,
 editions text[] not null,
 allow_codex boolean not null default false check(not allow_codex),
 revision integer not null default 1 check(revision>0),
 updated_at timestamptz not null default now(),
 check(array_position(editions,null) is null and editions <@ array['2014','2024']::text[] and cardinality(editions)<=2),
 check(override_catalogues or (ruleset='2014' and editions=array['2014']::text[]) or (ruleset='2024' and editions=array['2024']::text[]) or (ruleset='tv5e' and editions=array['2014','2024']::text[]))
);
alter table public.terravale_campaign_spell_policy enable row level security;
revoke all on public.terravale_campaign_spell_policy from public,anonymous,authenticated;
grant select on public.terravale_campaign_spell_policy to authenticated;
create policy tv_campaign_spell_read on public.terravale_campaign_spell_policy for select to authenticated using(authz.is_member(campaign_id) or authz.is_dm(campaign_id));
create function public.terravale_set_campaign_spell_policy(p_campaign uuid,p_ruleset text,p_override boolean,p_editions text[],p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $f$
declare actor uuid:=(select auth.uid()); old public.terravale_campaign_spell_policy%rowtype; chosen text[]; out_row public.terravale_campaign_spell_policy%rowtype;
begin
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord') then raise exception 'Verified account required' using errcode='28000'; end if;
 if authz.is_dm(p_campaign) is distinct from true then raise exception 'Campaign DM required' using errcode='42501'; end if;
 perform 1 from public.campaigns where id=p_campaign for update;
 if not found then raise exception 'Campaign unavailable' using errcode='22023'; end if;
 if p_ruleset is null or p_ruleset not in ('2014','2024','tv5e','custom') or p_override is null or (p_ruleset='custom' and not p_override) then raise exception 'Invalid ruleset' using errcode='22023'; end if;
 if p_override then
  if p_editions is null or array_position(p_editions,null) is not null or not(p_editions <@ array['2014','2024']::text[]) or cardinality(p_editions)>2 then raise exception 'Invalid catalogues' using errcode='22023'; end if;
  select array(select distinct e from unnest(p_editions) e order by e) into chosen;
 else chosen:=case p_ruleset when '2014' then array['2014'] when '2024' then array['2024'] else array['2014','2024'] end; end if;
 select * into old from public.terravale_campaign_spell_policy where campaign_id=p_campaign for update;
 if coalesce(old.revision,0) is distinct from p_expected_revision then raise exception 'Policy changed; reload' using errcode='40001'; end if;
 insert into public.terravale_campaign_spell_policy(campaign_id,ruleset,override_catalogues,editions,revision)
 values(p_campaign,p_ruleset,p_override,chosen,coalesce(old.revision,0)+1)
 on conflict(campaign_id) do update set ruleset=excluded.ruleset,override_catalogues=excluded.override_catalogues,editions=excluded.editions,revision=excluded.revision,updated_at=now()
 returning * into out_row;
 return to_jsonb(out_row);
end $f$;
revoke all on function public.terravale_set_campaign_spell_policy(uuid,text,boolean,text[],integer) from public,anonymous,authenticated;
-- No execute grant until authorization tests and existing spellbook pin reconciliation.
commit;
