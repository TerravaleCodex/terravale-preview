#!/usr/bin/env python3
"""V2.48 native-source compatibility; preserve authoritative lore and rules."""
def patch(source):
 def one(old,new,why):
  nonlocal source
  count=source.count(old)
  if count!=1:raise AssertionError("%s: expected 1, found %d"%(why,count))
  source=source.replace(old,new,1)
 one("return Math.min(rec.goal,counts[rec.measure]||0)",
     "return Math.min(rec.goal,Math.max(0,(counts[rec.measure]||0)-((db.achievementProgressBaseline||{})[rec.measure]||0)))",
     "Respect global achievement progress reset without deleting reading history or journals")
 one("function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(db))}catch{}window.TerravaleV2Bridge?.onLocalPersist?.()}",
     "function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(db))}catch{}window.TerravaleV2Bridge?.onLocalPersist?.();window.TerravaleAchievementNotify?.pulse?.()}",
     "Notify only new achievement completions after local save")
 one("function setTheme(theme){db.theme=theme;",
     "function setTheme(theme){db.theme=theme;window.TerravaleLivePreferences?.queueTheme?.(theme);",
     "Save theme selection online to verified Discord identity")
 one("This choice is stored only in your browser.",
     "Appearance and theme variants sync to your verified Discord account.",
     "No longer claim the appearance settings are offline-only")
 one("Themes apply instantly across Terravale and are saved for this browser. The green and red palettes are available for review before we finalise their related achievements.",
     "Appearance changes apply across Terravale and synchronise securely to your Discord account. Unlocking Seeing Red reveals the Crimson Court moon mode.",
     "Show accurate cloud-backed theme help")
 return source
