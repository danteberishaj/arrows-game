#!/usr/bin/env python3
"""Compose actual picker pages without resizing; require every full-height radio in both themes."""
import json,pathlib,xml.etree.ElementTree as ET,re,hashlib
from PIL import Image,ImageDraw,ImageFont
root=pathlib.Path(__file__).resolve().parents[2]/'artifacts/ART-SKINS-07'
specs=json.loads((root/'checks/contract-data.json').read_text())['specs']
expected=['Classic',*[s['name'] for s in specs.values()]];proof={}
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',28)
for theme in ['light','dark']:
    pages=[];covered=set();allRows=[]
    for page in range(4):
        xml=root/'checks'/f'picker-{theme}-{page}.xml';tree=ET.parse(xml)
        scroll=next(n for n in tree.iter('node') if n.attrib.get('class')=='android.widget.ScrollView')
        bounds=list(map(int,re.findall(r'\d+',scroll.attrib['bounds'])))
        labels=[]
        for n in tree.iter('node'):
            if n.attrib.get('class')!='android.widget.RadioButton':continue
            b=list(map(int,re.findall(r'\d+',n.attrib['bounds'])))
            if b[3]-b[1]>=210 and b[1]>=bounds[1] and b[3]<=bounds[3]:
                name=n.attrib['content-desc'].split(',')[0];labels.append(name);covered.add(name)
                allRows.append({'name':name,'heightDp':(b[3]-b[1])/3.5,'page':page,'bounds':b,'checked':n.attrib['checked']})
        source=root/'screens'/f'picker-{theme}-{page}.png'
        pages.append({'source':str(source.relative_to(root)),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'fullyVisible':labels})
    assert covered==set(expected),(theme,covered^set(expected))
    # First three pages already cover all choices; the fourth remains a raw capture.
    selected=[];names=set()
    for p in pages:
        if set(p['fullyVisible'])-names:selected.append(p);names.update(p['fullyVisible'])
    bg='#FFFFFF' if theme=='light' else '#13111C';ink='#191724' if theme=='light' else '#EFEDF9'
    crop=(155,390,1285,2640);w=crop[2]-crop[0];h=crop[3]-crop[1]
    sheet=Image.new('RGB',(len(selected)*(w+20)+20,h+100),bg);draw=ImageDraw.Draw(sheet)
    draw.text((20,15),f'Arrow style · {theme} · all 18 options · actual 60 dp radios · owner review pending',font=font,fill=ink)
    for i,p in enumerate(selected):
        draw.text((20+i*(w+20),50),f'Page {i+1}',font=font,fill=ink)
        sheet.paste(Image.open(root/p['source']).convert('RGB').crop(crop),(20+i*(w+20),90))
    sheet.save(root/'screens'/f'picker-contact-{theme}.png')
    proof[theme]={'names':expected,'minFullyVisibleTargetDp':min(r['heightDp'] for r in allRows),'pages':pages,'rows':allRows,'resized':False}
(root/'checks/picker-coverage.json').write_text(json.dumps(proof,indent=2)+'\n')
print('All 18 actual radios/previews visible in each theme, ≥60 dp; lossless page sheets written.')
