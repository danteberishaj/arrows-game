#!/usr/bin/env python3
"""Lossless crop/contact composition of native captures; never retouches art pixels."""
import os
import json,pathlib,hashlib,re,xml.etree.ElementTree as ET
from PIL import Image,ImageDraw,ImageFont
root=pathlib.Path(__file__).resolve().parents[2]/os.environ.get('ART_SKINS_DIR','artifacts/ART-SKINS-07')
data=json.loads((root/'checks/contract-data.json').read_text());specs=[{'id':'classic','numericId':0,'name':'Classic'},*data['specs'].values()]
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',25)
small=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',20)
# Dense crop contains the same seven one-cell arrows plus neighbouring shafts in every image.
real=(1481,2201,2016,2634); fixture=(0,250,535,683)
manifest={'source':'Actual player viewport crops of real v1 index 3827 at 29.387754 dp, paired with separately defined native geometry fixtures at 38 dp; density 3.5. Full native board renders are retained separately.',
          'denseBounds':real,'fixtureBounds':fixture,'resized':False,'inputs':[]}
for theme in ['light','dark']:
    bg='#FFFFFF' if theme=='light' else '#13111C'; ink='#191724' if theme=='light' else '#EFEDF9'
    sheet=Image.new('RGB',(3*1110+40,6*510+80),bg);draw=ImageDraw.Draw(sheet)
    draw.text((20,15),'Arrow styles · 29.39 dp level 3828 / 38 dp native fixture · owner review pending',font=font,fill=ink)
    for i,spec in enumerate(specs):
        x=20+(i%3)*1110;y=65+(i//3)*510
        name=f"{spec['numericId']}  {spec['name']}"+(' · best in '+spec['preferredTheme'] if spec.get('preferredTheme') else '')
        draw.text((x,y),name,font=font,fill=ink)
        for label,bounds,dx,dp in [('board',real,0,29.387754),('fixture',fixture,550,38)]:
            source=root/'screens/native'/f"art07-after-{spec['id']}-{theme}-{label}.png"
            viewport=root/'screens'/f"{spec['id']}-{theme}-viewport.png"
            viewportLog=root/'checks'/f"{spec['id']}-{theme}-viewport.log"
            viewportXml=root/'checks'/f"{spec['id']}-{theme}-viewport.xml"
            sourceKind='native Canvas'
            if label=='board' and viewport.exists() and viewportLog.exists() and viewportXml.exists():
                camera=re.findall(r'\[board-camera\].*?scale=([\d.e-]+) tx=([\d.e-]+) ty=([\d.e-]+)',viewportLog.read_text())[-1]
                scale,tx,ty=map(float,camera);assert abs(scale*40-dp)<.001
                tree=ET.fromstring(viewportXml.read_text())
                board=next(n for n in tree.iter('node') if n.attrib.get('resource-id','').endswith('perf-board') or n.attrib.get('content-desc')=='perf-board')
                boardTop=int(re.findall(r'\d+',board.attrib['bounds'])[1])
                bounds=tuple(round(v+(tx*3.5 if i%2==0 else ty*3.5+boardTop)) for i,v in enumerate(real))
                source=viewport;sourceKind='actual player viewport'
            image=Image.open(source).convert('RGB');assert 0<=bounds[0]<bounds[2]<=image.width and 0<=bounds[1]<bounds[3]<=image.height
            crop=image.crop(bounds)
            dest=root/'screens'/f"{spec['id']}-{theme}-{label}-crop.png";crop.save(dest)
            sheet.paste(crop,(x+dx,y+65));draw.text((x+dx,y+35),f'{dp:.2f} dp · '+('player viewport' if sourceKind=='actual player viewport' else 'real geometry' if label=='board' else 'fixture'),font=small,fill=ink)
            manifest['inputs'].append({'spec':spec['id'],'theme':theme,'kind':label,'sourceKind':sourceKind,'screenCellDp':dp,'source':str(source.relative_to(root)),
                'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'cropBounds':bounds})
    sheet.save(root/'screens'/f'contact-{theme}.png')
(root/'screens/contact-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('36 labelled cards, two original-scale crops each; source hashes and bounds saved.')
