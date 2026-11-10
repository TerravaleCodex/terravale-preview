/* V2.80 — no forced level-scroll; permanent divine slots and compact gods. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const html=read('published/veiled-codex/index.html');
const py=read('tools/v280_class_scroll_patch.py');
const source=read('site-overrides/v270-divine-workspace.js');
const css=read('site-overrides/v280-divine-sheet.css');
const bridge=read('site-overrides/v246-real-characters.js');
const approval=read('site-overrides/v278-character-approvals.js');
const overlay=read('tools/overlay-v239-with-discord.py');
assert.doesNotThrow(()=>new Function(source));
assert.ok(html.includes('function v280PreserveScroll()'),
  'In-place class reader replacement must protect viewport.');
assert.ok(html.includes("html.style.overflowAnchor='none'"));
assert.ok(html.includes('const restoreScroll=v280PreserveScroll();'));
const reanchor=html.slice(html.indexOf('function v277Reanchor(element,top){'),
 html.indexOf('function v277Reanchor(element,top){')+280);
assert.ok(reanchor.includes('Intentionally disabled')&&!reanchor.includes('window.scrollBy('),
 'The Class Codex reanchor must never scroll the page.');
assert.ok(html.includes('restoreScroll();'));
assert.ok(html.includes('function v277UpdateProgression(id,trigger,mode)'));
assert.ok(html.includes("if(lv&&v277UpdateProgression(id,lv,'level'))return;"));
assert.ok(html.includes('v277KeepHeight(replacement,current,reader)'));
assert.ok(py.includes('v280PreserveScroll'));
assert.ok(source.includes("const layout=node('div','tv280-sheet-layout')"));
assert.ok(source.includes("const left=node('section','tv280-gifts')"));
assert.ok(source.includes("const aside=node('aside','tv280-gods-rail')"));
assert.ok(source.includes("const slots=node('div','tv280-boon-slots')"));
assert.ok(source.includes("slot.classList.add('tv280-slot-empty')"));
assert.ok(source.includes("count:3,filter:g=>g.kind==='divine'"));
assert.ok(source.includes("count:1,filter:g=>g.kind==='concordant'"));
assert.ok(source.includes("count:1,filter:g=>g.kind==='minor_grace'"));
assert.ok(source.includes("count:1,filter:g=>g.kind==='minor_intercession'"));
assert.ok(!source.includes('Browse the major pantheon'),
 'Remove the large redundant pantheon browser, not the gods themselves.');
assert.ok(source.includes('Original rules are preserved'),
 'Canonical source must be preserved while explicitly-defined trackers are automated.');
assert.ok(css.includes('grid-template-columns:minmax(0,3fr) minmax(235px,1fr)'));
assert.ok(css.includes('@media(max-width:850px)'));
assert.ok(bridge.includes("status:row.status==='approved'?'Approved':'Pending'"),
 'Server status must decide whether a character is approved.');
assert.ok(approval.includes("if(!data?.approved)throw Error"),
 'Approval must stay a server-confirmed event.');
assert.ok(overlay.includes('source = patch_v280(source)'));
assert.ok(html.includes('Terravale Codex V2.81'));
console.log('PASS V2.80: Class Codex has no forced scrolling, Divine slot layout and server-authoritative approval preserved.');
