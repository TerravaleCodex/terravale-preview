const fs=require('node:fs');const assert=require('node:assert/strict');const path=require('node:path');
const root=path.join(__dirname,'..');
const load=edition=>JSON.parse(fs.readFileSync(path.join(root,'site-overrides/spells/srd-'+edition+'.json'),'utf8'));
const a=load('2014'),b=load('2024'),all=[...a,...b];
assert.equal(a.length,319,'2014 SRD spell count');
assert.equal(b.length,339,'2024 SRD spell count');
assert.equal(new Set(all.map(s=>s.id)).size,all.length,'unique edition-qualified spell ids');
for(const [edition,spells] of [['2014',a],['2024',b]]){
 for(const spell of spells){
  assert.equal(spell.edition,edition);
  assert.match(spell.id,edition==='2014'?/^srd51:/:/^srd521:/);
  assert.ok(spell.name&&spell.school&&spell.description,'spell identity and descriptions');
  assert.ok(spell.level>=0&&spell.level<=9,'spell level');
  assert.ok(spell.castingTime&&spell.range&&spell.duration,'casting stats');
  assert.ok(Array.isArray(spell.classes)&&Array.isArray(spell.components),'list metadata');
  assert.equal(typeof spell.ritual,'boolean');
  assert.equal(typeof spell.concentration,'boolean');
 }
 for(let level=0;level<=9;level++)assert.ok(spells.some(s=>s.level===level),'missing spell level '+level);
 assert.ok(spells.some(s=>s.name==='Fireball'),'edition lacks Fireball');
}
const client=fs.readFileSync(path.join(root,'site-overrides/v290-spell-library.js'),'utf8');
const css=fs.readFileSync(path.join(root,'site-overrides/v290-spell-library.css'),'utf8');
assert.match(client,/tv-spells-page/);
assert.match(client,/data-srd-edition/);
assert.match(client,/data-srd-level/);
assert.match(client,/tv-spell-ritual/);
assert.match(client,/tv-spell-concentration/);
assert.match(client,/location.hash/);
assert.match(css,/#tv-spells-page/);
assert.match(client,/nativeSelect\.replaceWith\(select\)/,'native select menus must be replaced');
assert.match(client,/select\.type='hidden'/,'only hidden value adapter remains');
assert.match(css,/--sl-panel:var\(--surface/,'panel should follow live theme');
assert.match(css,/--sl-purple:var\(--accent/,'highlight should follow live theme');
assert.match(css,/\.tv-spell-select-menu/,'custom dropdown styling must exist');
assert.doesNotMatch(client,/terravale_register_ad_dismissal|\.from\(["']characters["']\)/,'reference page must remain read-only');
console.log('PASS: 658 edition-specific spells validated with V2 library interface and no sheet mutations.');
