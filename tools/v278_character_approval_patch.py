"""Terravale V2.78 — make the native Approve button persist its decision.
The approved V2 bundle's original handler only set c.status locally.
Replace it in the assembled source before public scripts are added.
"""
def patch(source: str) -> str:
    before = """case 'approveCharacter':{if(db.role!=='dm'){toast('Switch to DM mode first');return}let c=db.characters.find(x=>x.id===id);if(!c)return;c.status='Approved';unlock('character_approved');persist();renderPage(false);toast('Character approved: '+c.name);break}"""
    after = """case 'approveCharacter':{if(db.role!=='dm'){toast('Switch to DM mode first');return}if(!window.TerravaleV278Approval?.approveInitial){toast('Character approval service is not ready. No changes were made.');return;}window.TerravaleV278Approval.approveInitial(id,el);break}"""
    assert source.count(before)==1, "Original local-only character approval handler changed"
    source=source.replace(before,after,1)
    before_note='<h4>Still requires DM review</h4><div class="sheet20-review-list">'
    after_note='<h4>\${c.status===\\'Pending\\'?\\'Awaiting initial DM approval\\':\\'Reference notes · not a new approval\\'}</h4><div class="sheet20-review-list">'
    assert source.count(before_note)==1, "Native character sheet review heading changed"
    source=source.replace(before_note,after_note,1)
    return source
