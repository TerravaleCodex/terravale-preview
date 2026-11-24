-- Terravale Cabinet Advertisement Atelier: DM-only global ad selection.
-- Backwards compatible with existing public ad reads and the original
-- site_ad_settings DM-only UPDATE RLS policy. Does not switch ads on.
-- Apply to current Supabase and isolated Neon staging; never to Neon main.
ALTER TABLE public.site_ad_settings
  ADD COLUMN IF NOT EXISTS grim_food_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ad_priorities jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Restrict the new settings to JSON objects; approved art IDs and 1/3/8
-- weights are validated in the Atelier and server-side RLS still requires
-- authz.is_site_dm() for updates.
DO $schema$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conrelid='public.site_ad_settings'::regclass
    AND conname='site_ad_settings_ad_priorities_object'
 ) THEN
  ALTER TABLE public.site_ad_settings
  ADD CONSTRAINT site_ad_settings_ad_priorities_object
  CHECK (jsonb_typeof(ad_priorities) = 'object');
 END IF;
END
$schema$;

COMMENT ON COLUMN public.site_ad_settings.grim_food_only
  IS 'DM-only advert rotation: restrict all popups, including test bursts, to approved zip-037 Grim Meal';
COMMENT ON COLUMN public.site_ad_settings.ad_priorities
  IS 'DM-saved artwork selection weights keyed by approved zip-* ID, 3x or 8x; absent = 1x. Existing RLS restricts writes to site DM.';
