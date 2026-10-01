#!/usr/bin/env python3
"""Uninstall-free OFF comparison on 5556; settle within each APK, never loosen pixel equality."""
import runpy,pathlib,json,hashlib
from PIL import Image,ImageChops
workspace=pathlib.Path(__file__).resolve().parents[2]
globals().update(runpy.run_path(str(workspace/'scripts/art/capture-skin-catalogue.py'),run_name='capture_helpers'))
on=workspace/'artifacts/ART-SKINS-07/perf/catalogue-on.apk'
off=workspace/'artifacts/ART-SKINS-07/perf/catalogue-off.apk'
base=workspace/'artifacts/ART-SKINS-06/perf/picker-base.apk'
run('install','--no-streaming','-r',str(on));start();open_picker();choose('strawberry-glazed');back();back()
# Retain every settling sample. Cross-APK comparison uses the first internally stable pair,
# not whichever image happens to match the other APK. No tolerance or colour conversion trick.
proof={'status':'PENDING','screenCellDp':29.38775416782924,'baselineCommit':'1d61234','head':'bad7903',
       'baselineRuntimeIdenticalToHEAD':True,'displayChanged':False,'animationSettingsChanged':False,
       'apks':{mode:hashlib.sha256(path.read_bytes()).hexdigest() for mode,path in [('on',on),('off',off),('base',base)]},'settling':{}}
try:
    for mode,path in [('off',off),('base',base)]:
        run('install','--no-streaming','-r',str(path));start();settings();shot('settings-'+mode);tree=dump('settings-'+mode)
        assert not any(n.attrib.get('content-desc')=='Arrow style' for n in tree.iter('node'))
        back();time.sleep(1);tap('Play');time.sleep(3);tree=dump('board-'+mode);text=logs(mode+'-open')
        board=next(n for n in tree.iter('node') if n.attrib.get('content-desc')=='perf-board' or n.attrib.get('resource-id','').endswith('perf-board'))
        bounds=tuple(map(int,re.findall(r'\d+',board.attrib['bounds'])))
        if mode=='off': roi=bounds
        else: assert bounds==roi
        assert 'ArtSkin' not in text and '[board-camera]' in text
        previous=None; samples=[]
        for i in range(5):
            name=f'board-{mode}-sample-{i}';shot(name)
            image=Image.open(root/'screens'/f'{name}.png').convert('RGB').crop(roi)
            samples.append({'file':name+'.png','sha256':hashlib.sha256(image.tobytes()).hexdigest()})
            if previous is not None and ImageChops.difference(previous,image).getbbox() is None:
                (root/'screens'/f'board-{mode}.png').write_bytes((root/'screens'/f'{name}.png').read_bytes());break
            previous=image;time.sleep(1.2)
        else: raise RuntimeError(mode+' board did not stabilize; all raw samples retained')
        proof['settling'][mode]=samples
    a=Image.open(root/'screens/board-off.png').convert('RGB').crop(roi)
    b=Image.open(root/'screens/board-base.png').convert('RGB').crop(roi)
    difference=ImageChops.difference(a,b);difference.save(root/'checks/off-difference.png')
    proof.update({'roi':roi,'pixelIdentical':difference.getbbox() is None,
       'differentPixels':sum(p!=(0,0,0) for p in difference.getdata()),
       'maxChannelDifference':max(max(p) for p in difference.getdata()),'noPickerOffAndBase':True})
finally:
    # A failed comparison must still restore the enabled test build without uninstalling.
    run('install','--no-streaming','-r',str(on));start();open_picker()
    node=radio('strawberry-glazed');assert node.attrib['checked']=='true';shot('upgrade-strawberry');dump('upgrade-strawberry')
    proof['nonDefaultIdSurvivedDowngrades']=True;back();back()
proof['status']='PASS' if proof['pixelIdentical'] else 'FAIL'
(root/'checks/off-verification.json').write_text(json.dumps(proof,indent=2)+'\n')
print(json.dumps(proof))
assert proof['pixelIdentical'], 'OFF differs from baseline; exact raw result retained, enabled build restored'
