from pathlib import Path
import re
s=Path('published/veiled-codex/index.html').read_text()
terms=['function renderCampaign','function renderCampaignDetail','function renderCampaigns',
 'campaignTab','campaign-tab','data-action="campaign','sheetTab','sheet20-tabs','function renderSheetV220',
 'function renderSheet','function renderEquipment','renderInventory','inventory-entry','Backpack','backpack','data-action="inv',
 'function route','window.addEventListener','function renderPage','function sheet20']
print('=== NATIVE CAMPAIGN, SHEET AND INVENTORY INSPECTION ===')
for term in terms:
 hits=list(re.finditer(re.escape(term),s,re.I))
 print('\nTERM',repr(term),'HITS',len(hits))
 for h in hits[-5:]:
  i=h.start()
  print('>>>',i,repr(s[max(0,i-340):min(len(s),i+1020)]))
print('=== EOF INSPECTION ===')
