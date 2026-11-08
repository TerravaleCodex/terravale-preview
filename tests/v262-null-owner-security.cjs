/* V2.62: security-definer server actions must never treat NULL owner as equality. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('site-overrides/sql/v262_null_owner_rpc_security.sql','utf8');
const funcs=[
 'terravale_wallet_self_adjust','terravale_save_starting_proficiencies',
 'terravale_send_item_to_dm_vault','terravale_item_action','terravale_item_rest',
 'terravale_send_backpack_item','terravale_wallet_transfer',
 'set_character_sheet_visibility','set_player_character_summary',
 'set_character_portrait'
];
for(const fn of funcs){
 const pattern=new RegExp('CREATE OR REPLACE FUNCTION public\\.'+fn+'\\(');
 assert.match(source,pattern,fn+' retained existing function signature');
}
assert.equal((source.match(/CREATE OR REPLACE FUNCTION public\./g)||[]).length,10);
assert.equal((source.match(/SECURITY DEFINER/g)||[]).length,11,'10 unchanged SECURITY DEFINER functions plus header reference');
for(const invalid of [
 'ch.owner_id<>caller','src.owner_id<>caller','not (ch.owner_id=actor',
 'not (src.owner_id=sender','not (src.owner_id=caller',
 'not (target.owner_id=(select auth.uid())'
])assert.ok(!source.includes(invalid),'Forbidden null-owner bypass: '+invalid);
for(const expected of [
 'ch.owner_id IS DISTINCT FROM caller',
 'src.owner_id IS DISTINCT FROM caller',
 'coalesce(ch.owner_id=actor,false)',
 'coalesce(src.owner_id=sender,false)',
 'coalesce(src.owner_id=caller,false)',
 'coalesce(target.owner_id=(select auth.uid()),false)',
 'coalesce(target.owner_id = (select auth.uid()),false)',
 'coalesce(ch.owner_id=(select auth.uid()),false)'
])assert.ok(source.includes(expected),'Missing null-safe authorization '+expected);
const wallet=fs.readFileSync('site-overrides/v255-native-wallet.js','utf8');
assert.ok(wallet.includes('else if(validRole(c))breakdown.append(manager)'));
assert.ok(wallet.includes("c?.sheetVisibleToParty===true"));
console.log('PASS: ten null-safe server ownership guards; approved shared wallets stay read-only');
