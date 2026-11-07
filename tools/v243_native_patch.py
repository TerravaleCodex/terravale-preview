#!/usr/bin/env python3
"""Targeted V2.43 changes to the approved V2 app, preserving the existing lore."""
import re

def patch(source):
    def once(old,new,desc):
        nonlocal source
        count=source.count(old)
        if count!=1:
            raise AssertionError(f"{desc}: expected one anchor, got {count}")
        source=source.replace(old,new,1)

    once('<span class="tag">OFFLINE PREVIEW</span>','','Live account header')
    once('title="Demo account — no sign-in or personal data"','title="Verified Discord account"','Live account title')
    once("function renderCreate(){return renderCreatorV2()}",
        """function renderCreate(){
 const campaign=db.campaigns.find(c=>c.id===db.campaign&&c.status!=='Archived');
 if(!campaign||!window.TerravaleV2Bridge?.canCreate?.(campaign.id)){
  return pageHeader('THE ADVENTURER’S STUDIO','Join a campaign first','A character belongs to a campaign.')+
   empty('Join a campaign to continue','Use TV-DEMO for The Wayfarers’ Table, or ask your DM for an invitation.','/campaigns','Choose a campaign')+foot();
 }
 return renderCreatorV2();
}""","Character creator guard")
    once("function creatorDoSave(){for(let i=0;",
        """function creatorDoSave(){
 if(!window.TerravaleV2Bridge?.canCreate?.(db.campaign)){
  toast('Join a campaign before creating a character');navigate('/campaigns');return;
 }
 for(let i=0;""","Wizard save guard")
    once("const id=key('char'),attrs=Object.fromEntries",
        "const identity=window.TerravaleVerifiedAccount?.state.profile;const id=key('char'),attrs=Object.fromEntries",
        "Creator account identity")
    once("status:'Pending',owner:'You',backstory:d.backstory.trim()",
        "status:'Pending',owner:'You',ownerUid:identity?.discord_uid||'',ownerName:identity?.discord_username||'Unknown player',backstory:d.backstory.trim()",
        "Creator owner")
    once("else if(formId==='characterForm'){let name=String(v.name||'').trim();",
        """else if(formId==='characterForm'){
 if(!window.TerravaleV2Bridge?.canCreate?.(db.campaign)){
  toast('Join a campaign before creating a character');navigate('/campaigns');return;
 }
 let name=String(v.name||'').trim();""","Legacy creator guard")
    once("status:'Pending',owner:'You',backstory:String(v.backstory",
        "status:'Pending',owner:'You',ownerUid:window.TerravaleVerifiedAccount?.state.profile?.discord_uid||'',ownerName:window.TerravaleVerifiedAccount?.state.profile?.discord_username||'Unknown player',backstory:String(v.backstory",
        "Legacy creator owner")
    once("function roomWrite(who,text,type='message',extra={}){const r=getRoom();",
        """function roomWrite(who,text,type='message',extra={}){
 const player=window.TerravaleVerifiedAccount?.state.profile;
 if(player&&(who==='You'||who==='Dungeon Master')){
  extra={...extra,tvuid:player.tvuid,ownerUid:player.discord_uid,avatar:window.TerravaleVerifiedAccount?.avatarUrl?.(player)||player.discord_avatar_url||''};
  who=player.discord_username;
 }
 const r=getRoom();""","Chat identity")
    once("m.who==='You'),active=q[0]",
        "(m.ownerUid&&m.ownerUid===window.TerravaleVerifiedAccount?.state.profile?.discord_uid)||m.who==='You'),active=q[0]",
        "Private chat filter")
    once("m.type==='system'?icon('star'):safe(m.who.slice(0,1))",
        """m.type==='system'?icon('star'):m.avatar?'<img src="'+safe(m.avatar)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':safe(m.who.slice(0,1))""",
        "Chat avatar")
    once('id="chatForm" class="sr-chat-form"><input type="text" name="message"',
        'id="chatForm" class="sr-chat-form" autocomplete="off"><input type="text" name="message" autocomplete="off" autocorrect="off" autocapitalize="sentences" spellcheck="false" data-lpignore="true"',
        "Disable past chat suggestions")

    tag='<div class="v2-overline">'+chr(36)+'{safe(c.ancestry)} · '+chr(36)+'{safe(c.className)}</div><h2>'+chr(36)+'{safe(c.name)}</h2>'
    new='<div class="v2-overline">'+chr(36)+'{safe(c.ancestry)} · '+chr(36)+'{safe(c.className)}</div><span class="tv-sheet-owner">Played by '+chr(36)+"{safe(c.ownerName||(c.owner==='You'?window.TerravaleVerifiedAccount?.state.profile?.discord_username||'You':c.owner||'Player'))}</span><h2>"+chr(36)+'{safe(c.name)}</h2>'
    once(tag,new,"Sheet player attribution")

    old_start='<div class="v2-note">Want to test <strong>Adblockn’t</strong>?'
    old_end=' / 25 closed</span></div>'
    a=source.find(old_start)
    b=source.find(old_end,a)
    if a<0 or b<0:raise AssertionError("Old Cabinet mock ad controls not found")
    replacement='<div class="v2-note">Adblockn’t is awarded for dismissing actual Terravale advertisements. <strong>'+chr(36)+'{db.dismissedAds} / 25</strong> closed on this Discord account. The DM controls are in Advertisement Atelier below.</div>'
    source=source[:a]+replacement+source[b+len(old_end):]

    source,n=re.subn(
       r'<div class="v2-card"><div class="v2-overline">GLOBAL PREVIEW SETTINGS</div>.*?<div class="v2-overline">OFFLINE WORKSPACE</div>.*?</div></aside></div>',
       '<div class="v2-card"><div class="v2-overline">ACCOUNT SETTINGS</div><h3>Advertisement Atelier</h3><p>Manage advertisements and Adblockn’t from the DM-exclusive section inside the Cabinet.</p><div class="v2-actions"><a class="btn ghost small" href="#/cabinet-of-curiosities">Open Cabinet →</a></div></div></aside></div>',
       source,count=1,flags=re.S)
    if n!=1:raise AssertionError("Old DM demo ad controls not found")

    once('Live-play layout · local offline demonstration',
         'Session workspace · chat currently stored in this browser','Session honesty')
    once('<span class="sr-local-tag">OFFLINE DEMO</span>',
         '<span class="sr-local-tag">BETA</span>','Session label')
    once('Both actions change this offline demo only.',
         'Membership is verified against your Discord account.','Campaign intro')
    once('Try the example code <strong>TV-DEMO</strong>.',
         'Use <strong>TV-DEMO</strong> to join the live shared demonstration campaign.','Demo invitation')
    once('Everything stays in this browser.',
         'Campaign details are stored against your Terravale account.','Campaign create description')
    once('Your account-wide achievements in the eventual live design. For now, this sandbox keeps all progress local and separate from real players.',
         'Your Adblockn’t progress is recorded on your Discord account. Other V2-only discoveries are still stored locally until migrated.',
         'Cabinet descriptions')
    # Remove labels that incorrectly claim the signed-in V2 website is fully offline.
    source=source.replace('OFFLINE PREVIEW','V2 BETA')
    once('<div class="v2-grid four">${items.map(r=>{let earned=', '<div class="v2-grid four cabinet-grid">${items.map(r=>{let earned=', 'Cabinet participates in fixed card morph')
    once('class="cab-card ${earned?\'earned\':\'\'}" data-rarity=', 'class="cab-card ${earned?\'earned\':\'\'} ${r.id===\'adblocknt\'||r.rarity===\'legendary\'||r.rarity===\'epic\'?\'cab-featured\':r.rarity===\'rare\'&&r.order%4===0?\'cab-tall\':\'\'}" data-rarity=', 'Restore rarity sizes in one gallery')
    source=source.replace('Permanent & account-wide in the intended live design','One continuous archive · Account-wide Adblockn’t')
    return source
