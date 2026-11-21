-- Neon staging ONLY. Reads the approved saved V2 character sheet and current
-- resources, inventory, wallet and item charge properties. Uses SECURITY INVOKER,
-- the preexisting character/state/wallet RLS policies, and explicit owner-or-DM
-- authorization. No writes, no new role grants other than RLS-limited SELECT.
-- Never run on production Supabase or Neon main.
CREATE OR REPLACE FUNCTION public.terravale_neon_staging_sheet_read(p_character_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
WITH permitted AS MATERIALIZED (
 SELECT c.id,c.campaign_id,c.owner_id,c.name,c.status,c.approved_build,
        ca.name AS campaign_name
 FROM public.characters c
 JOIN public.campaigns ca ON ca.id=c.campaign_id
 WHERE c.id=p_character_id
   AND auth.uid() IS NOT NULL
   AND (c.owner_id=auth.uid() OR authz.is_dm(c.campaign_id))
 LIMIT 1
)
SELECT jsonb_build_object(
  'read_only',true,
  'character',jsonb_build_object(
     'id',c.id,
     'name',c.name,
     'status',c.status,
     'campaign',c.campaign_name,
     'access',CASE WHEN c.owner_id=auth.uid() THEN 'owned' ELSE 'dm' END,
     'approved_build',c.approved_build
  ),
  'state',CASE WHEN s.character_id IS NULL THEN NULL ELSE
     to_jsonb(s)-'character_id'-'updated_at' END,
  'wallet',coalesce((
    SELECT jsonb_agg(jsonb_build_object('denomination_id',w.denomination_id,
      'quantity',w.quantity) ORDER BY w.denomination_id)
    FROM public.terravale_character_wallet w WHERE w.character_id=c.id
  ),'[]'::jsonb),
  'item_properties',coalesce((
    SELECT jsonb_agg(jsonb_build_object('item_id',ip.item_id,'properties',ip.properties)
      ORDER BY ip.item_id)
    FROM (SELECT item_id,properties FROM public.character_item_properties
          WHERE character_id=c.id ORDER BY item_id LIMIT 200) ip
  ),'[]'::jsonb)
)
FROM permitted c
LEFT JOIN public.character_state s ON s.character_id=c.id
$function$
;
REVOKE ALL ON FUNCTION public.terravale_neon_staging_sheet_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.terravale_neon_staging_sheet_read(uuid) TO authenticated;
GRANT SELECT ON public.terravale_character_wallet,public.character_item_properties TO authenticated;
