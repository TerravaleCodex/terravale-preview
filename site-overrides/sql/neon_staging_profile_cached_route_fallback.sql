-- Staging-only repair for PostgREST's newly registered bootstrap RPC returning 404.
-- Reuses the already-proven cached character-preview RPC signature, while
-- including *only the authenticated visitor's verified original V2 profile*.
-- The profile subcall checks Neon Discord OAuth and the legacy owner; unknown
-- visitors get NULL profile and zero character rows. No writes or extra grants.
-- SECURITY INVOKER (PostgreSQL's default) preserves character RLS.
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
   'account', CASE WHEN auth.uid() IS NOT NULL
                    THEN public.terravale_neon_staging_account_bootstrap()
                    ELSE NULL::jsonb END,
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
COMMENT ON FUNCTION public.terravale_neon_staging_character_preview() IS 'Temporary staging-only RLS-limited character summary with owner-only verified V2 profile fallback for API schema cache 404. No table writes.';
