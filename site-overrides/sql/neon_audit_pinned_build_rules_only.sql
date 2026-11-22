-- AUDIT ONLY. DO NOT APPLY TO NEON STAGING, NEON MAIN, SUPABASE,
-- OR REAL CHARACTERS. Disposable Neon child br-rapid-haze-bglxt1nu ONLY.
-- This protects FOUR explicitly named synthetic character fixtures.
-- First-person owner class/level assertions in JSON are not trusted as
-- server-authoritative: a verified campaign/site DM must pin the rules identity.
CREATE TABLE terravale_internal.neon_resource_build_approval_audit(
 character_id uuid PRIMARY KEY REFERENCES public.characters(id) ON DELETE CASCADE,
 campaign_id uuid NOT NULL,
 owner_id uuid NOT NULL,
 approved_class text NOT NULL CHECK(length(approved_class) BETWEEN 1 AND 120),
 approved_level integer NOT NULL CHECK(approved_level BETWEEN 1 AND 20),
 ruleset_version text NOT NULL CHECK(ruleset_version='native-v287-reviewed-fixed-and-base-spells'),
 approved_by uuid NOT NULL,
 approval_basis text NOT NULL CHECK(approval_basis='dm_reviewed_fixture_build'),
 approved_at timestamptz NOT NULL DEFAULT now()
);
-- AUDIT STATEMENT
REVOKE ALL ON terravale_internal.neon_resource_build_approval_audit FROM PUBLIC,anonymous,authenticated;
-- AUDIT STATEMENT
-- Only the original verified site/campaign DM may pin exactly one build.
-- No arbitrary max, submitted spell slots, subclass, auto-rest, class
-- mutation, owner reassignment, or broader player-character write grant.
CREATE OR REPLACE FUNCTION public.terravale_neon_audit_approve_build_rules(
 p_character uuid,p_expected_resource_version integer,
 p_expected_class text,p_expected_level integer,p_confirmation text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $approve$
DECLARE
 actor uuid:=(SELECT auth.uid());
 picked public.characters%ROWTYPE;
 canonical terravale_internal.neon_resource_authority_audit%ROWTYPE;
 supported_count integer;
BEGIN
 IF actor IS NULL THEN
  RAISE EXCEPTION 'Verified Discord account required' USING errcode='28000';
 END IF;
 IF p_character NOT IN(
  '11111111-1111-4111-8111-999999999991'::uuid,
  '11111111-1111-4111-8111-999999999992'::uuid,
  '11111111-1111-4111-8111-999999999993'::uuid,
  '11111111-1111-4111-8111-999999999994'::uuid
 ) OR p_expected_resource_version IS NULL
 OR p_expected_resource_version<0 OR p_expected_resource_version>1000000
 OR p_expected_level IS NULL OR p_expected_level NOT BETWEEN 1 AND 20
 OR p_expected_class IS NULL
 OR p_confirmation IS DISTINCT FROM 'dm_reviewed_class_level_and_campaign'
 THEN RAISE EXCEPTION 'Missing synthetic DM-approved build confirmation'
  USING errcode='22023';
 END IF;
 SELECT * INTO picked FROM public.characters c
  WHERE c.id=p_character AND c.name LIKE 'Neon resource audit %'
    AND c.status='approved' AND c.owner_id IS NOT NULL
  FOR UPDATE;
 IF NOT FOUND OR NOT authz.is_member(picked.campaign_id)
 OR NOT authz.is_dm(picked.campaign_id) THEN
  RAISE EXCEPTION 'Only an authorised site/campaign DM may approve rules'
    USING errcode='42501';
 END IF;
 SELECT * INTO canonical FROM terravale_internal.neon_resource_authority_audit a
 WHERE a.character_id=p_character FOR UPDATE;
 IF NOT FOUND OR canonical.version IS DISTINCT FROM p_expected_resource_version
 OR canonical.ruleset_version IS DISTINCT FROM 'native-v287-reviewed-fixed-and-base-spells'
 OR picked.approved_build#>'{character,sheetV220,resources}'
      IS DISTINCT FROM canonical.resource_values
 OR picked.approved_build#>>'{character,sheetV220,resourceRevision}'
      IS DISTINCT FROM canonical.version::text THEN
  RAISE EXCEPTION 'Stale or unverified authoritative character state'
     USING errcode='40001';
 END IF;
 IF picked.approved_build->>'class' IS DISTINCT FROM p_expected_class
 OR picked.approved_build->>'level' IS DISTINCT FROM p_expected_level::text
 OR picked.approved_build#>>'{character,className}' IS DISTINCT FROM p_expected_class
 OR picked.approved_build#>>'{character,level}' IS DISTINCT FROM p_expected_level::text THEN
  RAISE EXCEPTION 'Current class/level differs from DM review'
    USING errcode='42501';
 END IF;
 SELECT count(*)::integer INTO supported_count
 FROM terravale_internal.neon_resource_rules_audit r
 WHERE r.source_revision IN('native-v287-v220-verified','native-v287-v234-spells-verified')
 AND r.class_name=p_expected_class AND r.character_level=p_expected_level
 AND r.recovery='manual-review';
 IF supported_count<1 THEN
  RAISE EXCEPTION 'No audited resource rules for approved class/level'
    USING errcode='42501';
 END IF;
 INSERT INTO terravale_internal.neon_resource_build_approval_audit(
  character_id,campaign_id,owner_id,approved_class,approved_level,
  ruleset_version,approved_by,approval_basis
 ) VALUES(p_character,picked.campaign_id,picked.owner_id,p_expected_class,
  p_expected_level,canonical.ruleset_version,actor,'dm_reviewed_fixture_build');
 RETURN jsonb_build_object('class',p_expected_class,'level',p_expected_level,
  'approved',true,'resource_version',canonical.version);
END
$approve$;
-- AUDIT STATEMENT
REVOKE ALL ON FUNCTION public.terravale_neon_audit_approve_build_rules(
 uuid,integer,text,integer,text) FROM PUBLIC,anonymous,authenticated;
-- AUDIT STATEMENT
GRANT EXECUTE ON FUNCTION public.terravale_neon_audit_approve_build_rules(
 uuid,integer,text,integer,text) TO authenticated;
-- AUDIT STATEMENT
-- This trigger checks PRIVATE pinned provenance and resource values.
-- A forged class, level, campaign or owner change fails, even if the
-- caller supplies a fabricated higher resource revision and both JSON
-- class fields match each other. Cannot change actual users/characters.
CREATE OR REPLACE FUNCTION terravale_internal.neon_audit_resource_overwrite_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $guard$
DECLARE
 canonical terravale_internal.neon_resource_authority_audit%ROWTYPE;
 pinned terravale_internal.neon_resource_build_approval_audit%ROWTYPE;
BEGIN
 IF OLD.id NOT IN(
  '11111111-1111-4111-8111-999999999991'::uuid,
  '11111111-1111-4111-8111-999999999992'::uuid,
  '11111111-1111-4111-8111-999999999993'::uuid,
  '11111111-1111-4111-8111-999999999994'::uuid
 ) OR OLD.name NOT LIKE 'Neon resource audit %' THEN RETURN NEW; END IF;
 SELECT * INTO canonical FROM terravale_internal.neon_resource_authority_audit
 WHERE character_id=OLD.id;
 SELECT * INTO pinned FROM terravale_internal.neon_resource_build_approval_audit
 WHERE character_id=OLD.id;
 IF NOT FOUND OR canonical.character_id IS NULL
 OR NEW.campaign_id IS DISTINCT FROM pinned.campaign_id
 OR NEW.owner_id IS DISTINCT FROM pinned.owner_id
 OR NEW.status IS DISTINCT FROM 'approved'
 OR NEW.approved_build->>'class' IS DISTINCT FROM pinned.approved_class
 OR NEW.approved_build->>'level' IS DISTINCT FROM pinned.approved_level::text
 OR NEW.approved_build#>>'{character,className}' IS DISTINCT FROM pinned.approved_class
 OR NEW.approved_build#>>'{character,level}' IS DISTINCT FROM pinned.approved_level::text
 OR canonical.ruleset_version IS DISTINCT FROM pinned.ruleset_version
 OR NEW.approved_build#>'{character,sheetV220,resources}'
      IS DISTINCT FROM canonical.resource_values
 OR NEW.approved_build#>>'{character,sheetV220,resourceRevision}'
      IS DISTINCT FROM canonical.version::text THEN
  RAISE EXCEPTION 'DM-approved build or private resource authority mismatch'
    USING errcode='40001';
 END IF;
 RETURN NEW;
END
$guard$;
-- AUDIT STATEMENT
DROP TRIGGER neon_audit_resource_guard ON public.characters;
-- AUDIT STATEMENT
CREATE TRIGGER neon_audit_resource_guard
 BEFORE UPDATE OF approved_build,owner_id,campaign_id,status
 ON public.characters FOR EACH ROW
 EXECUTE FUNCTION terravale_internal.neon_audit_resource_overwrite_guard();
-- AUDIT STATEMENT
CREATE OR REPLACE FUNCTION public.terravale_neon_audit_resource_spend(
 p_character uuid,p_resource text,p_expected_version integer,
 p_spend integer,p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $spend$
DECLARE
  actor uuid := (SELECT auth.uid());
  picked public.characters%ROWTYPE;
  canonical terravale_internal.neon_resource_authority_audit%ROWTYPE;
  prior terravale_internal.neon_resource_spend_events_audit%ROWTYPE;
  limit_count integer;
  cap integer;
  current_value integer;
  new_value integer;
  next_state jsonb;
  next_version integer;
  linked_build jsonb;
BEGIN
 IF actor IS NULL THEN
   RAISE EXCEPTION 'Verified Discord account required' USING errcode='28000';
 END IF;
 IF p_character IS NULL OR p_resource IS NULL OR p_expected_version IS NULL
   OR p_spend IS NULL OR p_request_id IS NULL
   OR p_expected_version<0 OR p_expected_version>999999
   OR p_spend<1 OR p_spend>20
   OR length(p_resource) NOT BETWEEN 1 AND 100
   OR p_character NOT IN (
     '11111111-1111-4111-8111-999999999991'::uuid,
     '11111111-1111-4111-8111-999999999992'::uuid,
     '11111111-1111-4111-8111-999999999993'::uuid,
     '11111111-1111-4111-8111-999999999994'::uuid
   ) THEN
   RAISE EXCEPTION 'Invalid synthetic resource spending request' USING errcode='22023';
 END IF;
 SELECT * INTO picked FROM public.characters c
  WHERE c.id=p_character AND c.name LIKE 'Neon resource audit %'
    AND c.status='approved'
  FOR UPDATE;
 IF NOT FOUND
   OR NOT authz.is_member(picked.campaign_id)
   OR (picked.owner_id IS DISTINCT FROM actor
     AND NOT authz.is_dm(picked.campaign_id)) THEN
   RAISE EXCEPTION 'Character not owned or DM-authorised for this actor'
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
   RAISE EXCEPTION 'Saved character is not synchronized with resource authority'
     USING errcode='40001';
 END IF;
 SELECT * INTO prior
 FROM terravale_internal.neon_resource_spend_events_audit ev
 WHERE ev.character_id=p_character AND ev.request_id=p_request_id;
 IF FOUND THEN
   IF prior.actor_id IS DISTINCT FROM actor
      OR prior.resource_id IS DISTINCT FROM p_resource
      OR prior.expected_version IS DISTINCT FROM p_expected_version
      OR prior.spent IS DISTINCT FROM p_spend THEN
     RAISE EXCEPTION 'Operation token reused with different request'
       USING errcode='42501';
   END IF;
   RETURN jsonb_build_object('resource_id',prior.resource_id,
     'remaining',prior.resulting_remaining,'max',prior.resulting_max,
     'version',prior.resulting_version,'replayed',true,
     'requires_refresh',prior.resulting_version IS DISTINCT FROM canonical.version);
 END IF;
 IF canonical.version IS DISTINCT FROM p_expected_version THEN
   RAISE EXCEPTION 'Resource version conflict; reload current state'
     USING errcode='40001';
 END IF;
 IF picked.approved_build->>'class'
     IS DISTINCT FROM picked.approved_build#>>'{character,className}'
   OR picked.approved_build->>'level'
     IS DISTINCT FROM picked.approved_build#>>'{character,level}'
   OR picked.approved_build#>>'{character,level}' !~ '^(?:[1-9]|1[0-9]|20)$' THEN
   RAISE EXCEPTION 'Character class/level provenance mismatch'
     USING errcode='42501';
 END IF;

 -- Private, DM-pinned build identity is authoritative for every resource
 -- lookup. A matching class/level in a mutable JSON blob is NOT enough.
 IF NOT EXISTS(
   SELECT 1 FROM terravale_internal.neon_resource_build_approval_audit approved
   WHERE approved.character_id=p_character
     AND approved.campaign_id=picked.campaign_id
     AND approved.owner_id=picked.owner_id
     AND approved.approved_class=picked.approved_build->>'class'
     AND approved.approved_level=(picked.approved_build->>'level')::integer
     AND approved.ruleset_version=canonical.ruleset_version
 ) THEN
   RAISE EXCEPTION 'No current DM-approved build/rules identity'
     USING errcode='42501';
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
   RAISE EXCEPTION 'No unique approved resource limit for class and level'
     USING errcode='42501';
 END IF;
 IF jsonb_typeof(canonical.resource_values->p_resource) IS DISTINCT FROM 'number'
   OR canonical.resource_values->>p_resource !~ '^[0-9]{1,7}$' THEN
   RAISE EXCEPTION 'Explicit saved resource count required; defaults are unverified'
     USING errcode='22023';
 END IF;
 current_value:=(canonical.resource_values->>p_resource)::integer;
 IF current_value<0 OR current_value>cap OR current_value<p_spend THEN
   RAISE EXCEPTION 'Insufficient resource uses or invalid stored count'
     USING errcode='22023';
 END IF;
 new_value:=current_value-p_spend;
 next_version:=canonical.version+1;
 next_state:=jsonb_set(canonical.resource_values,ARRAY[p_resource],
   to_jsonb(new_value),false);
 -- Private source-of-truth update first: the fixture-only BEFORE trigger
 -- compares the public sheet mirror against this authoritative state.
 UPDATE terravale_internal.neon_resource_authority_audit
 SET version=next_version,resource_values=next_state
 WHERE character_id=p_character;
 linked_build:=jsonb_set(
   jsonb_set(picked.approved_build,
     '{character,sheetV220,resources}',next_state,false),
   '{character,sheetV220,resourceRevision}',
   to_jsonb(next_version),true);
 UPDATE public.characters SET approved_build=linked_build WHERE id=p_character;
 INSERT INTO terravale_internal.neon_resource_spend_events_audit(
   character_id,request_id,actor_id,resource_id,expected_version,spent,
   resulting_version,resulting_remaining,resulting_max
 ) VALUES(p_character,p_request_id,actor,p_resource,p_expected_version,p_spend,
   next_version,new_value,cap);
 RETURN jsonb_build_object('resource_id',p_resource,'remaining',new_value,
   'max',cap,'version',next_version,'replayed',false,
   'requires_refresh',false);
END
$spend$;
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
   OR p_basis IS NULL OR p_basis NOT IN ('player_confirmed','dm_session_record')
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

 -- Private, DM-pinned build identity is authoritative for every resource
 -- lookup. A matching class/level in a mutable JSON blob is NOT enough.
 IF NOT EXISTS(
   SELECT 1 FROM terravale_internal.neon_resource_build_approval_audit approved
   WHERE approved.character_id=p_character
     AND approved.campaign_id=picked.campaign_id
     AND approved.owner_id=picked.owner_id
     AND approved.approved_class=picked.approved_build->>'class'
     AND approved.approved_level=(picked.approved_build->>'level')::integer
     AND approved.ruleset_version=canonical.ruleset_version
 ) THEN
   RAISE EXCEPTION 'No current DM-approved build/rules identity'
     USING errcode='42501';
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
