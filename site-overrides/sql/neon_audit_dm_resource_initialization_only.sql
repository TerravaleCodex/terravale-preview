-- AUDIT ONLY. NEVER INSTALL ON NEON STAGING, NEON MAIN OR SUPABASE PRODUCTION.
-- Runs on disposable Neon child br-rapid-haze-bglxt1nu, with four named synthetic
-- characters only. No write access or UI action is enabled for real players.
-- DM confirmation explicitly chooses the CURRENT remaining count; an unsaved
-- pool is NEVER silently set to its derived maximum.
CREATE TABLE terravale_internal.neon_resource_initializations_audit (
 character_id uuid NOT NULL REFERENCES
   terravale_internal.neon_resource_authority_audit(character_id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 actor_id uuid NOT NULL,
 resource_id text NOT NULL,
 expected_version integer NOT NULL,
 initial_remaining integer NOT NULL,
 approved_max integer NOT NULL,
 source_basis text NOT NULL CHECK(source_basis IN ('player_confirmed','dm_session_record')),
 resulting_version integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(character_id,request_id),
 UNIQUE(character_id,resource_id)
);
-- AUDIT STATEMENT
REVOKE ALL ON terravale_internal.neon_resource_initializations_audit
 FROM PUBLIC,anonymous,authenticated;
-- AUDIT STATEMENT
CREATE OR REPLACE FUNCTION public.terravale_neon_audit_resource_initialize(
 p_character uuid,p_resource text,p_expected_version integer,
 p_initial_remaining integer,p_request_id uuid,p_basis text,
 p_confirmation text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $initialize$
DECLARE
 actor uuid := (SELECT auth.uid());
 picked public.characters%ROWTYPE;
 canonical terravale_internal.neon_resource_authority_audit%ROWTYPE;
 prior terravale_internal.neon_resource_initializations_audit%ROWTYPE;
 limit_count integer;
 cap integer;
 next_version integer;
 next_state jsonb;
 linked_build jsonb;
BEGIN
 IF actor IS NULL THEN
  RAISE EXCEPTION 'Verified Discord account required' USING errcode='28000';
 END IF;
 IF p_character IS NULL OR p_resource IS NULL OR p_expected_version IS NULL
   OR p_initial_remaining IS NULL OR p_request_id IS NULL
   OR p_basis NOT IN ('player_confirmed','dm_session_record')
   OR p_confirmation IS DISTINCT FROM 'confirmed_current_remaining_not_derived'
   OR p_expected_version<0 OR p_expected_version>999999
   OR p_initial_remaining<0 OR p_initial_remaining>20
   OR length(p_resource) NOT BETWEEN 1 AND 100
   OR p_character NOT IN (
     '11111111-1111-4111-8111-999999999991'::uuid,
     '11111111-1111-4111-8111-999999999992'::uuid,
     '11111111-1111-4111-8111-999999999993'::uuid,
     '11111111-1111-4111-8111-999999999994'::uuid
   ) THEN
  RAISE EXCEPTION 'Invalid synthetic DM resource confirmation' USING errcode='22023';
 END IF;
 -- Lock-order matches the existing narrow spend action.
 SELECT * INTO picked FROM public.characters c
  WHERE c.id=p_character AND c.name LIKE 'Neon resource audit %'
    AND c.status='approved'
  FOR UPDATE;
 IF NOT FOUND
   OR NOT authz.is_member(picked.campaign_id)
   OR NOT authz.is_dm(picked.campaign_id) THEN
  RAISE EXCEPTION 'Only the verified campaign/site DM may confirm resource use'
    USING errcode='42501';
 END IF;
 SELECT * INTO canonical
 FROM terravale_internal.neon_resource_authority_audit a
 WHERE a.character_id=p_character FOR UPDATE;
 IF NOT FOUND
   OR canonical.ruleset_version<>'native-v287-reviewed-fixed-and-base-spells'
   OR picked.approved_build#>'{character,sheetV220,resources}'
         IS DISTINCT FROM canonical.resource_values
   OR picked.approved_build#>>'{character,sheetV220,resourceRevision}'
         IS DISTINCT FROM canonical.version::text THEN
  RAISE EXCEPTION 'Character resource state differs from private authority; reload'
    USING errcode='40001';
 END IF;
 SELECT * INTO prior
 FROM terravale_internal.neon_resource_initializations_audit i
 WHERE i.character_id=p_character AND i.request_id=p_request_id;
 IF FOUND THEN
  IF prior.actor_id IS DISTINCT FROM actor
     OR prior.resource_id IS DISTINCT FROM p_resource
     OR prior.expected_version IS DISTINCT FROM p_expected_version
     OR prior.initial_remaining IS DISTINCT FROM p_initial_remaining
     OR prior.source_basis IS DISTINCT FROM p_basis THEN
    RAISE EXCEPTION 'Confirmation operation UUID reused with different data'
      USING errcode='42501';
  END IF;
  RETURN jsonb_build_object(
    'resource_id',prior.resource_id,'remaining',prior.initial_remaining,
    'max',prior.approved_max,'version',prior.resulting_version,
    'replayed',true,'requires_refresh',
       prior.resulting_version IS DISTINCT FROM canonical.version);
 END IF;
 -- An old spend request UUID cannot silently double as an initialization UUID.
 IF EXISTS(SELECT 1
   FROM terravale_internal.neon_resource_spend_events_audit e
   WHERE e.character_id=p_character AND e.request_id=p_request_id) THEN
  RAISE EXCEPTION 'Operation UUID was already used for spending' USING errcode='42501';
 END IF;
 IF canonical.version IS DISTINCT FROM p_expected_version THEN
  RAISE EXCEPTION 'Resource version conflict; reload before DM confirmation'
    USING errcode='40001';
 END IF;
 IF picked.approved_build->>'class'
      IS DISTINCT FROM picked.approved_build#>>'{character,className}'
    OR picked.approved_build->>'level'
      IS DISTINCT FROM picked.approved_build#>>'{character,level}'
    OR picked.approved_build#>>'{character,level}' !~ '^(?:[1-9]|1[0-9]|20)$' THEN
  RAISE EXCEPTION 'Unapproved class/level mismatch' USING errcode='42501';
 END IF;
 SELECT count(*)::integer,min(r.max_uses)
 INTO limit_count,cap
 FROM terravale_internal.neon_resource_rules_audit r
 WHERE r.source_revision IN
   ('native-v287-v220-verified','native-v287-v234-spells-verified')
   AND r.class_name=picked.approved_build->>'class'
   AND r.character_level=(picked.approved_build->>'level')::integer
   AND r.resource_id=p_resource
   AND r.recovery='manual-review';
 IF limit_count<>1 OR cap IS NULL THEN
  RAISE EXCEPTION 'Resource not covered by one reviewed class/level limit'
    USING errcode='42501';
 END IF;
 IF p_initial_remaining>cap THEN
  RAISE EXCEPTION 'DM-confirmed count exceeds server-reviewed maximum'
    USING errcode='22023';
 END IF;
 -- Crucial: only a MISSING key can be confirmed; present 0 is NOT missing.
 IF canonical.resource_values ? p_resource THEN
  RAISE EXCEPTION 'Resource already has a saved count; no implicit reset'
    USING errcode='23505';
 END IF;
 next_version:=canonical.version+1;
 next_state:=jsonb_set(canonical.resource_values,ARRAY[p_resource],
   to_jsonb(p_initial_remaining),true);
 UPDATE terravale_internal.neon_resource_authority_audit
 SET version=next_version,resource_values=next_state
 WHERE character_id=p_character;
 linked_build:=jsonb_set(
   jsonb_set(picked.approved_build,
     '{character,sheetV220,resources}',next_state,false),
   '{character,sheetV220,resourceRevision}',
     to_jsonb(next_version),true);
 UPDATE public.characters SET approved_build=linked_build WHERE id=p_character;
 INSERT INTO terravale_internal.neon_resource_initializations_audit(
   character_id,request_id,actor_id,resource_id,expected_version,
   initial_remaining,approved_max,source_basis,resulting_version)
 VALUES(p_character,p_request_id,actor,p_resource,p_expected_version,
   p_initial_remaining,cap,p_basis,next_version);
 RETURN jsonb_build_object('resource_id',p_resource,
   'remaining',p_initial_remaining,'max',cap,'version',next_version,
   'replayed',false,'requires_refresh',false);
END
$initialize$;
-- AUDIT STATEMENT
REVOKE ALL ON FUNCTION public.terravale_neon_audit_resource_initialize(
 uuid,text,integer,integer,uuid,text,text)
 FROM PUBLIC,anonymous,authenticated;
-- AUDIT STATEMENT
GRANT EXECUTE ON FUNCTION public.terravale_neon_audit_resource_initialize(
 uuid,text,integer,integer,uuid,text,text) TO authenticated;
