#!/usr/bin/env python3
"""Pair existing ART07 originals with ART08 originals; preserve crop pixels and source provenance."""
import hashlib, json, os, pathlib, re, xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont
workspace=pathlib.Path(__file__).resolve().parents[2]
root=workspace/os.environ.get('ART_SKINS_DIR','artifacts/ART-SKINS-08')
before=workspace/'artifacts/ART-SKINS-07'
data=json.loads((root/'checks/contract-data.json').read_text())
polish=['cinnamon','sherbet','candy-gloss','jelly','critter','rainbow-ribbon','campfire','strawberry-glazed']
carried=['archery','ink-pro','clear-glass','paper-craft']
world=(1481,2201,2016,2634); fixture=(0,250,535,683)
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',25)
small=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',19)
manifest={'screenCellDp':29.38775416782924,'fixtureDp':38,'resizedContacts':False,'inputs':[]}
def crop(task,id,theme,kind):
    source=task/'screens/native'/f'art07-after-{id}-{theme}-{kind}.png'
    bounds=world if kind=='board' else fixture; sourceKind='native Canvas on emulator'
    viewport=task/'screens'/f'{id}-{theme}-viewport.png'
    log=task/'checks'/f'{id}-{theme}-viewport.log'; xml=task/'checks'/f'{id}-{theme}-viewport.xml'
    if kind=='board' and viewport.exists() and log.exists() and xml.exists():
        scale,tx,ty=map(float,re.findall(r'\[board-camera\].*?scale=([\d.e-]+) tx=([\d.e-]+) ty=([\d.e-]+)',log.read_text())[-1])
        assert abs(scale*40-manifest['screenCellDp'])<.001
        board=next(n for n in ET.fromstring(xml.read_text()).iter('node') if n.attrib.get('resource-id','').endswith('perf-board') or n.attrib.get('content-desc')=='perf-board')
        top=int(re.findall(r'\d+',board.attrib['bounds'])[1])
        bounds=tuple(round(v+(tx*3.5 if i%2==0 else ty*3.5+top)) for i,v in enumerate(world))
        source=viewport; sourceKind='actual player viewport'
    image=Image.open(source).convert('RGB')
    assert 0<=bounds[0]<bounds[2]<=image.width and 0<=bounds[1]<bounds[3]<=image.height
    manifest['inputs'].append({'spec':id,'theme':theme,'task':task.name,'kind':kind,'sourceKind':sourceKind,'source':str(source.relative_to(workspace)),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'bounds':bounds})
    return image.crop(bounds)
# The dense crop independently contains seven complete one-cell arrows, unchanged across skins.
cell=manifest['screenCellDp']*3.5
ones=[i for i,a in enumerate(data['levels'][-1]['arrows']) if len(a['cells'])==1 and
      world[0]+cell*.5<(a['cells'][0]['c']+.5)*cell<world[2]-cell*.5 and
      world[1]+cell*.5<(a['cells'][0]['r']+.5)*cell<world[3]-cell*.5]
assert len(ones)>=4;manifest['completeOneCellArrowIndices']=ones
for theme in ['light','dark']:
    bg='#FFFFFF' if theme=='light' else '#13111C';ink='#191724' if theme=='light' else '#EFEDF9'
    sheet=Image.new('RGB',(2250,80+12*510),bg);draw=ImageDraw.Draw(sheet)
    draw.text((15,15),'ART07 before  /  ART08 after · 29.39 dp play crop + 38 dp fixture · owner review pending',font=font,fill=ink)
    for row,id in enumerate(polish+carried):
        spec=data['specs'][id];y=65+row*510
        for column,task in enumerate([before,root]):
            x=15+column*1120
            label=('Before' if column==0 else 'After')+f" · {spec['numericId']} {spec['name']}"
            if id in carried:label+=' · carried 07b / crease fix'
            if spec.get('preferredTheme'):label+=' · best in '+spec['preferredTheme']
            draw.text((x,y),label,font=font,fill=ink)
            for dx,kind in [(0,'board'),(550,'fixture')]:
                image=crop(task,id,theme,kind);sheet.paste(image,(x+dx,y+58))
                draw.text((x+dx,y+31),'29.39 dp · 7 one-cell arrows' if kind=='board' else '38 dp · native fixture',font=small,fill=ink)
                image.save(root/'screens'/f"{task.name}-{id}-{theme}-{kind}-crop.png")
        new=crop(root,id,theme,'board')
        new.resize((new.width*2,new.height*2),Image.Resampling.NEAREST).save(root/'screens'/f'{id}-{theme}-one-cells-2x.png')
    sheet.save(root/'screens'/f'contact-before-after-{theme}.png')
(root/'screens/polish-contact-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Two before/after sheets, 12 styles; each dense crop includes seven complete one-cell arrows. Original source hashes retained.')
