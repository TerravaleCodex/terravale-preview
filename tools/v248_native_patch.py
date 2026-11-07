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
 # Remove older offline-only copy. Discord profiles, characters and
 # appearance now genuinely use the hosted backend; local notes may still
 # remain browser-scoped and must not be described as cloud-synced.
 for before,after in [
   ('Offline design sandbox · All data illustrative',
    'Discord-connected campaign workspace · Some notes remain browser-local'),
   ('No network connection · Never touches the live Codex',
    'Verified identity · Live character and campaign records'),
   ('Codex V2.25.1 · Offline','Terravale V2 · Verified Preview'),
   ('Sample-only data · stored in this browser',
    'Your characters are saved to the verified campaign account'),
   ('A short guide to this offline edition.',
    'Learn Terravale through the guided player tour. Replay it whenever you like.'),
   ('WELCOME TO THE DESIGN SANDBOX',
    'WELCOME TO THE LIVING CODEX'),
   ('This package is an independent offline redesign. It deliberately does not log in, contact servers or replace the live website.',
    'Your verified Discord profile, campaigns, character sheets and appearance are connected online. Some notes and reference tools remain browser-local while V2 is in beta.'),
   ('Your campaign, characters, activity and curiosities are all connected through local demo state. Click any card or sidebar page.',
    'Join a campaign to see its live character records, use the dashboard to jump to your adventurer, and navigate the site through the shared sidebar.'),
   ('04 · ALL LOCAL','04 · REAL ACCOUNT'),
   ("The ↻ control at the bottom clears this prototype's saved browser data. It does not touch online campaigns or characters.",
    'Profile and campaign changes use your signed-in account. The demo reset, when available to the DM, is a separate confirmed online operation.'),
   ('Offline design build · source-backed reference rules. Character actions remain local; no live character data is accessed.',
    'Character records are saved online to your verified campaign. Some reference rules remain text-only pending the final import.'),
   ('Preview the shared V2 layout across the established dark-mode theme families.',
    'Preview the V2 themes and save your selection to your Discord account.'),
 ]:
  source=source.replace(before,after)
 return source
