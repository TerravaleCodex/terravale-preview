-- Terravale / Neon migration: STAGING READ-ONLY JWT + legacy owner audit.
-- This file documents the audited integration. DO NOT auto-run on production.
-- Requires: verified private source registry terravale_internal.migration_policy_source
-- and preserved Supabase identity references in auth.identities, with the
-- Neon Better Auth account schema provisioned on the target branch.
--
-- Neon Data API must be provisioned separately, with auth_provider=neon_auth,
-- add_default_grants=false, skip_auth_schema=true, db_schemas=['public'].
-- The Data API validates the incoming JWT and sets request.jwt.claims/ROLE.
-- NEVER expose a privileged PostgreSQL connection URL in the static website.
--
-- This bridge intentionally retains legacy owner UUIDs in existing foreign keys.
-- A provider-confirmed Discord account ID is required for mapping; names/emails
-- and client-provided user IDs are *never* trusted for authorization.
BEGIN;

DO $guard$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    RAISE EXCEPTION 'Neon Data API authenticated role not provisioned';
  END IF;
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity)<>60 THEN
    RAISE EXCEPTION 'Not all Terravale public tables are RLS protected';
  END IF;
  IF (SELECT count(*) FROM terravale_internal.migration_policy_source)<>65 THEN
    RAISE EXCEPTION 'Original 65 policy definitions are missing';
  END IF;
END $guard$;

CREATE OR REPLACE FUNCTION auth.neon_request_user_id()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO ''
AS $neon$
DECLARE jwt jsonb; sub text;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'authenticated' THEN RETURN NULL; END IF;
  jwt := nullif(current_setting('request.jwt.claims',true),'')::jsonb;
  IF jwt->>'role' IS DISTINCT FROM 'authenticated' THEN RETURN NULL; END IF;
  sub := jwt->>'sub';
  IF sub IS NULL OR sub !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RETURN NULL; END IF;
  RETURN sub::uuid;
EXCEPTION WHEN invalid_text_representation OR invalid_parameter_value THEN
  RETURN NULL;
END $neon$;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $neon$
  SELECT CASE WHEN count(DISTINCT original.user_id)=1
              THEN min(original.user_id::text)::uuid
              ELSE null::uuid END
  FROM neon_auth.account a
  JOIN neon_auth."user" u ON u.id=a."userId" AND u.banned IS NOT TRUE
  JOIN auth.identities original
    ON original.provider='discord' AND original.provider_id=a."accountId"
  WHERE a."providerId"='discord'
    AND a."userId"=auth.neon_request_user_id()
$neon$;

REVOKE ALL ON FUNCTION auth.neon_request_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.uid() FROM PUBLIC;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
GRANT USAGE ON SCHEMA authz TO authenticated;
GRANT EXECUTE ON FUNCTION authz.is_site_dm() TO authenticated;
GRANT EXECUTE ON FUNCTION authz.is_dm(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION authz.is_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION authz.can_manage_character(uuid) TO authenticated;

DO $policies$
DECLARE r record; roles_sql text; statement text; installed int:=0;
BEGIN
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public')<>0 THEN
    RAISE EXCEPTION 'Unexpected active policies: stop rather than overwrite';
  END IF;
  FOR r IN SELECT * FROM terravale_internal.migration_policy_source
     ORDER BY table_name,policy_name LOOP
    IF r.permissive NOT IN ('PERMISSIVE','RESTRICTIVE')
      OR r.command NOT IN ('SELECT','INSERT','UPDATE','DELETE','ALL')
      OR r.roles NOT IN ('{authenticated}','{anon,authenticated}',
                        '{authenticated,anon}','{anon}') THEN
      RAISE EXCEPTION 'Unexpected original RLS policy %.%',r.table_name,r.policy_name;
    END IF;
    roles_sql:=CASE WHEN r.roles='{authenticated}' THEN 'authenticated'
                    WHEN r.roles='{anon}' THEN 'anonymous'
                    ELSE 'anonymous,authenticated' END;
    statement:=format('CREATE POLICY %I ON public.%I AS %s FOR %s TO %s',
               r.policy_name,r.table_name,r.permissive,r.command,roles_sql);
    IF r.using_expression IS NOT NULL THEN
      statement:=statement||' USING ('||r.using_expression||')';
    END IF;
    IF r.check_expression IS NOT NULL THEN
      statement:=statement||' WITH CHECK ('||r.check_expression||')';
    END IF;
    EXECUTE statement;
    installed:=installed+1;
  END LOOP;
  IF installed<>65 THEN RAISE EXCEPTION 'Incomplete original policies: %',installed; END IF;
END $policies$;

-- Minimal RLS-controlled READ permissions for migration diagnostics, no writes.
GRANT SELECT ON public.characters,public.campaigns,public.campaign_members,
 public.character_state,public.terravale_demo_departures TO authenticated;

CREATE OR REPLACE FUNCTION public.terravale_neon_staging_probe()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO ''
AS $probe$
 SELECT jsonb_build_object(
  'identity_recognised',auth.uid() IS NOT NULL,
  'site_dm',authz.is_site_dm(),
  'owned_characters',(SELECT count(*)::int FROM public.characters ch WHERE ch.owner_id=auth.uid()),
  'visible_characters',(SELECT count(*)::int FROM public.characters),
  'visible_campaigns',(SELECT count(*)::int FROM public.campaigns),
  'visible_character_states',(SELECT count(*)::int FROM public.character_state)
 )
$probe$;
REVOKE ALL ON FUNCTION public.terravale_neon_staging_probe() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.terravale_neon_staging_probe() TO authenticated;

-- Test-only; do not cut over until real signed JWT requests and player/DM
-- isolation, all RPCs, storage, write controls and rollback have passed.
COMMIT;
