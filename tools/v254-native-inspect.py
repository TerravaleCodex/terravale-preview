from pathlib import Path
import re
s=Path('published/veiled-codex/index.html').read_text()
for term in ['function renderCreate(', 'id="createForm"', 'id="characterForm"', 'data-action="saveCharacter"', 'function createCharacter(', 'case \'createCharacter\'', 'data-action="createChar"', 'name="ancestry"', 'name="class"', 'data-action="create"','data-action="creator"', 'function renderSheetV220(']:
 hits=[m.start() for m in re.finditer(re.escape(term),s)]
 print('\n===== '+term+' : '+str(len(hits))+' =====')
 for i in hits[:2]:print(s[max(0,i-850):i+8000])
