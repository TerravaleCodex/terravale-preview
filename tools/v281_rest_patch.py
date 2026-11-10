"""V2.81: join canonical divine recovery to confirmed native rest completion.
Only call once the original rest handler has committed HP/resource changes.
Never treat a generic click or failed rest modal as a completed rest.
"""
def patch(source: str) -> str:
    anchors=[
      "s.v237LastRest=result;persist();closeModal();renderPage(false);",
      "state.v238LastRest={kind,hpGained:healed,resourceCount};persist();closeModal();renderPage(false);"
    ]
    for original in anchors:
        assert source.count(original)==1, "Native rest completion handler changed; abort patch"
        replacement=original+"window.TerravaleV281Canon?.onNativeRest?.(c.id,kind);"
        source=source.replace(original,replacement,1)
    return source
