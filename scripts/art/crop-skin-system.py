#!/usr/bin/env python3
"""Lossless diagnostic crops. No retouching or generated pixels; 2x nearest-neighbour magnification."""
import json, os, pathlib, math
from PIL import Image, ImageDraw
root=pathlib.Path(os.environ.get('ART_SKINS_DIR','artifacts/ART-SKINS-04'))
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
one=[(i,a['cells'][0]) for i,a in enumerate(arrows) if len(a['cells'])==1]
clusters=[]
for r in range(9,28):
    for c in range(14,23):
        cluster=[(i,cell) for i,cell in one if r<=cell['r']<r+3 and c<=cell['c']<c+4]
        clusters.append(cluster)
cluster=max(clusters,key=len)
assert len(cluster)>=6
cases['one-cell-cluster']=([cell for _,cell in cluster],[i for i,_ in cluster])
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

# Player-facing viewport evidence is separate from the complete native diagnostic board.
# Bounds come from the real perf-board accessibility node, never from the fixture bitmap.
bounds_file=root/'checks/viewport-bounds.json'
if bounds_file.exists():
    import re, hashlib
    top=json.loads(bounds_file.read_text())['top']
    inputs=[('before-cinnamon',root/'screens/before-cinnamon-viewport.png',pathlib.Path('artifacts/ART-SKINS-04/perf/cinnamon-0-open.log'))]
    for spec in ['cinnamon','sherbet']:
        raw=json.loads((root/'perf'/f'{spec}-raw.json').read_text())
        first=next(r for r in raw['runs'] if r['pair']==0 and r['enabled'])
        inputs.append((f'after-{spec}',root/'screens'/f'{spec}-on-viewport.png',root/'perf'/f'{spec}-{first["i"]}-open.log'))
    actual={'screenCellDp':29.38775416782924,'magnification':2,'arrowIndices':cases['one-cell-cluster'][1],
      'source':'actual all-META test-ads/PERF viewport screenshots, lossless nearest-neighbour crop','inputs':[]}
    pieces=[]
    cells=cases['one-cell-cluster'][0]
    for label,path,log in inputs:
        scale,tx,ty=map(float,re.findall(r'\[board-camera\].*?scale=([\d.e-]+) tx=([\d.e-]+) ty=([\d.e-]+)',log.read_text())[-1])
        assert abs(scale*40-actual['screenCellDp'])<.001
        min_r=min(c['r'] for c in cells);max_r=max(c['r'] for c in cells)
        min_c=min(c['c'] for c in cells);max_c=max(c['c'] for c in cells)
        rect=[math.floor((tx+(min_c-.6)*40*scale)*3.5),math.floor(top+(ty+(min_r-.6)*40*scale)*3.5),
          math.ceil((tx+(max_c+1.6)*40*scale)*3.5),math.ceil(top+(ty+(max_r+1.6)*40*scale)*3.5)]
        image=Image.open(path).convert('RGB');assert 0<=rect[0]<rect[2]<=image.width and 0<=rect[1]<rect[3]<=image.height
        crop=image.crop(rect);crop=crop.resize((crop.width*2,crop.height*2),Image.Resampling.NEAREST)
        crop.save(root/'screens'/f'{label}-viewport-one-cell-cluster-2x.png');pieces.append((label,crop))
        actual['inputs'].append({'label':label,'source':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
          'cameraLog':str(log),'scale':scale,'tx':tx,'ty':ty,'boardTop':top,'pixelBounds':rect})
    width=max(p.width for _,p in pieces);height=max(p.height for _,p in pieces)
    combined=Image.new('RGB',(width*3+64,height+42),'white');draw=ImageDraw.Draw(combined)
    for i,(label,img) in enumerate(pieces):
        x=i*(width+32);combined.paste(img,(x,42));draw.text((x+12,12),label,fill='#382F40')
    combined.save(root/'screens/comparison-viewport-one-cell-cluster-2x.png')
    (root/'screens/viewport-crops.json').write_text(json.dumps(actual,indent=2)+'\n')
