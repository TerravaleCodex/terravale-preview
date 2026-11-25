-- V2.99 proposed spellbook persistence foundation. NOT deployed.
-- Separate from approved_build.character, which ordinary sheet saves replace.
-- No direct authenticated writes; future audited RPCs must validate pinned rules,
-- exact edition catalogue, class/subclass, level, grants, and replacement budget.
begin;
create table if not exists public.terravale_spellbook_records (
 character_id uuid primary key references public.characters(id) on delete cascade,
 revision integer not null default 0 check(revision>=0),
 rules_revision text not null check(length(rules_revision) between 1 and 120),
 approved_class text not null check(length(approved_class) between 1 and 120),
 approved_level integer not null check(approved_level between 1 and 20),
 learned jsonb not null default '[]'::jsonb check(jsonb_typeof(learned)='array'),
 prepared jsonb not null default '[]'::jsonb check(jsonb_typeof(prepared)='array'),
 grants jsonb not null default '[]'::jsonb check(jsonb_typeof(grants)='array'),
 updated_at timestamptz not null default now()
);
alter table public.terravale_spellbook_records enable row level security;
revoke all on public.terravale_spellbook_records from public,anon,authenticated;
grant select on public.terravale_spellbook_records to authenticated;
create policy tv299_spellbook_read on public.terravale_spellbook_records
 for select to authenticated using (
 exists(select 1 from public.characters c
 where c.id=terravale_spellbook_records.character_id and c.status='approved'
 and authz.is_member(c.campaign_id)
 and (c.owner_id=(select auth.uid()) or authz.is_dm(c.campaign_id) or c.sheet_visible_to_party))
 );
-- Proposal storage is private to owner and campaign DM. It is not a grant.
create table if not exists public.terravale_spellbook_proposals (
 id uuid primary key default gen_random_uuid(),
 character_id uuid not null references public.characters(id) on delete cascade,
 requester_id uuid not null,
 expected_revision integer not null check(expected_revision>=0),
 approved_level integer not null check(approved_level between 1 and 20),
 kind text not null check(kind in ('initial','advancement','research')),
 choices jsonb not null check(jsonb_typeof(choices)='object' and pg_column_size(choices)<=32768),
 status text not null default 'pending' check(status in ('pending','approved','rejected','superseded')),
 created_at timestamptz not null default now()
);
create unique index if not exists tv299_one_pending_spell_proposal
 on public.terravale_spellbook_proposals(character_id) where status='pending';
alter table public.terravale_spellbook_proposals enable row level security;
revoke all on public.terravale_spellbook_proposals from public,anon,authenticated;
grant select on public.terravale_spellbook_proposals to authenticated;
create policy tv299_spell_proposal_read on public.terravale_spellbook_proposals
 for select to authenticated using (
 exists(select 1 from public.characters c where c.id=terravale_spellbook_proposals.character_id
 and authz.is_member(c.campaign_id)
 and ((c.owner_id=(select auth.uid()) and requester_id=(select auth.uid())) or authz.is_dm(c.campaign_id)))
 );
commit;
