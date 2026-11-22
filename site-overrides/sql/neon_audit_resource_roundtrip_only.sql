-- AUDIT ONLY. DO NOT RUN ON NEON STAGING, NEON MAIN OR SUPABASE.
-- The two UUIDs below are synthetic character fixture IDs, never real player IDs.
-- Maxima are test-only fixtures, NOT authoritative Terravale class rules.
-- Installed solely on a Neon child branch cloned from staging.
CREATE TABLE terravale_internal.neon_resource_roundtrip_audit_limits (
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  resource_id text NOT NULL CHECK (length(resource_id) BETWEEN 1 AND 100),
  max_uses integer NOT NULL CHECK (max_uses BETWEEN 1 AND 20),
  PRIMARY KEY (character_id,resource_id)
);
-- AUDIT STATEMENT
REVOKE ALL ON terravale_internal.neon_resource_roundtrip_audit_limits FROM PUBLIC,authenticated,anonymous;
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
    '11111111-1111-4111-8111-999999999992'::uuid
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
  SELECT l.max_uses INTO cap FROM terravale_internal.neon_resource_roundtrip_audit_limits l
  WHERE l.character_id=p_character AND l.resource_id=p_resource_id;
  IF cap IS NULL THEN
    RAISE EXCEPTION 'Resource ID not registered for this fixture' USING errcode='42501';
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
REVOKE ALL ON FUNCTION public.terravale_neon_audit_resource_adjust(uuid,text,integer,integer) FROM PUBLIC,anonymous,authenticated;
-- AUDIT STATEMENT
GRANT EXECUTE ON FUNCTION public.terravale_neon_audit_resource_adjust(uuid,text,integer,integer) TO authenticated;
-- AUDIT STATEMENT
-- One assigned PC per owner/campaign is enforced by the real Terravale
-- partial unique index. Use TWO disposable fixture campaigns rather than
-- weakening or removing any production constraint.
WITH verified_owner AS (
 SELECT c.owner_id
 FROM public.characters c JOIN terravale_internal.identity_links i
   ON i.legacy_user_id=c.owner_id AND i.oauth_provider='discord'
 WHERE c.owner_id IS NOT NULL
 ORDER BY c.id LIMIT 1
), fixtures AS (
 SELECT '11111111-1111-4111-8111-999999999981'::uuid AS campaign_id,
        'Neon resource audit spellcaster campaign'::text AS name
 UNION ALL
 SELECT '11111111-1111-4111-8111-999999999982'::uuid,
        'Neon resource audit class campaign'::text
)
INSERT INTO public.campaigns(id,name,owner_id,description)
SELECT f.campaign_id,f.name,o.owner_id,'Synthetic isolated test fixture'
FROM fixtures f CROSS JOIN verified_owner o;
-- AUDIT STATEMENT
WITH verified_owner AS (
 SELECT c.owner_id,c.campaign_id
 FROM public.characters c JOIN terravale_internal.identity_links i
   ON i.legacy_user_id=c.owner_id AND i.oauth_provider='discord'
 WHERE c.owner_id IS NOT NULL
 ORDER BY c.id LIMIT 1
), fixtures AS (
 SELECT '11111111-1111-4111-8111-999999999991'::uuid AS fixture_id,
   '11111111-1111-4111-8111-999999999981'::uuid AS fixture_campaign_id,
   'Cleric'::text AS class_name,'Neon resource audit spellcaster'::text AS fixture_name
 UNION ALL
 SELECT '11111111-1111-4111-8111-999999999992'::uuid,
   '11111111-1111-4111-8111-999999999982'::uuid,
   'Shaman'::text,'Neon resource audit class ability'::text
)
INSERT INTO public.characters(id,campaign_id,owner_id,name,status,approved_build,sheet_visible_to_party)
SELECT f.fixture_id,f.fixture_campaign_id,o.owner_id,f.fixture_name,'approved',
  jsonb_build_object('class',f.class_name,'level',3,'character',
    jsonb_build_object('name',f.fixture_name,'className',f.class_name,'level',3,
      'sheetV220',jsonb_build_object('resources','{}'::jsonb))),
  false
FROM fixtures f CROSS JOIN verified_owner o;
-- AUDIT STATEMENT
INSERT INTO terravale_internal.neon_resource_roundtrip_audit_limits
(character_id,resource_id,max_uses)
VALUES
('11111111-1111-4111-8111-999999999991'::uuid,'spell-slot-1',4),
('11111111-1111-4111-8111-999999999992'::uuid,'spirit-favour',2);
