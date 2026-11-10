/* V2.83 — prevent the Divine Chronicle's 534-boon filters turning into
   a giant scrolling multi-column settings page. */
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');
const lib=read('site-overrides/v281-canonical-library.js');
const css=read('site-overrides/v283-compact-filters.css');
const overlay=read('tools/overlay-v239-with-discord.py');
const html=read('published/veiled-codex/index.html');
assert.doesNotThrow(()=>new Function(lib));
assert.ok(lib.includes('tv283-filter-toolbar'),'Compact toolbar missing');
assert.ok(lib.includes('tv283-filter-popover'),'On-demand anchored filter palette missing');
assert.ok(lib.includes('tv283-patron-search'),'God-specific searchable picker missing');
assert.ok(lib.includes('results.slice(0,9)'),'God picker must cap the number of visible results');
assert.ok(!lib.includes('tv282-patron-chips'),'Old scrolling patron chip wall must not mount');
assert.ok(!lib.includes('tv282-filter-row'),'Old huge three-column grid must not mount');
assert.ok(!lib.includes('advanced.open=true'),'Advanced filters should not auto-expand');
assert.ok(!lib.includes('control.append(search,pick)'),'Old sprawling filters must not mount');
assert.ok(lib.includes('position:absolute')||css.includes('position:absolute'),
 'Opening a filter must not push the document down');
assert.ok(css.includes('.tv283-filter-popover'));
assert.ok(css.includes('z-index:35'));
assert.ok(css.includes('overflow:visible;scrollbar-gutter:auto'),
 'Native page scroll should replace nested results scroll');
assert.ok(lib.includes('document.addEventListener(\'pointerdown\',dismissOutside)'));
assert.ok(lib.includes('document.addEventListener(\'keydown\',dismissEscape)'));
assert.ok(lib.includes("if(e.key==='Escape'&&openFilter)"));
assert.ok(lib.includes('const defaults={kind:'));
assert.ok(lib.includes('Object.assign(options,defaults)'),'Reset must clear all facets');
for(const key of ['kind','patron','tier','availability','slot','uses','sort','query'])
 assert.ok(lib.includes(key),'Existing facet lost '+key);
for(const name of ['filter_family','filter_patron','filter_tier','filter_slot',
 'filter_availability','filter_uses','sort_by','page_size:24'])
 assert.ok(lib.includes(name),'Full-catalogue RPC is missing '+name);
assert.ok(css.includes('@media(max-width:600px)'),'Mobile filter layout missing');
assert.ok(css.includes('.tv283-filter-active:empty{display:none}'));
assert.ok(overlay.includes('v283-compact-filters.css'));
assert.ok(html.includes('tv283-filter-toolbar'));
assert.ok(html.includes('Terravale Codex V2.84'));
console.log('PASS V2.83: compact no-scrollbar filters, searchable god picker, complete facets and responsive toolbar.');
