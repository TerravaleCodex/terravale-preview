-- PROPOSED: initial spell selection after character approval.
-- Depends on v299 and v300. No public execute grants until isolated DB tests pass.
-- Deliberately limited to base known casters, level one, with DM-pinned rules/editions.
begin;
create table public.terravale_spellbook_rule_pins (
 character_id uuid primary key references public.characters(id) on delete cascade,
 campaign_id uuid not null,
 owner_id uuid not null,
 class_name text not null check(class_name in ('Bard','Ranger','Sorcerer','Warlock')),
 rules_revision text not null check(rules_revision='tv300-base-known-v1'),
 editions text[] not null check(cardinality(editions) between 1 and 2 and editions <@ array['2014','2024']::text[] and array_position(editions,null) is null),
 approved_by uuid not null,
 approved_at timestamptz not null default now()
);
alter table public.terravale_spellbook_rule_pins enable row level security;
revoke all on public.terravale_spellbook_rule_pins from public,anon,authenticated;

create function public.terravale_validate_initial_known(
 p_class text,p_ids text[],p_editions text[]
) returns boolean language plpgsql stable set search_path='' as $f$
declare r public.terravale_spell_selection_rules%rowtype; k integer; c integer;
begin
 if p_ids is null or p_editions is null or cardinality(p_ids)>100
 or cardinality(p_editions)=0 or array_position(p_ids,null) is not null
 or array_position(p_editions,null) is not null then return false; end if;
 select * into r from public.terravale_spell_selection_rules where class_name=p_class and character_level=1;
 if not found then return false; end if;
 if exists(select 1 from unnest(p_ids) x(id) left join public.terravale_spell_selection_catalog s on s.id=x.id
 where s.id is null or not(s.classes ? p_class) or s.level>r.max_spell_level or not(s.edition=any(p_editions))) then return false; end if;
 if (select count(distinct s.identity) from unnest(p_ids) x(id) join public.terravale_spell_selection_catalog s on s.id=x.id)<>cardinality(p_ids) then return false; end if;
 select count(*) filter(where s.level>0),count(*) filter(where s.level=0) into k,c
 from unnest(p_ids) x(id) join public.terravale_spell_selection_catalog s on s.id=x.id;
 return k=r.known_limit and c=r.cantrip_limit;
end $f$;
revoke all on function public.terravale_validate_initial_known(text,text[],text[]) from public,anon,authenticated;

create function public.terravale_pin_initial_spell_rules(p_character uuid,p_editions text[])
 returns jsonb language plpgsql security definer set search_path='' as $f$
declare actor uuid:=(select auth.uid()); ch public.characters%rowtype; cl text;
begin
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord') then raise exception 'Verified account required' using errcode='28000'; end if;
 select * into ch from public.characters where id=p_character for update;
 if not found or not authz.is_member(ch.campaign_id) or not authz.is_dm(ch.campaign_id) then raise exception 'Campaign DM required' using errcode='42501'; end if;
 cl:=ch.approved_build->>'class';
 if ch.status is distinct from 'approved' or ch.owner_id is null or ch.approved_build->>'level' is distinct from '1'
 or cl is null or cl not in ('Bard','Ranger','Sorcerer','Warlock')
 or ch.approved_build#>>'{character,className}' is distinct from cl
 or ch.approved_build#>>'{character,level}' is distinct from '1'
 or p_editions is null or cardinality(p_editions) not between 1 and 2 or array_position(p_editions,null) is not null
 or not(p_editions <@ array['2014','2024']::text[]) then raise exception 'Unverified initial spell rules' using errcode='22023'; end if;
 insert into public.terravale_spellbook_rule_pins(character_id,campaign_id,owner_id,class_name,rules_revision,editions,approved_by)
 values(ch.id,ch.campaign_id,ch.owner_id,cl,'tv300-base-known-v1',p_editions,actor);
 return jsonb_build_object('pinned',true,'character_id',ch.id);
end $f$;
revoke all on function public.terravale_pin_initial_spell_rules(uuid,text[]) from public,anon,authenticated;

create function public.terravale_submit_initial_spells(p_character uuid,p_ids text[])
 returns jsonb language plpgsql security definer set search_path='' as $f$
declare actor uuid:=(select auth.uid()); ch public.characters%rowtype; pin public.terravale_spellbook_rule_pins%rowtype; out_id uuid;
begin
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord') then raise exception 'Verified account required' using errcode='28000'; end if;
 select * into ch from public.characters where id=p_character for update;
 if not found or ch.owner_id is distinct from actor or not authz.is_member(ch.campaign_id) then raise exception 'Character owner required' using errcode='42501'; end if;
 select * into pin from public.terravale_spellbook_rule_pins where character_id=ch.id;
 if not found or pin.owner_id is distinct from ch.owner_id or pin.campaign_id is distinct from ch.campaign_id
 or ch.status is distinct from 'approved' or ch.approved_build->>'level' is distinct from '1'
 or ch.approved_build->>'class' is distinct from pin.class_name
 or ch.approved_build#>>'{character,className}' is distinct from pin.class_name
 or ch.approved_build#>>'{character,level}' is distinct from '1'
 or exists(select 1 from public.terravale_spellbook_records where character_id=ch.id)
 then raise exception 'Initial spell selection unavailable' using errcode='22023'; end if;
 if not public.terravale_validate_initial_known(pin.class_name,p_ids,pin.editions) then raise exception 'Invalid initial choices' using errcode='22023'; end if;
 insert into public.terravale_spellbook_proposals(character_id,requester_id,expected_revision,approved_level,kind,choices)
 values(ch.id,actor,0,1,'initial',jsonb_build_object('learned',to_jsonb(p_ids),'rules_revision',pin.rules_revision))
 returning id into out_id;
 return jsonb_build_object('id',out_id,'status','pending');
end $f$;
revoke all on function public.terravale_submit_initial_spells(uuid,text[]) from public,anon,authenticated;
-- No execute grants: subclass/grant reconciliation, DM decision, tests outstanding.
commit;
