#!/usr/bin/env python3
"""Lossless diagnostic crops. No retouching or generated pixels; 2x nearest-neighbour magnification."""
import json, pathlib, math
from PIL import Image, ImageDraw
root=pathlib.Path('artifacts/ART-SKINS-04')
level=json.loads((root/'checks/contract-data.json').read_text())['levels'][-1]
arrows=level['arrows']; delta=[(-1,0),(1,0),(0,-1),(0,1)]
def pt(c): return c['r'],c['c']
def outward(a):
    if len(a['cells'])==1:
        d=delta[a['direction']];return -d[0],-d[1]
    x,y=a['cells'][:2];return x['r']-y['r'],x['c']-y['c']
tails={pt(a['cells'][0]):i for i,a in enumerate(arrows)}
pair=None
for i,a in enumerate(arrows):
    tail=pt(a['cells'][0]);out=outward(a);adj=(tail[0]+out[0],tail[1]+out[1]);j=tails.get(adj)
    if j is not None and j!=i and outward(arrows[j])==(-out[0],-out[1]): pair=(i,j);break
assert pair is not None
heads=None
for i,a in enumerate(arrows):
    head=pt(a['cells'][-1]);d=delta[a['direction']];j=tails.get((head[0]+d[0],head[1]+d[1]))
    if j is not None and i!=j: heads=(i,j);break
assert heads is not None
longest=[];longIndex=-1
for i,a in enumerate(arrows):
    run=[];direction=None
    for c in a['cells']:
        if not run:run=[c];continue
        d=(c['r']-run[-1]['r'],c['c']-run[-1]['c'])
        if direction==d or direction is None: run.append(c)
        else:run=[run[-1],c]
        direction=d
        if len(run)>len(longest):longest=list(run);longIndex=i
assert len(longest)>=4
cases={'tail-to-tail':([arrows[pair[0]]['cells'][0],arrows[pair[1]]['cells'][0]],list(pair)),
 'head-into-tail':([arrows[heads[0]]['cells'][-1],arrows[heads[1]]['cells'][0]],list(heads)),
 'long-icing':(longest,[longIndex])}
manifest={'screenCellDp':29.387754,'pixelsPerCell':29.387754*3.5,'source':'native Android Canvas whole-board diagnostic; same real core geometry/spec/cell scale, not a viewport screenshot','crops':{}}
cell=manifest['pixelsPerCell']
for case,(cells,indices) in cases.items():
    minR=min(c['r'] for c in cells);maxR=max(c['r'] for c in cells);minC=min(c['c'] for c in cells);maxC=max(c['c'] for c in cells)
    bounds=[max(0,math.floor((minC-.6)*cell)),max(0,math.floor((minR-.6)*cell)),math.ceil((maxC+1.6)*cell),math.ceil((maxR+1.6)*cell)]
    manifest['crops'][case]={'arrowIndices':indices,'cells':cells,'pixelBounds':bounds,'magnification':2}
    pieces=[]
    for source in ['before-cinnamon','after-cinnamon','after-sherbet']:
        image=Image.open(root/'screens'/f'{source}-board.png').convert('RGB');crop=image.crop(bounds);crop=crop.resize((crop.width*2,crop.height*2),Image.Resampling.NEAREST)
        crop.save(root/'screens'/f'{source}-{case}-2x.png');pieces.append((source,crop))
    width=max(img.width for _,img in pieces);height=max(img.height for _,img in pieces)
    gutter=32
    combined=Image.new('RGB',(width*3+gutter*2,height+42),'#FFFFFF');draw=ImageDraw.Draw(combined)
    for n,(label,img) in enumerate(pieces):
        left=n*(width+gutter);combined.paste(img,(left,42));draw.text((left+12,12),label,fill='#382F40')
        if n:draw.line((left-gutter//2,0,left-gutter//2,height+42),fill='#D6D0CC',width=1)
    combined.save(root/'screens'/f'comparison-{case}-2x.png')
(root/'screens/crops.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest,indent=2))
