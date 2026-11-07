#!/usr/bin/env python3
"""V2.45 native theme catalogue and non-destructive card typography fixes."""
import re
import colorsys

def patch(source):
    def exactly(old,new,reason):
        nonlocal source
        count=source.count(old)
        if count!=1:raise AssertionError(f"{reason}: expected one occurrence, found {count}")
        source=source.replace(old,new,1)

    # 'shady' ID stays: existing user preferences survive the display-name change.
    a=source.index('const themes=[{id:')
    render_start=source.index('function renderAppearance()',a)
    b=source.rfind('];',a,render_start)+2
    if b<=a:raise AssertionError('V2 native theme catalogue ending unavailable')
    new_themes="""const themes=[
{id:'classic',name:'Classic Codex',sub:'The original violet-and-ink design',bg:'#0d0c14',a:'#c3a5ff'},
{id:'shady',name:'Bone Zone',sub:'Carved bone, charcoal and antique ivory',bg:'#0d0d0a',a:'#e6d7b6'},
{id:'zero',name:'Absolute Zero',sub:'True black with restrained controls; rarity colours remain visible',bg:'#030303',a:'#d1d1d1'},
{id:'night',name:'Night Sky',sub:'Midnight indigo, distant stars and moonlit blue',bg:'#03081a',a:'#a9cfff'},
{id:'guildie',name:'Guildie',sub:'Royal purple, rich shadow and radiant gold',bg:'#12071a',a:'#c29af5'},
{id:'verdant',name:'Verdant Archive',sub:'Forest canopy, emerald light and old brass',bg:'#06140e',a:'#8fd7a7'},
{id:'crimson',name:'Crimson Court',sub:'Wine-dark velvet, ruby accents and antique gold',bg:'#19090e',a:'#e48b97'},
{id:'nullmeridian',name:'Null Meridian',sub:'Fractured midnight, eerie cyan and broken geometric light',bg:'#04090e',a:'#6dd5e8'},
{id:'gloamglass',name:'Gloamglass',sub:'Petrol-black, iridescent teal and fractured stained-glass light',bg:'#061c20',a:'#70cdbd'}
];"""
    source=source[:a]+new_themes+source[b:]
    exactly("shady:'Shady',zero:'Absolute Zero',night:'Night Sky',guildie:'Guildie'",
            "shady:'Bone Zone',zero:'Absolute Zero',night:'Night Sky',guildie:'Guildie',verdant:'Verdant Archive',crimson:'Crimson Court',nullmeridian:'Null Meridian',gloamglass:'Gloamglass'",
            "Toast uses approved display names")
    exactly('These are V2 interface token previews, not a full recreation of every decorative theme effect. The current account’s actual settings remain untouched.',
            'Themes apply instantly across Terravale and are saved for this browser. The green and red palettes are available for review before we finalise their related achievements.',
            "Theme guidance")

    # Fixed-height galleries should not hide entire titles; limit type to available
    # rows, scale exceptionally long names, and retain complete names on hover.
    exactly('<h3>${safe(r.title)}</h3><p>${safe(r.description)}</p>',
            '<h3 class="cab-title ${r.title.length>28?\'cab-title-long\':\'\'}" title="${safe(r.title)}">${safe(r.title)}</h3><p>${safe(r.description)}</p>',
            "Cabinet card titles")
    exactly('<h2>${esc(a.title)}</h2><p>${esc(a.lead)}</p>',
            '<h2 class="${a.title.length>37?\'tv-lore-title-long\':\'\'}" title="${esc(a.title)}">${esc(a.title)}</h2><p>${esc(a.lead)}</p>',
            "Lore card titles")
    return source

def theme_bridge_css(source):
    """Remap original hard-coded violet tokens for new themes without altering
    the native original CSS; semantic rarities and lore topics remain untouched."""
    match=re.search(r'<style data-source="v2.18.3-theme-harmony.css">(.*?)</style>',source,re.S)
    if not match:raise AssertionError("Native theme harmony layer unavailable")
    harmony=match.group(1)
    m=re.search(r'body\[data-theme="night"\]\{([^}]*)\}',harmony,re.S)
    if not m:raise AssertionError("Night theme token map unavailable")
    tokens=re.findall(r'(--tv-hex-[a-f0-9]{6,8}):\s*(#[a-f0-9]{6,8})',m.group(1),re.I)
    if len(tokens)<80:raise AssertionError("Unexpectedly small V2 colour-token inventory")
    output=[]
    for name,hcolor in [('verdant',.39),('crimson',.976),('nullmeridian',.53),('gloamglass',.475)]:
        values=[]
        for k,color in tokens:
            raw=color.lstrip('#')
            if len(raw) not in (6,8):continue
            rgb=tuple(int(raw[i:i+2],16)/255 for i in (0,2,4))
            h,l,s=colorsys.rgb_to_hls(*rgb)
            # Preserve semantic status greens, reds and golds where identifiable
            # from the ORIGINAL token name, not from a blue remapping.
            original=k.split('-')[-1][:6]
            base=tuple(int(original[i:i+2],16)/255 for i in (0,2,4))
            bh,bl,bs=colorsys.rgb_to_hls(*base)
            meaningful=bs>.20 and (0.17<bh<0.53 or bh<0.055 or bh>0.985)
            if meaningful and l>.32:continue
            if l>.77:
                new_h,new_l,new_s=hcolor,min(.96,l+.012),min(.24,s*.30)
            elif l<.33:
                new_h,new_l,new_s=hcolor,max(.026,l*.68),min(.55,max(.25,s*.80))
            else:
                new_h,new_l,new_s=hcolor,l,min(.67,max(.34,s*.91))
            rr,gg,bb=colorsys.hls_to_rgb(new_h,new_l,new_s)
            convert=lambda x:f'{round(255*x):02x}'
            values.append(k+':#'+convert(rr)+convert(gg)+convert(bb)+(raw[6:] if len(raw)==8 else ''))
        output.append('body[data-theme="'+name+'"]{'+ ';'.join(values)+'}')
    return '\n'.join(output)
