/* V2.78 — first approval is persistent; level-ups are separate, single requests. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const html=read('published/veiled-codex/index.html');
const ui=read('site-overrides/v278-character-approvals.js');
const sql=read('site-overrides/sql/v278_character_approval_lifecycle.sql');
const py=read('tools/v278_character_approval_patch.py');
const overlay=read('tools/overlay-v239-with-discord.py');
const bridge=read('site-overrides/v246-real-characters.js');
assert.doesNotThrow(()=>new Function(ui));
assert.ok(html.includes("case 'approveCharacter':{if(db.role!=='dm')"));
assert.ok(html.includes('window.TerravaleV278Approval.approveInitial(id,el);'));
assert.ok(!html.includes("c.status='Approved';unlock('character_approved');persist();renderPage(false);toast('Character approved: '"),
 'Old local-only native approval handler must be replaced.');
assert.ok(html.includes('Reference notes · not a new approval'));
assert.ok(ui.includes("'terravale_dm_approve_initial_character'"));
assert.ok(ui.includes('if(!data?.approved)throw Error'),'UI must trust only server confirmed approval');
assert.ok(ui.includes("if(c)c.status='Approved'"));
assert.ok(ui.includes('await refresh();'));
assert.ok(ui.includes('pendingApprovals.has(id)'),'Double clicking approval must be idempotent');
assert.ok(ui.includes("'terravale_request_character_level_up'"));
assert.ok(ui.includes("'terravale_dm_decide_character_level_up'"));
assert.ok(ui.includes("r.proposed_changes?.kind==='level_up'"));
assert.ok(ui.includes("ch.status!=='Approved'||ch.owner!=='You'"));
assert.ok(ui.includes("root.querySelector('.tv255-overview-stats')")||
  ui.includes("root?.querySelector('.tv255-overview-stats')"));
assert.ok(!/fetch\s*\(|sendBeacon\s*\(/.test(ui),'No telemetry');
assert.ok(sql.includes('authz.is_dm(ch.campaign_id)'),'DM authorisation server-side');
assert.ok(sql.includes('authz.is_member(ch.campaign_id)'),'Member authorisation server-side');
assert.ok(sql.includes("provider='discord'"));
assert.ok(sql.includes("if ch.status='approved' then"),'Repeated approve must do nothing');
assert.ok(sql.includes("if ch.status<>'draft' or ch.owner_id is null"));
assert.ok(sql.includes("if ch.status<>'approved' then"),'Level-up only for approved characters');
assert.ok(sql.includes("if to_lv<>from_lv+1 or current_lv<>from_lv then"));
assert.ok(sql.includes("new_build := jsonb_set("));
assert.ok(sql.includes("status=decided_status"));
assert.ok(!sql.includes("set status='draft'"),'Level-up must not reset initial approval');
for(const fn of ['terravale_dm_approve_initial_character',
 'terravale_request_character_level_up','terravale_dm_decide_character_level_up']){
 assert.ok(sql.includes('function public.'+fn));
 assert.ok(sql.includes('revoke all on function public.'+fn));
 assert.ok(sql.includes('grant execute on function public.'+fn));
}
assert.ok(bridge.includes("const capture=ch=>JSON.stringify(Object.fromEntries"));
assert.ok(bridge.includes("!['status','ownerName','ownerUid','owner','remoteStatus'].includes(key)"));
assert.ok(overlay.includes('from v278_character_approval_patch import patch as patch_v278'));
assert.ok(overlay.includes('source = patch_v278(source)'));
assert.ok(html.includes('data-source="v278-character-approvals.js"'));
assert.ok(html.includes('Terravale Codex V2.83'));
console.log('PASS V2.78: one-time server approval, confirmed level-up requests and no local-only approval reset.');
