/* V2.84 — one Concordant does not collide with an ordinary Major boon;
   full-length details never change card heights in the six-slot inventory. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const sql=read('site-overrides/sql/v284_concordant_seat.sql');
const meta=read('site-overrides/sql/v284_concordant_reader_metadata.sql');
const sheet=read('site-overrides/v270-divine-workspace.js');
const forge=read('site-overrides/v281-canonical-library.js');
const reader=read('site-overrides/v282-boon-reader.js');
const css=read('site-overrides/v284-concordant-reader.css');
const overlay=read('tools/overlay-v239-with-discord.py');
const html=read('published/veiled-codex/index.html');
for(const js of [sheet,forge,reader])assert.doesNotThrow(()=>new Function(js));
assert.ok(sql.includes("chosen_slot:='concordant'"),'Concordant must occupy dedicated sheet space');
assert.ok(sql.includes("if e.kind='concordant' then"),'Separated Concordant-specific grant logic missing');
assert.ok(sql.includes("'concordant','grace'"),'Concordant seat missing from server constraint');
assert.ok(sql.includes("if secondary='' or e.required_favour_second is null"),
 'Dual-patron Favour validation must stay enforced');
assert.ok(sql.includes('Only one active Concordant is allowed'),
 'A second active Concordant must be denied');
assert.ok(sql.includes("if desired in('passive','reaction','major') and chosen_slot<>desired"),
 'Original conventional source classifications should remain validated');
assert.ok(sql.includes("z.kind='divine'"),'Concordants must not block conventional patron slots');
assert.ok(forge.includes("item.kind==='concordant'?'concordant':slotValue(item)"),
 'DM grant must send the special Concordant seat, not Major');
assert.ok(forge.includes("if(item.kind==='divine'&&!picked)"),
 'Concordants must not display the ordinary Major-slot selector');
assert.ok(forge.includes('Dedicated Concordant slot'));
assert.ok(meta.includes("'source_slot',e.slot"),
 'The original Major/Reaction/Passive source classification must remain accessible');
assert.ok(reader.includes("entry.source_slot||entry.slot"),
 'The reader must not mistake inventory seat for original activation/Favour slot');
assert.ok(reader.includes("entry.kind==='concordant'?'Concordant'"));
assert.ok(sheet.includes("const detailPanel=node('section','tv284-boon-inspector')"));
assert.ok(sheet.includes('const awardedControls=new Map()'));
assert.ok(sheet.includes('detailPanel.setAttribute(\'aria-label\''));
assert.ok(sheet.includes('sheet.inspectedAward=g.id'));
assert.ok(sheet.includes('left.append(detailPanel)'));
assert.ok(sheet.includes('const selectedAward=bestowed.find'));
const start=sheet.indexOf('const renderGranted=(target,g)=>{');
const finish=sheet.indexOf('for(const group of familiesForSlots){',start);
assert.ok(start>0&&finish>start);
const card=sheet.slice(start,finish);
assert.ok(!card.includes("node('details'"),'No long ability reader inside a card');
assert.ok(card.includes('tv284-read-gift'));
assert.ok(card.includes('awardedControls.set(g.id'));
assert.ok(css.includes('.tv284-boon-inspector[hidden]'));
assert.ok(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
assert.ok(css.includes('min-height:158px'));
assert.ok(css.includes('tv284-compact-award'));
assert.ok(overlay.includes('v284-concordant-reader.css'));
assert.ok(html.includes('tv284-boon-inspector'));
assert.ok(html.includes('Terravale Codex V2.85'));
console.log('PASS V2.84: shared Concordant dedicated seat, original source slot, 3×2 stable cards and single external reader.');
