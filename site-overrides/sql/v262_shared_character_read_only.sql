-- V2.62: Let members read the mechanics of characters explicitly approved
-- and shared by their campaign. No INSERT, UPDATE, DELETE or grant permissions.
-- Ownership, DM role and server-side RPC guards are deliberately unchanged.
begin;
create policy tv262_shared_feat_grants_read
 on public.terravale_character_custom_feats
 for select to authenticated
 using (
  exists (
   select 1 from public.characters c
    where c.id=terravale_character_custom_feats.character_id
      and c.campaign_id=terravale_character_custom_feats.campaign_id
      and c.status='approved'
      and c.sheet_visible_to_party
      and authz.is_member(c.campaign_id)
  )
 );
create policy tv262_shared_feat_definitions_read
 on public.terravale_dm_custom_feats
 for select to authenticated
 using (
  exists (
   select 1 from public.terravale_character_custom_feats g
    join public.characters c on c.id=g.character_id
    where g.feat_id=terravale_dm_custom_feats.id
      and g.campaign_id=terravale_dm_custom_feats.campaign_id
      and g.status='active'
      and c.campaign_id=g.campaign_id
      and c.status='approved'
      and c.sheet_visible_to_party
      and authz.is_member(c.campaign_id)
  )
 );
create policy tv262_shared_character_wallet_read
 on public.terravale_character_wallet
 for select to authenticated
 using (
  exists (
   select 1 from public.characters c
    where c.id=terravale_character_wallet.character_id
      and c.status='approved'
      and c.sheet_visible_to_party
      and authz.is_member(c.campaign_id)
  )
 );
create policy tv262_shared_training_read
 on public.terravale_character_training_overrides
 for select to authenticated
 using (
  exists (
   select 1 from public.characters c
    where c.id=terravale_character_training_overrides.character_id
      and c.status='approved'
      and c.sheet_visible_to_party
      and authz.is_member(c.campaign_id)
  )
 );
commit;
