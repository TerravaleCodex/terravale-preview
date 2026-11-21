-- Neon STAGING ONLY. Privileged read scope exists solely because the existing
-- canonical divine tables have no direct player RLS select grants.
-- An authenticated, verified Discord account must be the original owner or
-- campaign DM, exactly as for terravale_neon_staging_sheet_read.
-- Does NOT expose exact favour scores, ungranted divine candidates, private
-- divine chronicle/DM notes, identity IDs, or write privileges.
CREATE OR REPLACE FUNCTION public.terravale_neon_staging_sheet_extras_read(p_character_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE
  actor uuid := (SELECT auth.uid());
  selected public.characters%ROWTYPE;
BEGIN
  IF actor IS NULL OR p_character_id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO selected FROM public.characters WHERE id=p_character_id LIMIT 1;
  IF selected.id IS NULL OR NOT (selected.owner_id=actor OR
    COALESCE(authz.is_dm(selected.campaign_id),false)) THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'read_only',true,
    'character_id',selected.id,
    'access',CASE WHEN selected.owner_id=actor THEN 'owned' ELSE 'dm' END,
    'proficiencies',COALESCE((
      SELECT jsonb_build_object(
        'tools',p.tools,'languages',p.languages,
        'pending_languages',p.pending_languages,
        'dm_bonus',p.dm_bonus)
      FROM public.terravale_character_proficiencies p
      WHERE p.character_id=selected.id
    ),'{}'::jsonb),
    'training',COALESCE((
      SELECT jsonb_build_object(
        'hidden_tools',t.hidden_tools,'hidden_languages',t.hidden_languages,
        'extra_tools',t.extra_tools,'extra_languages',t.extra_languages,
        'language_modes',t.language_modes)
      FROM public.terravale_character_training_overrides t
      WHERE t.character_id=selected.id
    ),'{}'::jsonb),
    'custom_feats',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',x.id,'name',x.name,'summary',x.short_description,
        'rules',x.rules_text,'action_type',x.action_type,
        'uses_per_rest',x.uses_per_rest,'recovery',x.recovery)
        ORDER BY x.name)
      FROM (SELECT g.id,f.name,f.short_description,f.rules_text,
              f.action_type,f.uses_per_rest,f.recovery
            FROM public.terravale_character_custom_feats g
            JOIN public.terravale_dm_custom_feats f
              ON f.id=g.feat_id AND f.campaign_id=selected.campaign_id
            WHERE g.character_id=selected.id
              AND g.campaign_id=selected.campaign_id
              AND g.status='active'
            ORDER BY f.name,g.id LIMIT 100) x
    ),'[]'::jsonb),
    'granted_boons',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',x.id,'name',x.name,'kind',x.kind,'summary',x.summary,
        'max_charges',x.max_charges,'charges_remaining',x.charges_remaining,
        'recovery',x.recovery) ORDER BY x.name)
      FROM (SELECT g.id,b.name,b.kind,b.summary,b.max_charges,
              g.charges_remaining,b.recovery
            FROM public.terravale_character_divine_boons g
            JOIN public.terravale_dm_divine_boons b ON b.id=g.boon_id
              AND b.campaign_id=selected.campaign_id
            WHERE g.character_id=selected.id AND g.status='active'
            ORDER BY b.name,g.id LIMIT 100) x
    ),'[]'::jsonb),
    'canonical_awards',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',x.id,'name',x.name,'kind',x.kind,'slot',x.slot,'tier',x.tier,
        'source_heading',x.source_heading,
        'max_uses',x.max_uses,'uses_remaining',x.uses_remaining,
        'recovery',x.recovery,'chosen_ability',x.chosen_ability)
        ORDER BY x.name)
      FROM (SELECT a.id,e.name,e.kind,e.tier,e.source_heading,
              a.slot,a.max_uses,a.uses_remaining,a.recovery,a.chosen_ability
            FROM public.terravale_divine_canon_awards a
            JOIN public.terravale_divine_archive_entries e
              ON e.id=a.entry_id AND e.campaign_id=selected.campaign_id
            WHERE a.character_id=selected.id AND a.status='active'
            ORDER BY e.name,a.id LIMIT 100) x
    ),'[]'::jsonb),
    'divine_effects',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key',x.effect_key,'stacks',x.stacks,'note',x.note)
        ORDER BY x.effect_key)
      FROM (SELECT d.effect_key,d.stacks,d.note
            FROM public.terravale_divine_canon_effects d
            WHERE d.character_id=selected.id AND d.stacks>0
            ORDER BY d.effect_key LIMIT 100) x
    ),'[]'::jsonb)
  );
END
$fn$;
REVOKE ALL ON FUNCTION public.terravale_neon_staging_sheet_extras_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.terravale_neon_staging_sheet_extras_read(uuid) TO authenticated;
