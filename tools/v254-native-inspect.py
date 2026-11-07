from pathlib import Path
import re
s=Path('published/veiled-codex/index.html').read_text()
for term in ['function renderDM(','function renderDMChronicle(', 'function renderChronicle(',
 'function renderCharacterCreate(', 'function renderCreateCharacter(', 'function renderCreator(', 'id="characterCreateForm"', 'id="createCharacterForm"', 'data-action="createCharacter"','data-action="characterCreate"','function renderCharacterEditor(','function renderCharacterSheet(','function renderPage(', 'case \'/dm\'', 'case \'/characters/create\'', 'sheet21-backpack-zone','sheet20-tabs','function sheetV220Equipment(','function campaignFormPanels(']:
 hits=[m.start() for m in re.finditer(re.escape(term),s)]
 print('\n===== '+term+' : '+str(len(hits))+' =====')
 for i in hits[:2]:print(s[max(0,i-600):i+6200])
