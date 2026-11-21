-- Neon staging only: minimal RLS-aware character preview for live-JWT test.
-- PostgreSQL omits SECURITY INVOKER in pg_get_functiondef because it is the default.
-- No raw sheet, profile, inventory, patron favour, or owner's UUID is returned.
-- Requires authenticated-only SELECT on characters and campaigns with their original RLS policies.
-- Tested on rpc-write-audit child; do not enable in production until cutover.
BEGIN;
CREATE OR REPLACE FUNCTION public.terravale_neon_staging_character_preview()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 WITH visible AS MATERIALIZED (
   SELECT
     c.id AS character_id,
     left(coalesce(nullif(c.approved_build->'character'->>'name',''), 'Unnamed character'), 120) AS display_name,
     left(coalesce(nullif(c.approved_build->'character'->>'className',''),nullif(c.approved_build->>'className',''), nullif(c.approved_build->>'class',''),'—'),80) AS class_name,
     left(coalesce(nullif(c.approved_build->'character'->>'ancestry',''),nullif(c.approved_build->>'ancestry',''),'—'),80) AS ancestry,
     CASE WHEN coalesce(c.approved_build->>'level','') ~ '^(?:[1-9]|1[0-9]|20)$'
          THEN (c.approved_build->>'level')::integer ELSE NULL END AS character_level,
     left(ca.name,120) AS campaign_name,
     CASE WHEN c.owner_id=(SELECT auth.uid()) THEN 'owned'
          WHEN authz.is_dm(c.campaign_id) THEN 'dm'
          ELSE 'shared' END AS access_type,
     c.status AS status
   FROM public.characters c
   JOIN public.campaigns ca ON ca.id=c.campaign_id
   WHERE auth.uid() IS NOT NULL
   ORDER BY ca.name, c.id
   LIMIT 25
 )
 SELECT jsonb_build_object(
   'read_only', true,
   'characters', coalesce((
     SELECT jsonb_agg(jsonb_build_object(
       'id',v.character_id,'name',v.display_name,'class',v.class_name,
       'ancestry',v.ancestry,'level',v.character_level,
       'campaign',v.campaign_name,'access',v.access_type,'status',v.status
      ) ORDER BY v.campaign_name,v.display_name,v.character_id)
     FROM visible v
   ),'[]'::jsonb)
 )
$function$
;
REVOKE ALL ON FUNCTION public.terravale_neon_staging_character_preview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.terravale_neon_staging_character_preview() TO authenticated;
COMMENT ON FUNCTION public.terravale_neon_staging_character_preview() IS 'Temporary staging-only RLS security-invoker character preview; minimum names, class and level. Remove after app migration tests.';
COMMIT;
