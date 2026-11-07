from pathlib import Path
import re
s=Path('published/veiled-codex/index.html').read_text()
for term in (
 'data-v238-confirm-rest','data-v238-rest','function sheetV238',
 'Confirm short rest','Confirm long rest','function sheetV220Rest',
 'case "sheetRest"',"case 'sheetRest'",'sheetRest','sheet20-resource-panel',
 'function renderCampaignDetail(', 'function renderSessionRoom(',
 'function renderParty(', 'function renderSession(', 'data-action="campaignTab"',
 'campaign-detail-tabs','function sheetV220Handle(', 'function sheetV221GearItem(',
 'function roomActor','session-room','function sheetV220Resource'
):
  hits=[x.start() for x in re.finditer(re.escape(term),s,re.I)]
  print('\n===',term,len(hits),'===')
  for i in hits[-2:]:
    print(repr(s[max(0,i-850):i+2350]))
