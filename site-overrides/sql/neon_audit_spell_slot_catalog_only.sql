-- AUDIT ONLY: Applies solely to disposable Neon resource roundtrip child branch.
-- The embedded schedules are compared at all 20 levels against the actual
-- assembled V2.87 v234-spell-tables JSON in GitHub CI. Never deploy this SQL
-- to Neon staging, Neon main, production Supabase or the public website.
-- Subclass-dependent Fighter|Eldritch Knight and Rogue|Arcane Trickster
-- are deliberately excluded pending approved selection verification.
-- Warlock has Pact slots at ONE tier, not independent standard spell slots.
-- Recovery stays manual-review; do NOT grant automated rest/spend authority.
WITH canonical AS(
 SELECT $v234${"Artificer":{"kind":"standard","source":"Artificer Player Primer progression table","derived":false,"levels":[[2,0,0,0,0],[2,0,0,0,0],[3,0,0,0,0],[3,0,0,0,0],[4,2,0,0,0],[4,2,0,0,0],[4,3,0,0,0],[4,3,0,0,0],[4,3,2,0,0],[4,3,2,0,0],[4,3,3,0,0],[4,3,3,0,0],[4,3,3,1,0],[4,3,3,1,0],[4,3,3,2,0],[4,3,3,2,0],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]],"requires_subclass":false},"Bard":{"kind":"standard","source":"Bard Player Primer progression table","derived":false,"levels":[[2,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],[4,2,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],[4,3,2,0,0,0,0,0,0],[4,3,3,0,0,0,0,0,0],[4,3,3,1,0,0,0,0,0],[4,3,3,2,0,0,0,0,0],[4,3,3,3,1,0,0,0,0],[4,3,3,3,2,0,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],"requires_subclass":false},"Cleric":{"kind":"standard","source":"Cleric Player Primer progression table","derived":false,"levels":[[2,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],[4,2,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],[4,3,2,0,0,0,0,0,0],[4,3,3,0,0,0,0,0,0],[4,3,3,1,0,0,0,0,0],[4,3,3,2,0,0,0,0,0],[4,3,3,3,1,0,0,0,0],[4,3,3,3,2,0,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],"requires_subclass":false},"Druid":{"kind":"standard","source":"Druid Player Primer progression table","derived":false,"levels":[[2,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],[4,2,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],[4,3,2,0,0,0,0,0,0],[4,3,3,0,0,0,0,0,0],[4,3,3,1,0,0,0,0,0],[4,3,3,2,0,0,0,0,0],[4,3,3,3,1,0,0,0,0],[4,3,3,3,2,0,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],"requires_subclass":false},"Oracle of the Two Waters":{"kind":"standard","source":"Oracle of the Two Waters Player Primer progression table","derived":false,"levels":[[2,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],[4,2,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],[4,3,2,0,0,0,0,0,0],[4,3,3,0,0,0,0,0,0],[4,3,3,1,0,0,0,0,0],[4,3,3,2,0,0,0,0,0],[4,3,3,3,1,0,0,0,0],[4,3,3,3,2,0,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],"requires_subclass":false},"Paladin":{"kind":"standard","source":"Paladin Player Primer progression table","derived":false,"levels":[[2,0,0,0,0],[2,0,0,0,0],[3,0,0,0,0],[3,0,0,0,0],[4,2,0,0,0],[4,2,0,0,0],[4,3,0,0,0],[4,3,0,0,0],[4,3,2,0,0],[4,3,2,0,0],[4,3,3,0,0],[4,3,3,0,0],[4,3,3,1,0],[4,3,3,1,0],[4,3,3,2,0],[4,3,3,2,0],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]],"requires_subclass":false},"Ranger":{"kind":"standard","source":"Ranger Player Primer progression table","derived":false,"levels":[[2,0,0,0,0],[2,0,0,0,0],[3,0,0,0,0],[3,0,0,0,0],[4,2,0,0,0],[4,2,0,0,0],[4,3,0,0,0],[4,3,0,0,0],[4,3,2,0,0],[4,3,2,0,0],[4,3,3,0,0],[4,3,3,0,0],[4,3,3,1,0],[4,3,3,1,0],[4,3,3,2,0],[4,3,3,2,0],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]],"requires_subclass":false},"Sorcerer":{"kind":"standard","source":"Sorcerer Player Primer progression table","derived":false,"levels":[[2,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],[4,2,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],[4,3,2,0,0,0,0,0,0],[4,3,3,0,0,0,0,0,0],[4,3,3,1,0,0,0,0,0],[4,3,3,2,0,0,0,0,0],[4,3,3,3,1,0,0,0,0],[4,3,3,3,2,0,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],"requires_subclass":false},"Warlock":{"kind":"pact","source":"Warlock Player Primer progression table","derived":false,"levels":[{"count":1,"level":1},{"count":2,"level":1},{"count":2,"level":2},{"count":2,"level":2},{"count":2,"level":3},{"count":2,"level":3},{"count":2,"level":4},{"count":2,"level":4},{"count":2,"level":5},{"count":2,"level":5},{"count":3,"level":5},{"count":3,"level":5},{"count":3,"level":5},{"count":3,"level":5},{"count":3,"level":5},{"count":3,"level":5},{"count":4,"level":5},{"count":4,"level":5},{"count":4,"level":5},{"count":4,"level":5}],"requires_subclass":false},"Wizard":{"kind":"standard","source":"Wizard Player Primer progression table","derived":false,"levels":[[2,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],[4,2,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],[4,3,2,0,0,0,0,0,0],[4,3,3,0,0,0,0,0,0],[4,3,3,1,0,0,0,0,0],[4,3,3,2,0,0,0,0,0],[4,3,3,3,1,0,0,0,0],[4,3,3,3,2,0,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],"requires_subclass":false}}$v234$::jsonb AS data
), classes AS(
 SELECT c.key AS class_name,c.value AS definition FROM canonical
 CROSS JOIN LATERAL jsonb_each(data) c(key,value)
), levels AS(
 SELECT class_name,definition,r.value AS slot_row,r.ordinality::int AS character_level
 FROM classes CROSS JOIN LATERAL jsonb_array_elements(definition->'levels')
 WITH ORDINALITY r(value,ordinality)
), standard AS(
 SELECT 'native-v287-v234-spells-verified'::text AS source_revision,
 class_name,character_level,('spell-slot-'||s.ordinality)::text AS resource_id,
 s.n::int AS max_uses,'manual-review'::text AS recovery
 FROM levels l CROSS JOIN LATERAL jsonb_array_elements_text(
 CASE WHEN jsonb_typeof(l.slot_row)='array' THEN l.slot_row ELSE '[]'::jsonb END
 ) WITH ORDINALITY s(n,ordinality)
 WHERE definition->>'kind'='standard' AND s.n::int>0
), pact AS(
 SELECT 'native-v287-v234-spells-verified'::text AS source_revision,
 class_name,character_level,('pact-slot-'||(slot_row->>'level'))::text AS resource_id,
 (slot_row->>'count')::int AS max_uses,'manual-review'::text AS recovery
 FROM levels WHERE definition->>'kind'='pact'
 AND (slot_row->>'count')::int>0
)
INSERT INTO terravale_internal.neon_resource_rules_audit
(source_revision,class_name,character_level,resource_id,max_uses,recovery)
SELECT * FROM standard UNION ALL SELECT * FROM pact;
-- AUDIT STATEMENT
CREATE OR REPLACE FUNCTION public.terravale_neon_audit_resource_adjust(
  p_character uuid,p_resource_id text,p_expected_revision integer,p_remaining integer)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $audit$
DECLARE
  actor uuid := (SELECT auth.uid());
  row_data public.characters%ROWTYPE;
  cap integer;
  old_revision integer;
  old_resources jsonb;
  next_build jsonb;
BEGIN
  -- No production credentials, broad sheet JSON or caller-supplied maxima.
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Verified Discord account required' USING errcode='28000';
  END IF;
  IF p_character NOT IN (
    '11111111-1111-4111-8111-999999999991'::uuid,
    '11111111-1111-4111-8111-999999999992'::uuid,
    '11111111-1111-4111-8111-999999999993'::uuid,
    '11111111-1111-4111-8111-999999999994'::uuid
  ) OR p_resource_id IS NULL OR p_expected_revision IS NULL OR p_remaining IS NULL
    OR p_expected_revision<0 OR p_expected_revision>1000000 THEN
    RAISE EXCEPTION 'Invalid or non-fixture resource request' USING errcode='22023';
  END IF;
  SELECT * INTO row_data FROM public.characters
    WHERE id=p_character AND name LIKE 'Neon resource audit %'
      AND status='approved'
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fixture not found' USING errcode='42501';
  END IF;
  IF NOT authz.is_member(row_data.campaign_id)
    OR (actor IS DISTINCT FROM row_data.owner_id
      AND NOT authz.is_dm(row_data.campaign_id)) THEN
    RAISE EXCEPTION 'This character is not available to your account' USING errcode='42501';
  END IF;
  -- Strictly static, source-audited class + LEVEL lookup. The caller
  -- cannot provide a maximum, recovery cadence, class or level. An absent
  -- or DM-reviewed pool is DENIED, never assumed from the client.
  IF row_data.approved_build->>'class' IS DISTINCT FROM
     row_data.approved_build#>>'{character,className}'
     OR row_data.approved_build->>'level' IS DISTINCT FROM
     row_data.approved_build#>>'{character,level}' THEN
    RAISE EXCEPTION 'Unapproved class/level mismatch' USING errcode='42501';
  END IF;
  SELECT r.max_uses INTO cap
  FROM terravale_internal.neon_resource_rules_audit r
  WHERE r.source_revision IN ('native-v287-v220-verified','native-v287-v234-spells-verified')
    AND r.class_name=row_data.approved_build#>>'{character,className}'
    AND r.character_level=(row_data.approved_build#>>'{character,level}')::integer
    AND r.resource_id=p_resource_id
    AND r.recovery='manual-review';
  IF cap IS NULL THEN
    RAISE EXCEPTION 'No source-verified server resource limit for this class/level'
      USING errcode='42501';
  END IF;
  IF p_remaining<0 OR p_remaining>cap THEN
    RAISE EXCEPTION 'Remaining value is outside approved maximum' USING errcode='22023';
  END IF;
  old_resources:=row_data.approved_build#>'{character,sheetV220,resources}';
  IF jsonb_typeof(old_resources) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Missing original native V2.87 resource map' USING errcode='22023';
  END IF;
  old_revision:=COALESCE(
    (row_data.approved_build#>>'{character,sheetV220,resourceRevision}')::integer,0);
  IF old_revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'Outdated resource revision: reload required' USING errcode='40001';
  END IF;
  -- Only the named resource and its revision change. No broad JSON save,
  -- unrelated resources, character identity, class, level or features change.
  next_build:=jsonb_set(
    jsonb_set(
      row_data.approved_build,
      '{character,sheetV220,resources}',
      jsonb_set(old_resources,ARRAY[p_resource_id],to_jsonb(p_remaining),true),
      false
    ),
    '{character,sheetV220,resourceRevision}',
    to_jsonb(old_revision+1),true
  );
  UPDATE public.characters SET approved_build=next_build WHERE id=p_character;
  RETURN jsonb_build_object('resource_id',p_resource_id,'remaining',p_remaining,
    'max',cap,'revision',old_revision+1);
END
$audit$;
-- AUDIT STATEMENT
WITH verified_owner AS (
 SELECT i.legacy_user_id AS user_id
 FROM terravale_internal.identity_links i
 JOIN public.characters c ON c.owner_id=i.legacy_user_id
 WHERE i.oauth_provider='discord'
 ORDER BY c.id LIMIT 1
)
INSERT INTO public.campaigns(id,name,owner_id,description)
SELECT '11111111-1111-4111-8111-999999999984'::uuid,
 'Neon resource audit warlock campaign',o.user_id,
 'Synthetic source-checked Warlock Pact slot fixture'
FROM verified_owner o;
-- AUDIT STATEMENT
WITH verified_owner AS (
 SELECT i.legacy_user_id AS user_id
 FROM terravale_internal.identity_links i
 JOIN public.characters c ON c.owner_id=i.legacy_user_id
 WHERE i.oauth_provider='discord'
 ORDER BY c.id LIMIT 1
)
INSERT INTO public.characters
(id,campaign_id,owner_id,name,status,approved_build,sheet_visible_to_party)
SELECT '11111111-1111-4111-8111-999999999994'::uuid,
'11111111-1111-4111-8111-999999999984'::uuid,
o.user_id,'Neon resource audit Warlock Pact Magic','approved',
jsonb_build_object('class','Warlock','level',3,'character',
 jsonb_build_object('name','Neon resource audit Warlock Pact Magic',
 'className','Warlock','level',3,
 'sheetV220',jsonb_build_object('resources','{}'::jsonb))),
false FROM verified_owner o;
