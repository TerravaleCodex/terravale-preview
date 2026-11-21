#!/usr/bin/env python3
"""Strip bundled world/campaign content from the actual V2.87 local fork.

Unlike hiding a Library tab, this rewrites the OUTPUT BYTES before shipping.
The untouched live V2.87 reference export is produced separately first.
Keep the DOM, CSS, rendering logic and controls; remove fictional content data.
"""
from __future__ import annotations

import json
import re
from typing import Any

WORLD_COLLECTIONS = frozenset({
    "classes","ancestries","races","lineages","subclasses","paths",
    "backgrounds","feats","spells","items","monsters","lore","articles",
    "heritagearticles","deities","gods","pantheon","boons","calendar",
    "events","festivals","locations","places","factions","nations",
    "peoples","religions","encounters","creatures","wonders","scars",
})
NO_CONTENT = ("v247-demo-party-admin.js", "v248-curated-demo-sheets.js")
REGISTRY_SOURCE = "v254-rules-registry.js"
LORE_ID = "tv238-v14-content"

# This is the *schema*, not any user or Terravale content. DMs choose
# which rules, classes and languages exist for their own campaigns later.
EMPTY_REGISTRY = ('window.TerravaleRulesV4={version:"offline-blank-v4",'
                  'tools:[],languages:[],currencies:[],classes:{}};')


def _empty_payload(value: Any) -> Any:
    """Keep JSON object keys, but remove all actual article/calendar data."""
    if isinstance(value, dict):
        return {key: _empty_payload(item) for key, item in value.items()}
    if isinstance(value, list):
        return []
    if isinstance(value, str):
        return ""
    if isinstance(value, bool):
        return False
    if isinstance(value, (int, float)):
        return 0
    return None


def _script(html: str, source: str, action: str, replacement="") -> tuple[str,int]:
    p = re.compile(
        r'(<script\b[^>]*\bdata-source="' + re.escape(source) + r'"[^>]*>)'
        r'([\s\S]*?)(</script>)', re.I
    )
    def sub(m:re.Match[str])->str:
        if action=="remove":return ""
        return m.group(1)+"\n"+replacement+"\n"+m.group(3)
    return p.subn(sub,html)


def _locate_js_value(js: str, start: int) -> int:
    """Find a balanced JS expression without cutting through text literals."""
    stack=[]
    quote=None
    escape=False
    line_comment=False
    block_comment=False
    n=len(js)
    pairs={"]":"[","}":"{",")":"("}
    for i in range(start,n):
        c=js[i];nextc=js[i+1] if i+1<n else ""
        if line_comment:
            if c in "\r\n":line_comment=False
            continue
        if block_comment:
            if c=="*" and nextc=="/":block_comment=False
            continue
        if quote:
            if escape:escape=False
            elif c=="\\":escape=True
            elif c==quote:quote=None
            continue
        if c=="/" and nextc=="/":line_comment=True;continue
        if c=="/" and nextc=="*":block_comment=True;continue
        if c in ("'",'"',"\x60"):
            quote=c;continue
        if c in "([{":stack.append(c);continue
        if c in ")]}":
            if not stack or stack[-1]!=pairs[c]:
                raise ValueError("Unexpected JS closing bracket at offset "+str(i))
            stack.pop()
            if not stack:return i+1
            continue
    raise ValueError("Unclosed JS structure")


def _top_level_entries(body: str) -> list[tuple[int,int,str]]:
    """Split an object literal's comma-delimited outer properties."""
    entries=[]
    start=0
    stack=[]
    quote=None
    esc=False
    i=0
    while i<len(body):
        c=body[i]
        if quote:
            if esc:esc=False
            elif c=="\\":esc=True
            elif c==quote:quote=None
        elif c in ("'",'"',"\x60"):quote=c
        elif c in "([{":stack.append(c)
        elif c in ")]}":
            if stack:stack.pop()
        elif c=="," and not stack:
            entries.append((start,i,body[start:i]))
            start=i+1
        i+=1
    entries.append((start,len(body),body[start:]))
    return entries


def blank_native_rules(html: str) -> tuple[str,int,list[str]]:
    """Blank the native campaign-content arrays, NOT the V2 UI code.

    The original V2 has RULES.classes used by its native class reader.
    If an object-literal RULES catalog is found, remove selected top-level
    collections while keeping skills, abilities and technical helpers.
    """
    p=re.compile(r'\b(?:const|let|var)\s+RULES\s*=\s*\{')
    matches=list(p.finditer(html))
    if not matches:return html,0,[]
    report=[]
    changed=0
    for m in reversed(matches):
        brace=html.index("{",m.start(),m.end())
        end=_locate_js_value(html,brace)
        content=html[brace+1:end-1]
        entries=_top_level_entries(content)
        updates=[]
        for a,b,entry in entries:
            match=re.match(r"(\s*['\"]?([A-Za-z_]\w*)['\"]?\s*:\s*)([\s\S]*)",entry)
            if not match:continue
            key=match.group(2).lower()
            if key not in WORLD_COLLECTIONS:continue
            value=match.group(3).strip()
            replacement="[]" if value.startswith("[") else "{}" if value.startswith("{") else "null"
            updated=match.group(1)+replacement
            updates.append((a,b,updated))
            report.append(key)
        for a,b,v in reversed(updates):
            content=content[:a]+v+content[b:]
        if updates:
            html=html[:brace+1]+content+html[end-1:]
            changed+=1
    return html,changed,sorted(set(report))


def blank_platform(html: str) -> tuple[str,dict]:
    report={"redacted_collections":{}, "removed_demo_modules":[],
            "native_rule_declarations":0,"native_world_collections":[]}
    # The V14 data payload is 283 world articles, 36 restricted placeholders,
    # 31 world-calendar events, plus further lore fields. Physically remove
    # its data rather than relying on access controls.
    p=re.compile(r'(<script\b[^>]*\btype="application/json"[^>]*\bid="'
                 +re.escape(LORE_ID)+r'"[^>]*>)([\s\S]*?)(</script>)',re.I)
    match=p.search(html)
    if not match:
        raise RuntimeError("Could not locate original V14 lore data; refusing unredacted export")
    data=json.loads(match.group(2))
    if not isinstance(data,dict):
        raise RuntimeError("Unexpected V14 content schema")
    for name,val in data.items():
        if isinstance(val,list):report["redacted_collections"][name]=len(val)
        elif isinstance(val,dict):report["redacted_collections"][name]="nested data removed"
    empty=json.dumps(_empty_payload(data),ensure_ascii=False,separators=(",",":"))
    html=html[:match.start(2)]+empty+html[match.end(2):]

    # Remove curated characters and global demo party content. The remaining
    # original V2 class/character/room UI functions stay in the document.
    for module in NO_CONTENT:
        html,count=_script(html,module,"remove")
        if count!=1:raise RuntimeError(f"Expected source data module {module}: {count}")
        report["removed_demo_modules"].append(module)

    html,count=_script(html,REGISTRY_SOURCE,"replace",EMPTY_REGISTRY)
    if count!=1:raise RuntimeError(f"Expected rules registry {REGISTRY_SOURCE}: {count}")
    report["redacted_collections"]["V2 rules tools/languages/currencies"]=True

    html,native_count,names=blank_native_rules(html)
    report["native_rule_declarations"]=native_count
    report["native_world_collections"]=names

    # The original live client advertises its preloaded world even if no local
    # account has joined a campaign. Remove those misleading example hints.
    html=html.replace("Use TV-DEMO for The Wayfarers’ Table, or ask your DM for an invitation.",
                      "Ask your DM for a campaign invitation.")
    html=html.replace("Try the example code <strong>TV-DEMO</strong>.",
                      "Enter a campaign invite code supplied by a DM.")
    return html,report
