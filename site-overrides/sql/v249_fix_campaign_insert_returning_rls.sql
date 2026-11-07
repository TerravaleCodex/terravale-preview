-- V2.49 hotfix (applied in live Supabase on 2026-11-07).
-- Why: .insert(...).select(...).single() performs INSERT ... RETURNING.
-- The original read policy used authz.is_member(id) exclusively. That STABLE
-- function consults the campaigns table under the statement snapshot, where
-- a newly inserted campaign cannot yet be seen. Thus the DM-only INSERT succeeds
-- but RETURNING fails with a 'new row violates row-level security policy'.
--
-- Keep site-DM-only creation, campaign ownership and demo opt-out intact.
-- This change touches the SELECT policy only.
drop policy if exists campaign_read on public.campaigns;
create policy campaign_read on public.campaigns for select to authenticated
using (
  authz.is_member(id)
  or (
    owner_id = (select auth.uid())
    and not exists (
      select 1 from public.terravale_demo_departures d
      where d.campaign_id = id
        and d.user_id = (select auth.uid())
    )
  )
);
-- Live verification (transaction rolled back):
--   1. Authenticated DM's INSERT ... RETURNING returns row and owner matches.
--   2. Authenticated non-DM INSERT is denied by unchanged campaign_create RLS.
--   3. No test campaigns were persisted.
