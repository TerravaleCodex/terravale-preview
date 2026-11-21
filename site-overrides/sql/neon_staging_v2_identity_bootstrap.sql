-- TEMPORARY Neon staging V2 identity bootstrap.
-- A verified JWT mapped through OAuth Discord -> original legacy owner may only
-- fetch its *own* existing profile, not other users' profiles. No writes.
-- Supabase production and Neon main must not execute this script.
CREATE OR REPLACE FUNCTION public.terravale_neon_staging_account_bootstrap()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 actor uuid;
 profile_row public.terravale_profiles%ROWTYPE;
 oauth_discord_id text;
BEGIN
 actor := auth.uid();
 IF actor IS NULL THEN
  RETURN jsonb_build_object('verified',false,'profile_exists',false);
 END IF;
 SELECT a."accountId" INTO oauth_discord_id
 FROM neon_auth.account a
 JOIN neon_auth."user" u ON u.id=a."userId" AND u.banned IS NOT TRUE
 WHERE a."providerId"='discord' AND a."userId"=auth.neon_request_user_id()
 LIMIT 1;
 IF oauth_discord_id IS NULL THEN
  RETURN jsonb_build_object('verified',false,'profile_exists',false);
 END IF;
 SELECT p.* INTO profile_row
 FROM public.terravale_profiles p
 WHERE p.user_id=actor AND p.discord_uid=oauth_discord_id
 LIMIT 1;
 IF NOT FOUND THEN
  RETURN jsonb_build_object('verified',false,'profile_exists',false);
 END IF;
 RETURN jsonb_build_object(
  'verified',true,
  'profile_exists',true,
  'user_id',profile_row.user_id,
  'tvuid',profile_row.tvuid,
  'discord_uid',profile_row.discord_uid,
  'discord_username',profile_row.discord_username,
  'discord_avatar_url',profile_row.discord_avatar_url,
  'custom_avatar_path',profile_row.custom_avatar_path,
  'is_dm',authz.is_site_dm(),
  'read_only',true
 );
END
$function$

REVOKE ALL ON FUNCTION public.terravale_neon_staging_account_bootstrap() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.terravale_neon_staging_account_bootstrap() TO authenticated;
COMMENT ON FUNCTION public.terravale_neon_staging_account_bootstrap() IS 'Temporary staging-only JWT Discord original profile; returns only the current verified identity, no writes. Remove after full V2 migration.';
