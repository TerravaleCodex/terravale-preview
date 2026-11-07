-- Pip's chosen published Beastfolk feat requires a Perception classification.
-- Record the selected demo classification on the starting sheet and template
-- so its prerequisite is explicit rather than silently implied.
update public.terravale_demo_presets p
set approved_build=
  jsonb_set(
   jsonb_set(
    jsonb_set(p.approved_build,'{character,classification}',to_jsonb('Perception'::text),true),
   '{character,animalFamily}',to_jsonb('Feline'::text),true),
  '{character,rulesV217,classification}',to_jsonb('Perception'::text),true)
where p.slot=2;
update public.characters c
set approved_build=
  jsonb_set(
   jsonb_set(
    jsonb_set(c.approved_build,'{character,classification}',to_jsonb('Perception'::text),true),
    '{character,animalFamily}',to_jsonb('Feline'::text),true),
    '{character,rulesV217,classification}',to_jsonb('Perception'::text),true)
from public.terravale_demo_curator_credits credit
where credit.character_id=c.id and credit.template_slot=2;
