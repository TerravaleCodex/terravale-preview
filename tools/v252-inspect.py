from pathlib import Path
import re
s=Path('published/veiled-codex/index.html').read_text()
terms=["function renderCampaignDetail(","campaign-detail-tabs","campaignTab","party roster","Party roster","function renderCampaigns(","function renderCharacters(","joinForm","campaignForm","Create a character","Create character"]
for term in terms:
    hits=[m.start() for m in re.finditer(re.escape(term),s,re.I)]
    print("\n=== FOUND",term,len(hits),"===")
    for i in hits[:3]:
        print(s[max(0,i-240):i+4200][:4500])
