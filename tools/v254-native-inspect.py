from pathlib import Path
import re
s=Path('published/veiled-codex/index.html').read_text()
for term in ['function renderCreatorV2(', 'function renderCreatorV217(', 'function renderCreator', 'function creator', 'data-action="creatorClass"', 'data-action="creatorAncestry"', 'id="creatorForm"', 'id="creatorName"', 'name="className"', 'data-action="creatorSave"']:
 hits=[m.start() for m in re.finditer(re.escape(term),s)]
 print('\n####',term,len(hits))
 for i in hits[:1]:print(s[i:i+7500])
