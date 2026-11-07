from pathlib import Path
import re
s=Path('published/veiled-codex/index.html').read_text()
tests=[
 'function sheetV220Resources(', 'function sheetV220Overview(',
 'function sheetV220Abilities(', 'function sheetV220Resource',
 'function sheetV220Equipment(', 'function sheetV220Handle(', 'function sheetV221GearItem(',
 'function renderSheetV220(', 'function renderSessionRoom(', 'function renderSession(', 
 'function renderParty(', 'function srRender','function sr-', 'data-action="sheetRest',
 "case 'sheetRest", "case 'rest", 'data-action="sr', 'data-action="endTurn',
 'function act(', 'function handleAction(', 'function handleClick(', 'case \'sheet', 'function rollDice(',
 'function roll', 'Short rest', 'Long rest', 'Rest', 'Attack', 'DM combat',
 'function sheetV220Combat(', 'function sheetV220Vitals('
]
for term in tests:
 hits=[m.start() for m in re.finditer(re.escape(term),s,re.I)]
 print("\n=== TERM",repr(term),"COUNT",len(hits),"===")
 for i in hits[-5:]:
  print(repr(s[max(0,i-300):i+1300])[:1550])
print("\n=== END ===")
