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
        'dm_bonus',p.dm_bonus,'submitted',p.submitted)
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
    'bonus_requests',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',q.id,'kind',q.kind,'choice_pool',q.choice_pool,
        'choice_count',q.choice_count,'status',q.status,
        'note',q.note,'created_at',q.created_at)
        ORDER BY q.created_at)
      FROM (SELECT p.id,p.kind,p.choice_pool,p.choice_count,p.status,
               p.note,p.created_at
            FROM public.terravale_proficiency_bonus_choices p
            WHERE p.character_id=selected.id AND p.status='pending'
            ORDER BY p.created_at LIMIT 60) q
    ),'[]'::jsonb),
    'wallet_ledger',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',w.id,'denomination_id',w.denomination_id,'delta',w.delta,
        'note',w.note,'operation',w.operation,'created_at',w.created_at)
        ORDER BY w.created_at DESC)
      FROM (SELECT l.id,l.denomination_id,l.delta,l.note,l.operation,l.created_at
            FROM public.terravale_wallet_ledger l
            WHERE l.character_id=selected.id
            ORDER BY l.created_at DESC LIMIT 7) w
    ),'[]'::jsonb),
    'custom_feats',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',x.id,'feat_id',x.feat_id,'name',x.name,'summary',x.short_description,
        'rules',x.rules_text,'prerequisites',x.prerequisites,
        'rarity',x.rarity,'action_type',x.action_type,
        'uses_per_rest',x.uses_per_rest,'recovery',x.recovery)
        ORDER BY x.name)
      FROM (SELECT g.id,f.id AS feat_id,f.name,f.short_description,f.rules_text,
              f.prerequisites,f.rarity,f.action_type,f.uses_per_rest,f.recovery
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
        'mechanics',x.mechanics,'patron',x.patron,'other_patron',x.other_patron,
        'max_charges',x.max_charges,'charges_remaining',x.charges_remaining,
        'recovery',x.recovery) ORDER BY x.name)
      FROM (SELECT g.id,b.name,b.kind,b.summary,b.mechanics,p.name AS patron,
              q.name AS other_patron,b.max_charges,
              COALESCE(g.charges_remaining,b.max_charges) AS charges_remaining,
              b.recovery
            FROM public.terravale_character_divine_boons g
            JOIN public.terravale_dm_divine_boons b ON b.id=g.boon_id
              AND b.campaign_id=selected.campaign_id
            JOIN public.terravale_divine_patrons p ON p.id=b.patron_id
              AND p.campaign_id=selected.campaign_id
            LEFT JOIN public.terravale_divine_patrons q ON q.id=b.second_patron_id
              AND q.campaign_id=selected.campaign_id
            WHERE g.character_id=selected.id AND g.status='active'
            ORDER BY b.name,g.id LIMIT 100) x
    ),'[]'::jsonb),
    'canonical_awards',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',x.id,'name',x.name,'kind',x.kind,'slot',x.slot,'tier',x.tier,
        'source_heading',x.source_heading,'summary',x.source_heading,
        'source_kind','canonical','mechanics',x.source_excerpt,
        'patron',x.patron,'other_patron',x.other_patron,
        'source_slot',x.source_slot,'activation',x.activation,
        'uses_text',x.uses_text,'max_charges',x.max_uses,
        'charges_remaining',x.uses_remaining,'max_uses',x.max_uses,
        'uses_remaining',x.uses_remaining,'available_at',x.next_available_at,
        'recovery',x.recovery,'chosen_ability',x.chosen_ability)
        ORDER BY x.name)
      FROM (SELECT a.id,e.name,e.kind,e.tier,e.source_heading,e.source_excerpt,
              e.patron,e.other_patron,e.slot AS source_slot,e.activation,
              e.uses_text,a.slot,a.max_uses,a.uses_remaining,a.recovery,
              a.chosen_ability,a.next_available_at
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
    ,'divine_previews',COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key',p.key_name,'name',p.name,
        'rank',p.rank,'hint',p.public_hint) ORDER BY p.name)
      FROM public.terravale_divine_patrons p
      WHERE p.campaign_id=selected.campaign_id AND p.rank IN ('major','greater')
    ),'[]'::jsonb)
    -- The raw score is used ONLY inside the player RPC's coarse label.
    ,'divine_dispositions',COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key',p.key_name,'disposition',
        CASE WHEN f.score<=-6 THEN 'ominous'
             WHEN f.score<=-1 THEN 'cold'
             WHEN f.score<=2 THEN 'veiled'
             WHEN f.score<=7 THEN 'watchful'
             ELSE 'favoured' END) ORDER BY p.name)
      FROM public.terravale_divine_favour f
      JOIN public.terravale_divine_patrons p
        ON p.id=f.patron_id AND p.campaign_id=selected.campaign_id
      WHERE f.character_id=selected.id AND p.rank IN ('major','greater')
    ),'[]'::jsonb)
    ,'divine_state',COALESCE((
      SELECT jsonb_build_object('entanglement',s.entanglement,
        'divine_pressure',s.divine_pressure,
        'minor_intercession_remaining',s.minor_intercession_remaining)
      FROM public.terravale_divine_canon_state s WHERE s.character_id=selected.id
    ),jsonb_build_object('entanglement',0,'divine_pressure',0,
      'minor_intercession_remaining',1))
    ,'divine_burdens',COALESCE((
      SELECT jsonb_agg(jsonb_build_object('patron',b.patron_key,
        'name',b.burden_name,'stacks',b.stacks,
        'overflow_pending',b.overflow_pending) ORDER BY b.patron_key)
      FROM public.terravale_divine_canon_burdens b
      WHERE b.character_id=selected.id AND (b.stacks>0 OR b.overflow_pending)
    ),'[]'::jsonb)
    ,'divine_fractures',COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id',f.id,'chain',f.chain,
        'consequence',f.consequence,'award_id',f.award_id)
        ORDER BY f.created_at)
      FROM public.terravale_divine_canon_fractures f
      WHERE f.character_id=selected.id AND f.resolved_at IS NULL
    ),'[]'::jsonb)
    -- Only disclosed player offers; never include DM notes or undisclosed candidates.
    ,'divine_offers',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',o.id,'entry_id',o.entry_id,'title',e.name,'patron',e.patron,
        'kind',e.kind,'source_mechanics',e.source_excerpt,
        'source_exact',o.source_exact,'clarifications',o.clarifications,
        'benefit',o.benefit,'certain_price',o.certain_price,
        'affected_parties',o.affected_parties,'duration',o.duration,
        'reversibility',o.reversibility,
        'uncertainty_boundary',o.uncertainty_boundary,
        'fracture_chain',o.fracture_chain,'status',o.status,
        'offered_at',o.offered_at,'responded_at',o.responded_at)
        ORDER BY o.offered_at DESC)
      FROM public.terravale_divine_canon_offers o
      JOIN public.terravale_divine_archive_entries e
        ON e.id=o.entry_id AND e.campaign_id=selected.campaign_id
      WHERE o.character_id=selected.id AND
        o.status IN ('offered','accepted','fulfilled')
    ),'[]'::jsonb)
  );
END
$fn$;
REVOKE ALL ON FUNCTION public.terravale_neon_staging_sheet_extras_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.terravale_neon_staging_sheet_extras_read(uuid) TO authenticated;
