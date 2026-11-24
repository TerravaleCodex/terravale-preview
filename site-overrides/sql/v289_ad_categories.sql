-- Cabinet v2.89: category allowlist for ALL 159 approved fictional adverts.
-- Empty array = all categories; a non-empty array restricts allowed artwork.
-- Existing Supabase DM-only UPDATE RLS remains unchanged.
ALTER TABLE public.site_ad_settings
 ADD COLUMN IF NOT EXISTS ad_categories text[] NOT NULL DEFAULT '{}'::text[];
-- Only the 11 approved catalogue categories can be saved in the global
-- settings table, even by an authorised DM.
DO $schema$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint
   WHERE conrelid='public.site_ad_settings'::regclass
     AND conname='site_ad_settings_ad_categories_allowlist'
 ) THEN
  ALTER TABLE public.site_ad_settings
   ADD CONSTRAINT site_ad_settings_ad_categories_allowlist
   CHECK(ad_categories <@ ARRAY[
     'grim-gourmet','food-drink','dating','pets','wellness',
     'magic','tech','games','travel','services','chaos'
   ]::text[]);
 END IF;
END
$schema$;
COMMENT ON COLUMN public.site_ad_settings.ad_categories IS
 'DM-saved global selection of allowed fictional ad categories; empty means all. Grim Gourmet-only setting overrides this list.';
