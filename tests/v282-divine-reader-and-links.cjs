/* V2.82 — full archive filters, source-exact Tier 0, domain-specific Favour relationships, prose renderer. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const ui=read('site-overrides/v270-divine-workspace.js');
const lib=read('site-overrides/v281-canonical-library.js');
const reader=read('site-overrides/v282-boon-reader.js');
const links=read('site-overrides/v282-divine-relationships.js');
const overlay=read('tools/overlay-v239-with-discord.py');
const published=read('published/veiled-codex/index.html');
const relationshipSQL=read('site-overrides/sql/v282_divine_relationships.sql');
const searchSQL=read('site-overrides/sql/v282_divine_catalog_filters.sql');
const formalSQL=read('site-overrides/sql/v282_source_exact_tier0.sql');
const awardSQL=read('site-overrides/sql/v282_award_reader_metadata.sql');
const logSQL=read('site-overrides/sql/v282_tier0_history.sql');
for(const js of [ui,lib,reader,links])assert.doesNotThrow(()=>new Function(js));
assert.ok(reader.includes('document.createTextNode'),'Inline rules must be text-backed');
assert.ok(!reader.includes('innerHTML'),'Never inject uploaded Markdown as HTML');
assert.ok(reader.includes('tv282-callout'),'Source warnings and notes must be formatted');
assert.ok(reader.includes('tv282-section-heading'),'Benefits and costs must be visually separated');
assert.ok(reader.includes('tv282-list')&&reader.includes('tv282-table'),
 'Bullets and mechanical tables must render natively');
assert.ok(lib.includes('terravale_divine_dm_archive_search_v282'));
for(const field of ['filter_family','filter_patron','filter_tier','filter_slot',
 'filter_availability','filter_uses','sort_by','page_offset'])
 assert.ok(lib.includes(field),'Full catalogue filter missing: '+field);
assert.ok(lib.includes('page_size:24'));
assert.ok(lib.includes('All gods')&&lib.includes('Tier ↑'));
assert.ok(lib.includes('terms:{source_exact:true'),'Tier 0 should reuse full source');
assert.ok(!lib.includes("promptReason('Story reason for granting"),
 'DM must be able to grant ordinary boons without explaining why');
assert.ok(lib.includes('Bestow accepted Tier 0 bargain'));
assert.ok(ui.includes('terravale_divine_canon_dm_record_bargain'));
assert.ok(ui.includes('TerravaleDivineReaderV282'));
assert.ok(ui.includes('terravale_divine_dm_set_favour_v282'));
assert.ok(ui.includes('apply_links:window.TerravaleDivineRelationsV282?.applies()??true'));
assert.ok(ui.includes('window.TerravaleDivineRelationsV282?.impactSummary'));
assert.ok(ui.includes('linked.id,Number(impact.score)'));
assert.ok(links.includes('Apply related effects to my next Favour adjustment'));
assert.ok(links.includes('terravale_divine_dm_relationship_config'));
assert.ok(links.includes('terravale_divine_dm_relationship_state'));
assert.ok(relationshipSQL.includes('enabled boolean not null default true'));
assert.ok(relationshipSQL.includes('and l.source_key=v_source_key and l.enabled'));
assert.ok(relationshipSQL.includes('delta>0'));
assert.ok(relationshipSQL.includes('hits:=progress_now/edge.every_increase'));
assert.ok(relationshipSQL.includes("('kalma','tyrius','pae')"));
assert.ok(relationshipSQL.includes('Indirec')||relationshipSQL.includes('indirect'));
assert.ok(relationshipSQL.includes('only')||relationshipSQL.includes('never'));
assert.ok(relationshipSQL.includes('favour_resonance'));
assert.ok(relationshipSQL.includes('applied:=applied||'));
assert.ok(searchSQL.includes('e.source_excerpt ilike'));
assert.ok(searchSQL.includes('authz.is_dm(target_campaign)'));
assert.ok(formalSQL.includes("source_exact boolean not null default false"));
assert.ok(formalSQL.includes("chosen_slot:='bargain'"));
assert.ok(formalSQL.includes("e.kind='tier_zero'"));
assert.ok(formalSQL.includes('explicit player acceptance'));
assert.ok(formalSQL.includes('source_exact'));
assert.ok(awardSQL.includes("'activation',e.activation"));
assert.ok(logSQL.includes('terravale_divine_canon_dm_record_bargain'));
for(const sql of [searchSQL,formalSQL,relationshipSQL,awardSQL,logSQL]){
 assert.ok(sql.includes('create or replace function')||sql.includes('CREATE OR REPLACE FUNCTION'));
 if(sql.includes('security definer'))assert.ok(sql.includes('revoke all on function'));
}
assert.ok(overlay.includes('v282-boon-reader.js'));
assert.ok(overlay.includes('v282-divine-relationships.js'));
assert.ok(published.includes('data-source="v282-boon-reader.js"'));
assert.ok(published.includes('data-source="v282-divine-relationships.js"'));
assert.ok(published.includes('Terravale Codex V2.82'));
console.log('PASS V2.82: source-exact Tier 0, optional lore reason, linked Favour, private full-archive filters and editorial boon reader.');
