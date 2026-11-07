from pathlib import Path
import re,json
s=Path("published/veiled-codex/index.html").read_text()
tests=[
 ('creatorFeatStage','function creatorFeatStage(d){',4500),
 ('creatorSave','function creatorDoSave(){',5000),
 ('renderAppearance','function renderAppearance()',2600),
 ('achievementProgress','function achievementProgress(',3800),
 ('renderCabinet','function renderCabinet()',2300),
 ('renderSheet','function renderSheetV220(',2400),
 ('featRegistry','TERRAVALE_V225_FEATS',550),
 ('baseData','const TVR=',2000),
 ('creatorAncestry','function creatorAncestry',1200),
 ('sheetAncestry','Ancestry feats',700),
 ('featList','ancestryFeats',600),
 ('racesMeta','ancestryFeat',850),
 ('classTraits','classAbilities',600)
]
for name,term,count in tests:
 p=s.find(term)
 print(f"\n=== {name}: index={p} ===\n"+(s[max(0,p-150):p+count] if p>=0 else '<not found>'))
print("\n=== ANCESTRY META SCANS ===")
for term in ['const TVR','const TV','const ancestry','feats:','featureId:','classSkills','racialFeats','Hunter’s Instinct',"Hunter's Instinct",'Controlled Feeding','Beastfolk','Gatewarden','Flugel','featsV225']:
 starts=[m.start() for m in re.finditer(re.escape(term),s)]
 print(term,len(starts),"first",[s[max(0,i-95):i+200].replace('\n',' ') for i in starts[:2]])
print("\n=== SAFE ANCESTRY FEAT IDS ===")
for term in ['TERRAVALE_V225_FEATS','TVR.FEAT','TVR.anc','v225Feat']:
 print(term,'count=',s.count(term))


print("\n=== RULE ENGINE MANIFEST CONTEXT ===")
p=s.find('const cls=n=>M.classes')
print(s[p-950:p+850])
print("\n=== SAVED CREATOR EXACT FIELDS ===")
a=s.find('async function creatorDoSave(){');print(s[a:a+4000])
print("\n=== FULL FEAT MANIFEST ENTRIES FOR DEMO ANCESTRIES ===")
matches=re.findall(r'\{"id":"([^"]+)","name":"([^"]+)","ancestry":"([^"]+)","prerequisites":"([^"]+)","bonus":(\[[^\]]*\])\}',s)
print("FEAT_META_COUNT",len(matches))
for id,name,ancestry,prerequisites,bonuses in matches:
 if ancestry in ['crimsonborn','beastfolk','elf','dvergr','flugel','human']:
  print(ancestry,"|",id,"|",name,"|",prerequisites,"|",bonuses)
print("\n=== RULE FIELDS / SHEET FEATURE PANEL ===")
for term in ['function sheetV222Feats','function sheetV222AncestryPanel','function sheetV225','function sheetV228','function sheetV227','const TVR=']:
 p=s.find(term);print(term,p,s[max(0,p):p+2100])


print("\n=== BEASTFOLK CLASSIFICATION AND FEAT CHECK ===")
for term in ["function featCheck(", "const classifications=", "function creatorAncestryStage(", "Animal Classification", "function sheetV222Feat", "function sheetV224Feat"]:
 p=s.find(term);print(term,p,s[p:p+2600] if p>=0 else "")
