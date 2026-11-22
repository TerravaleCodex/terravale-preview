'use strict';
/* Staging migration audit — inspect the actual built V2.87 source, not an
   invented resource model. This prints only public-safe source code fragments
   to GitHub Actions; never prints real character or database records. */
const fs=require('node:fs'),assert=require('node:assert/strict');
const html=fs.readFileSync('published/veiled-codex/index.html','utf8');
assert.ok(html.length>7_000_000&&html.includes('data-source="v287-adaptive-resources.js"'),
 'Actual assembled V2.87 native page required');
const probes=[
 ['native-resources-fn', /function\s+sheetV220ResourcesPanel\s*\(/g],
 ['native-resource-buttons', /v234-resource-item/g],
 ['native-resources-object', /sheetV220\??\.resources/g],
 ['state-resource-save', /resources\s*:\s*(?:c\.|character\.|.*?resources)/g],
 ['resource-action-handler', /(?:data-action|dataset\.action|case)\s*[:=]\s*['"][^'"]*resource[^'"]*['"]/gi],
 ['spell-slots', /(?:spellSlots|spell_slots|spellSlot|slotCurrent|slotsRemaining)/g],
 ['spell-grid', /v234-spell-grid/g],
 ['class-resources', /v234-resource-line/g],
 ['save-sheet-rpc', /terravale_save_character_sheet/g],
 ['state-write-rpc', /(?:terravale_update_character_state|terravale_save_character_state|terravale_character_state_update)/g]
];
function clean(x){return x.replace(/\s+/g,' ').slice(0,650)}
for(const [label,re] of probes){
 const matches=[...html.matchAll(re)];
 console.log('SOURCE RESOURCE AUDIT '+label+' COUNT '+matches.length);
 for(const m of matches.slice(0,8)){
  const at=m.index;
  // Only source logic from bundled public-safe site, never runtime data.
  const before=Math.max(0,at-190),after=Math.min(html.length,at+550);
  console.log('SOURCE SNIPPET '+label+' @'+at+': '+clean(html.slice(before,after)));
 }
}
const native=html.match(/function\s+sheetV220ResourcesPanel\s*\(/);
assert.ok(native,'Cannot audit V2.87 without its actual native resource renderer');
// Audit explicitly, but do not falsely assert resource persistence until
// database/state and exact write-path logic have been verified.
console.log('PASS: approved V2.87 resource source audited; no source data modified.');
