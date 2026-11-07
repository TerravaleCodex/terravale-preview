-- V2.48: grant every curated real demo sheet a verified starting ancestry feat
-- from the original published V2.39 authoritative rules manifest. These IDs
-- are exact (no invented feat names or effects).
with chosen(slot,feat_id,feat_stat,feat_name) as (
 values
(1,'crimsonborn:hunter-s-instinct','DEX','Hunter''s Instinct'),
(2,'beastfolk:environmental-truthsense','WIS','Environmental Truthsense'),
(3,'elf:long-memory','INT','Long Memory'),
(4,'dvergr:stone-enduring','CON','Stone-Enduring'),
(5,'flugel:controlled-descent','DEX','Controlled Descent'),
(6,'human:opportunistic-thinker','INT','Opportunistic Thinker'),
(7,'flugel:aether-tuned-resilience','WIS','Aether-Tuned Resilience')
), originals as (
 update public.terravale_demo_presets p
 set approved_build=
   jsonb_set(
    jsonb_set(
     jsonb_set(
      jsonb_set(p.approved_build,'{character,ancestryFeats}',to_jsonb(array[ch.feat_id]),true),
      '{character,rulesV217,ancestryFeat}',to_jsonb(ch.feat_id),true),
     '{character,rulesV217,featAbilityStat}',to_jsonb(ch.feat_stat),true),
    '{character,startingAncestryFeatName}',to_jsonb(ch.feat_name),true)
 from chosen ch where ch.slot=p.slot
 returning p.slot,p.approved_build
)
update public.characters c
set approved_build=
   jsonb_set(
    jsonb_set(
     jsonb_set(
      jsonb_set(c.approved_build,'{character,ancestryFeats}',
         o.approved_build #> '{character,ancestryFeats}',true),
      '{character,rulesV217,ancestryFeat}',
         o.approved_build #> '{character,rulesV217,ancestryFeat}',true),
     '{character,rulesV217,featAbilityStat}',
         o.approved_build #> '{character,rulesV217,featAbilityStat}',true),
    '{character,startingAncestryFeatName}',
         o.approved_build #> '{character,startingAncestryFeatName}',true)
from public.terravale_demo_curator_credits cc
join originals o on o.slot=cc.template_slot
where c.id=cc.character_id;

-- Guard against silently regressing to empty demo feat selections.
do $checks$
declare invalid_count integer;
begin
 select count(*) into invalid_count
 from public.terravale_demo_presets
 where not (approved_build #> '{character,ancestryFeats}' @> '[""]'::jsonb)
   and (jsonb_typeof(approved_build #> '{character,ancestryFeats}') <> 'array'
    or jsonb_array_length(approved_build #> '{character,ancestryFeats}') <> 1);
 if invalid_count<>0 then raise exception 'Demo feat presets incomplete: %',invalid_count; end if;
end $checks$;
