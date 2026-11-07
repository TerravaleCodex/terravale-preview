#!/usr/bin/env python3
"""V2.46 source patches, preserving every V14 article and its access manifest."""
import re

def patch(source):
    def one(old,new,label):
        nonlocal source
        count=source.count(old)
        if count!=1:raise AssertionError(label+': expected 1 occurrence, found '+str(count))
        source=source.replace(old,new,1)

    a=source.index('function creatorDoSave(){')
    b=source.index('function creatorUpdatePreview(){',a)
    f=source[a:b]
    f=f.replace('function creatorDoSave(){','async function creatorDoSave(){',1)
    f=f.replace("const id=key('char'),attrs=","let id=key('char'),attrs=",1)
    push=f.index('db.characters.push({')
    end=f.index('});db.featuredCharacters??=',push)
    payload=f[push+len('db.characters.push('):end+1]
    new='const pendingSheet='+payload+';'
    new+="const saved=await window.TerravaleV2Bridge?.createCharacter?.(pendingSheet);"
    new+="if(!saved?.id){toast(saved?.error||'Online character save failed. Check your campaign and Discord connection.');return;}"
    new+="id=saved.id;pendingSheet.id=id;pendingSheet.status=saved.status;db.characters.push(pendingSheet);"
    f=f[:push]+new+f[end+3:]
    f=f.replace("toast('Rules-aware starting build saved · pending DM approval')",
      "toast(saved.isDemo?'Demo character automatically approved':'Character saved online · awaiting DM approval');window.TerravaleV2Bridge?.syncCharacters?.()",1)
    source=source[:a]+f+source[b:]

    a=source.index("else if(formId==='characterForm'){")
    b=source.index(" else if(formId==='journalForm')",a)
    source=source[:a]+("else if(formId==='characterForm'){"
      "toast('Use Character Studio for an actual campaign-owned sheet.');navigate('/characters/create');return;}"
      )+source[b:]

    one('function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(db))}catch{}}',
        'function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(db))}catch{}window.TerravaleV2Bridge?.onLocalPersist?.()}',
        'Online changes to live sheets')
    gate=("if(window.TerravaleV2Bridge?.isDemo?.(db.campaign))\n"
          "  return pageHeader('DEMONSTRATION TABLE','Limited demo access','This table is for testing, not live DM management.')+\n"
          "   empty('DM controls disabled in demo','Create a regular campaign to manage approvals, encounters and invitations.','/campaigns','Manage campaigns')+foot();\n ")
    one(gate,'','Remove blanket demo DM lockout')
    one("const dmControls=db.role==='dm'&&!window.TerravaleV2Bridge?.isDemo?.(db.campaign)?",
        "const dmControls=db.role==='dm'?",'Enable demo room DM controls')
    one("if(original)treeTab='class';",
        "if(original){treeTab='class';setTimeout(()=>renderPage(false),0);}",'Reader subtab recovery')
    one("if(e.target.closest('button,a,input,select'))return;start={x:e.clientX",
        "if(e.target.closest('button,a,input,select'))return;e.preventDefault();start={x:e.clientX",
        'Prevent text selection during tree pan')
    one("const able=a=>!a.heritageOf||roster.some(r=>r.ancestry===a.heritageOf);",
        "const able=a=>!a.heritageOf||(Array.isArray(db?.characters)&&db.characters.some(c=>c.ancestry===a.heritageOf&&window.TerravaleV2Bridge?.hasCampaign?.(c.campaign)));",
        "Use real character ancestry for V14 article locks")
    one("Offline design build · source-backed starting calculations only. Your DM determines starting equipment; players can organise their personal inventory. No live character data is accessed.",
        "Character sheet associated with your verified Discord account and campaign. Your DM still controls approvals, level progression and starting equipment.",
        "Remove obsolete offline sheet disclaimer")
    return source
