from pathlib import Path
import re
s=Path('published/veiled-codex/index.html').read_text()
names=[
('function renderCampaignDetail(',9700),
('function sheetV220Equipment(',7200),
('function sheetV221GearItem(',3500),
('function sheetV220State(',2300),
('function sheetV220CanEdit(',1800),
('function sheetV220Handle(',7200),
('function sheetV221GearMove(',2000),
('function renderSheetV220(',1400),
('function sheetV221Inventory(',1400),
('function sheetV222Inventory(',1400),
('function sheetV220AddGear(',1400),
('function sheetV221GearForm(',2000),
('function sheetV220Item(',1400),
('let sheetV220Tab=',500)
]
for n,width in names:
 hits=[m.start() for m in re.finditer(re.escape(n),s)]
 print("=== NATIVE",n,"HITS",len(hits),"===")
 for i in hits[:2]: print(s[i:i+width])
print("=== INSPECT END ===")
