#!/usr/bin/env python3
"""Run the same-APK null control first; never blame code for uncalibrated raster drift."""
import hashlib, json, pathlib, re, runpy, time
from PIL import Image, ImageChops
workspace=pathlib.Path(__file__).resolve().parents[2]
globals().update({key:value for key,value in runpy.run_path(str(workspace/'scripts/art/capture-skin-catalogue.py'),run_name='capture_helpers').items() if not key.startswith('__')})
base=workspace/'artifacts/ART-SKINS-06/perf/picker-base.apk'
off=root/'perf/catalogue-off.apk';on=root/'perf/catalogue-on.apk'
proof={'screenCellDp':29.38775416782924,'baselineCommit':'1d61234','head':'a4fa166','noUninstall':True,
       'apks':{name:hashlib.sha256(path.read_bytes()).hexdigest() for name,path in [('base',base),('off',off),('on',on)]},'captures':{}}
roi=None
def capture(label,path):
    global roi
    assert 'Success' in run('install','--no-streaming','-r',str(path))
    start();settings();shot('settings-'+label);tree=dump('settings-'+label)
    assert not any(n.attrib.get('content-desc')=='Arrow style' for n in tree.iter('node'))
    back();tap('Play');time.sleep(3);tree=dump('board-'+label);text=logs(label+'-open')
    assert 'ArtSkin' not in text
    scale=float(re.findall(r'\[board-camera\].*?scale=([\d.e-]+)',text)[-1]);assert abs(scale*40-proof['screenCellDp'])<.001
    board=next(n for n in tree.iter('node') if n.attrib.get('content-desc')=='perf-board' or n.attrib.get('resource-id','').endswith('perf-board'))
    bounds=tuple(map(int,re.findall(r'\d+',board.attrib['bounds'])))
    if roi is None:roi=bounds
    else:assert roi==bounds
    previous=None;samples=[]
    for i in range(5):
        name=f'board-{label}-sample-{i}';shot(name)
        image=Image.open(root/'screens'/f'{name}.png').convert('RGB').crop(roi)
        samples.append({'file':name+'.png','sha256':hashlib.sha256(image.tobytes()).hexdigest()})
        if previous is not None and ImageChops.difference(previous,image).getbbox() is None:
            (root/'screens'/f'board-{label}.png').write_bytes((root/'screens'/f'{name}.png').read_bytes())
            proof['captures'][label]={'settling':samples,'noPicker':True,'noSkinLogs':True,'whitePixels':sum(p==(255,255,255) for p in image.getdata())}
            return image
        previous=image;time.sleep(1.2)
    raise RuntimeError(label+' failed internal settling; raw captures retained')
def difference(a,b,label):
    diff=ImageChops.difference(a,b);diff.save(root/'checks'/f'{label}-difference.png')
    return {'differentPixels':sum(p!=(0,0,0) for p in diff.getdata()),'maxChannelDifference':max(max(p) for p in diff.getdata()),'pixelIdentical':diff.getbbox() is None}
try:
    first=capture('base-first',base)
    second=capture('base-reinstalled',base)
    proof['nullControl']=difference(first,second,'null-control')
    disabled=capture('off',off)
    proof['baseVersusOff']=difference(second,disabled,'off')
    proof['roi']=roi
    proof['exactPixelStatus']=('PASS' if proof['baseVersusOff']['pixelIdentical'] else 'FAIL') if proof['nullControl']['pixelIdentical'] else 'UNVERIFIED — same-APK null control differs'
finally:
    (root/'checks/off-verification.json').write_text(json.dumps(proof,indent=2)+'\n')
    assert 'Success' in run('install','--no-streaming','-r',str(on))
print(json.dumps(proof))
