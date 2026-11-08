/* Terravale V2.63: compact equipment and shared wallet access regression. */
const assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');
const read=p=>fs.readFileSync(p,'utf8');
const loader=read('site-overrides/v254-character-proficiencies-wallet.js');
const wallet=read('site-overrides/v255-native-wallet.js');
const inventory=read('site-overrides/v250-dm-backpack-editor.js');
const view=read('site-overrides/v263-compact-equipment-preview.js');
const styles=read('site-overrides/v263-compact-equipment-preview.css');
const overlay=read('tools/overlay-v239-with-discord.py');
const html=read('published/veiled-codex/index.html');
assert.match(loader,/const canRead=c=>isOwner\(c\)\|\|isDm\(c\)\|\|!!\(/,'Shared wallets must load');
assert.ok(loader.includes("String(c.status).toLowerCase()==='approved'"));
assert.ok(loader.includes('c.sheetVisibleToParty===true'));
assert.ok(loader.includes('bridge()?.hasCampaign?.(c.campaign)'));
assert.ok(loader.includes('if(!canRead(c))return;'),'Private wallet still blocked');
assert.ok(wallet.includes("db.role==='dm'&&window.TerravaleVerifiedAccount"),'Player preview hides DM mutation tools');
assert.ok(wallet.includes('c.sheetVisibleToParty===true'));
assert.ok(wallet.includes('if(!canRead(c))'));
assert.ok(wallet.includes("const renderConverted=(delta)=>"),'The currency carousel remains interactive for read-only viewers');
assert.ok(wallet.includes('viewWallet(host,c,result,refresh,isDm)'),'Converter redraws only display');
assert.ok(wallet.includes('else if(validRole(c))breakdown.append(manager)'),'Mutating money controls are permission gated');
assert.ok(!inventory.includes('Items with recorded mechanics'));
assert.ok(!inventory.includes('marker.append(stats)'), 'No duplicated mechanics surface');
for(const needle of [
  '.sheet21-backpack-heading','.sheet21-backpack-zone',
  'openFor.set(c.id,Boolean(open))','zone.hidden=!open',
  'data-tv263-item-id','tv263-inspect-item','tv263-item-inspector',
  'function matchItem(c,card)','function inspect(c,item)',
  'p.features','p.recovery','p.damage_dice','p.damage_type','p.ac_bonus',
  'p.max_charges','p.rarity','p.attunement','p.attuned',
  'event.target===dialog','target.closest(\'button,a,input,textarea,select,summary,[data-action],[data-tv-item-action]\')'
])assert.ok(view.includes(needle),'Missing preview/collapse feature: '+needle);
assert.ok(view.includes("const actions=card.querySelector('.sheet21-item-actions,.sheet22-slot-actions')"),'Native controls left intact');
assert.ok(!view.includes('.removeChild('),'Does not remove native draggable items');
assert.ok(styles.includes('tv263-backpack-collapsed .sheet21-backpack-zone'),'Backpack can fold independently');
assert.ok(styles.includes('.tv263-item-inspector::backdrop'),'Accessible item preview overlay styling');
assert.ok(!styles.includes('#tv254-sheet-wallet{display:none'),'Never conceal wallet');
assert.ok(overlay.includes('v263-compact-equipment-preview.css'));
assert.ok(overlay.includes('v263-compact-equipment-preview.js'));
assert.equal((html.match(/data-source="v263-compact-equipment-preview.js"/g)||[]).length,1);
assert.ok(html.includes('V2.63'));
cp.execFileSync('node',['--check','site-overrides/v263-compact-equipment-preview.js']);
cp.execFileSync('node',['--check','site-overrides/v254-character-proficiencies-wallet.js']);
cp.execFileSync('node',['--check','site-overrides/v255-native-wallet.js']);
cp.execFileSync('node',['--check','site-overrides/v250-dm-backpack-editor.js']);
console.log('PASS V2.63: native backpack collapses without concealing wallet; equipment mechanics only in click preview; shared currency conversion is read-only.');
