-- AUDIT-ONLY RULES-CATALOG FOLLOW-UP TO PR #91. NEVER INSTALL ON NEON STAGING,
-- NEON MAIN, PRODUCTION SUPABASE OR THE PUBLIC WEBSITE.
-- Validates class/level limits against v2.20 fixed progression tables,
-- statically verified against the assembled V2.87 source by CI.
-- Spell slots, subclass, DM-reviewed resources, automatic rests and
-- custom/temporary abilities are deliberately REJECTED, not guessed.
CREATE TABLE terravale_internal.neon_resource_rules_audit (
  source_revision text NOT NULL,
  class_name text NOT NULL,
  character_level integer NOT NULL CHECK(character_level BETWEEN 1 AND 20),
  resource_id text NOT NULL,
  max_uses integer NOT NULL CHECK(max_uses BETWEEN 1 AND 20),
  recovery text NOT NULL CHECK(recovery='manual-review'),
  PRIMARY KEY(source_revision,class_name,character_level,resource_id)
);
-- AUDIT STATEMENT
REVOKE ALL ON terravale_internal.neon_resource_rules_audit FROM PUBLIC,authenticated,anonymous;
-- AUDIT STATEMENT
INSERT INTO terravale_internal.neon_resource_rules_audit
  (source_revision,class_name,character_level,resource_id,max_uses,recovery)
VALUES
  ('native-v287-v220-verified','Shaman',2,'spirit-favour',3,'manual-review'),
  ('native-v287-v220-verified','Shaman',3,'spirit-favour',3,'manual-review'),
  ('native-v287-v220-verified','Shaman',4,'spirit-favour',3,'manual-review'),
  ('native-v287-v220-verified','Shaman',5,'spirit-favour',4,'manual-review'),
  ('native-v287-v220-verified','Shaman',6,'spirit-favour',4,'manual-review'),
  ('native-v287-v220-verified','Shaman',7,'spirit-favour',4,'manual-review'),
  ('native-v287-v220-verified','Shaman',8,'spirit-favour',4,'manual-review'),
  ('native-v287-v220-verified','Shaman',9,'spirit-favour',5,'manual-review'),
  ('native-v287-v220-verified','Shaman',10,'spirit-favour',5,'manual-review'),
  ('native-v287-v220-verified','Shaman',11,'spirit-favour',5,'manual-review'),
  ('native-v287-v220-verified','Shaman',12,'spirit-favour',5,'manual-review'),
  ('native-v287-v220-verified','Shaman',13,'spirit-favour',6,'manual-review'),
  ('native-v287-v220-verified','Shaman',14,'spirit-favour',6,'manual-review'),
  ('native-v287-v220-verified','Shaman',15,'spirit-favour',6,'manual-review'),
  ('native-v287-v220-verified','Shaman',16,'spirit-favour',6,'manual-review'),
  ('native-v287-v220-verified','Shaman',17,'spirit-favour',6,'manual-review'),
  ('native-v287-v220-verified','Shaman',18,'spirit-favour',6,'manual-review'),
  ('native-v287-v220-verified','Shaman',19,'spirit-favour',6,'manual-review'),
  ('native-v287-v220-verified','Shaman',20,'spirit-favour',7,'manual-review'),
  ('native-v287-v220-verified','Bloodforger',1,'blood-reserve',4,'manual-review'),
  ('native-v287-v220-verified','Bloodforger',2,'blood-reserve',4,'manual-review'),
  ('native-v287-v220-verified','Bloodforger',3,'blood-reserve',5,'manual-review'),
  ('native-v287-v220-verified','Bloodforger',4,'blood-reserve',5,'manual-review'),
  ('native-v287-v220-verified','Bloodforger',5,'blood-reserve',6,'manual-review'),
  ('native-v287-v220-verified','Bloodforger',6,'blood-reserve',6,'manual-review'),
  ('native-v287-v220-verified','Bloodforger',7,'blood-reserve',7,'manual-review'),
  ('native-v287-v220-verified','Bloodforger',8,'blood-reserve',7,'manual-review'),
  ('native-v287-v220-verified','Bloodforger',9,'blood-reserve',8,'manual-review'),
  ('native-v287-v220-verified','Bloodforger',10,'blood-reserve',8,'manual-review'),
  ('native-v287-v220-verified','Bloodforger',11,'blood-reserve',9,'manual-review'),
  ('native-v287-v220-verified','Bloodforger',12,'blood-reserve',9,'manual-review'),
  ('native-v287-v220-verified','Bloodforger',13,'blood-reserve',10,'manual-review'),
  ('native-v287-v220-verified','Bloodforger',14,'blood-reserve',10,'manual-review'),
  ('native-v287-v220-verified','Bloodforger',15,'blood-reserve',11,'manual-review'),
  ('native-v287-v220-verified','Bloodforger',16,'blood-reserve',11,'manual-review'),
  ('native-v287-v220-verified','Bloodforger',17,'blood-reserve',12,'manual-review'),
  ('native-v287-v220-verified','Bloodforger',18,'blood-reserve',12,'manual-review'),
  ('native-v287-v220-verified','Bloodforger',19,'blood-reserve',13,'manual-review'),
  ('native-v287-v220-verified','Bloodforger',20,'blood-reserve',14,'manual-review');
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
    '11111111-1111-4111-8111-999999999993'::uuid
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
  SELECT r.max_uses INTO cap
  FROM terravale_internal.neon_resource_rules_audit r
  WHERE r.source_revision='native-v287-v220-verified'
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
SELECT '11111111-1111-4111-8111-999999999983'::uuid,
 'Neon resource audit blood reserve campaign',o.user_id,
 'Synthetic fixed-table audit fixture'
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
SELECT '11111111-1111-4111-8111-999999999993'::uuid,
 '11111111-1111-4111-8111-999999999983'::uuid,
 o.user_id,'Neon resource audit blood reserve','approved',
 jsonb_build_object('class','Bloodforger','level',3,'character',
   jsonb_build_object('name','Neon resource audit blood reserve',
     'className','Bloodforger','level',3,
     'sheetV220',jsonb_build_object('resources','{}'::jsonb))),
 false
FROM verified_owner o;
