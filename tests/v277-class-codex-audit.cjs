/* V2.77: Class Codex level readers update in place; full-page rerenders forbidden. */
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const read=path=>fs.readFileSync(path,'utf8');
const html=read('published/veiled-codex/index.html');
const patch=read('tools/v277_class_scroll_patch.py');
const stability=read('site-overrides/v277-class-stability.js');
const css=read('site-overrides/v277-class-stability.css');
const overlay=read('tools/overlay-v239-with-discord.py');
assert.doesNotThrow(()=>new Function(stability));
assert.ok(html.includes('function v277UpdateProgression(id,trigger,mode)'),
 'Native V2.32 level and feature handlers must update only their reader');
assert.ok(html.includes('if(lv&&v277UpdateProgression(id,lv,'),
 'Level buttons must no longer immediately rebuild the entire page');
assert.ok(html.includes('if(f&&v277UpdateProgression(id,f,'),
 'Feature selection must preserve list focus and page scroll');
assert.ok(html.includes('if(o&&v277UpdateOptions(id,o))return;'),
 'Class option changes must also update within their own reference card');
assert.ok(html.includes('if(window.TerravaleV277RefreshPath?.(b))return;'),
 'Path-level buttons must update their reading content in place');
assert.ok(html.includes('current.replaceWith(replacement)'),
 'Level detail must update in place');
assert.ok(html.includes('oldArticle.replaceWith(newArticle)'),
 'Switching individual features should preserve the feature list');
assert.ok(html.includes('v277KeepHeight(replacement,current,reader)'),
 'Shrinking level details must not clamp the document scroll position');
assert.ok(html.includes('const anchorTop=grid.getBoundingClientRect().top;'),
 'Level grid should be used as a stable visual scroll anchor');
assert.ok(html.includes('function v280PreserveScroll()'),
 'Class interaction must preserve absolute viewport without forced scroll-by');
assert.ok(html.includes('const old=reader.querySelector('),
 'Path details should also update only their own content');
assert.ok(html.includes('v232-progression-table'),
 'Original full progression table remains available');
assert.ok(!html.includes("window.TV33_PATH_LEVELS[b.dataset.v233For]=b.dataset.v233PathStep;renderPage(false);"),
 'Old class path-level full-page redraw must be replaced');
assert.ok(!html.includes("if(f)classFeature[id]=Number(f.dataset.v232Feature);renderPage(false);},true);"),
 'Old class feature full-page redraw must be replaced');
assert.ok(stability.includes('class-level-card>summary')||stability.includes('class-level-card>summary'.replace('class-','class-')),
 'Class rule accordions should have stable summary anchors');
assert.ok(stability.includes("root?.classList.contains('page-reference')"),
 'Accordion guard must not intercept session or character-sheet interactions');
assert.ok(stability.includes('summary.getBoundingClientRect().top'));
assert.ok(stability.includes("block.open&&remaining<collapseHeight+30"),
 'Near-bottom collapsing accordions must avoid unexpected scroll clamp');
assert.ok(!/sendBeacon\s*\(|fetch\s*\(|\.rpc\s*\(/.test(stability),'No network telemetry');
assert.ok(css.includes('overflow-anchor:none'));
assert.ok(overlay.includes('from v277_class_scroll_patch import patch as patch_v277'));
assert.ok(overlay.includes('source = patch_v277(source)'));
assert.ok(html.includes('data-source="v277-class-stability.js"'));
assert.ok(html.includes('Terravale Codex V2.81'));
console.log('PASS V2.77 Class Codex: in-place levels/features/paths, preserved progression table, stable summary scroll and no page-wide redraw.');
