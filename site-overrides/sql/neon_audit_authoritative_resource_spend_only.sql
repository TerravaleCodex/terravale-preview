-- AUDIT ONLY. NEVER install on Neon staging/main or production Supabase.
-- This follows PRs #91-93 on the disposable Neon child branch only.
-- The implementation is deliberately restricted to four named synthetic PCs
-- and original V2.87 resource IDs approved in the private rule catalogue.
-- It is a prototype, NOT a production grant or UI connection.
CREATE TABLE terravale_internal.neon_resource_authority_audit (
 character_id uuid PRIMARY KEY REFERENCES public.characters(id) ON DELETE CASCADE,
 version integer NOT NULL CHECK(version BETWEEN 0 AND 1000000),
 resource_values jsonb NOT NULL CHECK(jsonb_typeof(resource_values)='object'),
 ruleset_version text NOT NULL
   CHECK(ruleset_version='native-v287-reviewed-fixed-and-base-spells'),
 created_at timestamptz NOT NULL DEFAULT now()
);
-- AUDIT STATEMENT
REVOKE ALL ON terravale_internal.neon_resource_authority_audit FROM PUBLIC,anonymous,authenticated;
-- AUDIT STATEMENT
INSERT INTO terravale_internal.neon_resource_authority_audit
 (character_id,version,resource_values,ruleset_version)
SELECT c.id,
  COALESCE((c.approved_build#>>'{character,sheetV220,resourceRevision}')::integer,0),
  c.approved_build#>'{character,sheetV220,resources}',
  'native-v287-reviewed-fixed-and-base-spells'
FROM public.characters c
WHERE c.id IN (
 '11111111-1111-4111-8111-999999999991'::uuid,
 '11111111-1111-4111-8111-999999999992'::uuid,
 '11111111-1111-4111-8111-999999999993'::uuid,
 '11111111-1111-4111-8111-999999999994'::uuid
) AND c.name LIKE 'Neon resource audit %'
 AND jsonb_typeof(c.approved_build#>'{character,sheetV220,resources}')='object';
-- AUDIT STATEMENT
CREATE TABLE terravale_internal.neon_resource_spend_events_audit (
 character_id uuid NOT NULL REFERENCES
   terravale_internal.neon_resource_authority_audit(character_id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 actor_id uuid NOT NULL,
 resource_id text NOT NULL,
 expected_version integer NOT NULL,
 spent integer NOT NULL,
 resulting_version integer NOT NULL,
 resulting_remaining integer NOT NULL,
 resulting_max integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(character_id,request_id)
);
-- AUDIT STATEMENT
REVOKE ALL ON terravale_internal.neon_resource_spend_events_audit FROM PUBLIC,anonymous,authenticated;
-- AUDIT STATEMENT
-- Replaces earlier TEST-ONLY revision-difference trigger. This comparison
-- cannot be defeated by forging a higher sheet resourceRevision, since the
-- reference is a private, server-owned row that the old save RPC never edits.
CREATE OR REPLACE FUNCTION terravale_internal.neon_audit_resource_overwrite_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $guard$
DECLARE
  canonical terravale_internal.neon_resource_authority_audit%ROWTYPE;
BEGIN
 IF OLD.id NOT IN (
   '11111111-1111-4111-8111-999999999991'::uuid,
   '11111111-1111-4111-8111-999999999992'::uuid,
   '11111111-1111-4111-8111-999999999993'::uuid,
   '11111111-1111-4111-8111-999999999994'::uuid
 ) OR OLD.name NOT LIKE 'Neon resource audit %' THEN
   RETURN NEW;
 END IF;
 SELECT * INTO canonical
 FROM terravale_internal.neon_resource_authority_audit
 WHERE character_id=OLD.id;
 IF NOT FOUND
    OR NEW.approved_build#>'{character,sheetV220,resources}'
         IS DISTINCT FROM canonical.resource_values
    OR NEW.approved_build#>>'{character,sheetV220,resourceRevision}'
         IS DISTINCT FROM canonical.version::text THEN
    RAISE EXCEPTION 'Authoritative resource record mismatch; reload'
      USING errcode='40001';
 END IF;
 RETURN NEW;
END
$guard$;
-- AUDIT STATEMENT
REVOKE ALL ON FUNCTION terravale_internal.neon_audit_resource_overwrite_guard()
 FROM PUBLIC,anonymous,authenticated;
-- AUDIT STATEMENT
-- No arbitrary new_remaining, client maximum, general sheet or rest support.
-- This action only SPENDS explicit saved charges and returns its own revision.
-- It is row-lock serialised and idempotent by (character,operation UUID).
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
REVOKE ALL ON FUNCTION public.terravale_neon_audit_resource_spend(
 uuid,text,integer,integer,uuid) FROM PUBLIC,anonymous,authenticated;
-- AUDIT STATEMENT
GRANT EXECUTE ON FUNCTION public.terravale_neon_audit_resource_spend(
 uuid,text,integer,integer,uuid) TO authenticated;
