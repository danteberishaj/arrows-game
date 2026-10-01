#!/usr/bin/env python3
"""Uninstall-free OFF/base verification on emulator-5556; retains a non-default preference."""
import runpy, pathlib, json, hashlib
from PIL import Image, ImageChops
globals().update(runpy.run_path(str(pathlib.Path(__file__).with_name('capture-skin-picker.py')), run_name='capture_helpers'))
# The measured cycle ends on the Daylight menu with Classic. Leave a non-default ID on disk for rollback.
menu_to_picker();tap(700,names['sherbet']);time.sleep(.6);shot('pre-downgrade-sherbet');dump('pre-downgrade-sherbet')
for mode in ['off','base']:
 run('install','-r',str(out/'perf'/f'picker-{mode}.apk'))
 run('shell','am','force-stop',app);run('logcat','-c');run('shell','am','start','-W','-n',app+'/.MainActivity');time.sleep(2)
 tap(905,210);time.sleep(.6);shot('settings-'+mode);xml=dump('settings-'+mode)
 assert 'Arrow style' not in xml, 'OFF/base must have no picker'
 tap(70,800);time.sleep(.8);tap(700,1930);time.sleep(2)
 shot('board-'+mode);logs=run('logcat','-d','-s','ReactNativeJS:I','ArtSkinPrep:I','ArtSkinFirstDraw:I','ArtSkinDraws:I','AndroidRuntime:E')
 (out/'checks'/f'{mode}-open.log').write_text(logs)
 assert 'ArtSkin' not in logs and '[board-camera]' in logs
run('install','-r',str(out/'perf/picker-on.apk'))
run('shell','am','force-stop',app);run('shell','am','start','-W','-n',app+'/.MainActivity');time.sleep(2)
menu_to_picker();shot('upgrade-sherbet');xml=dump('upgrade-sherbet')
tree=ET.fromstring(xml);radio=next(n for n in tree.iter('node') if n.attrib.get('content-desc')=='Sherbet');assert radio.attrib['checked']=='true'
print('OFF/base no picker + saved Sherbet survived both uninstall-free downgrades')

roi=(0,312,1440,2940)
a=Image.open(out/'screens/board-off.png').convert('RGB').crop(roi)
b=Image.open(out/'screens/board-base.png').convert('RGB').crop(roi)
assert ImageChops.difference(a,b).getbbox() is None, 'OFF board differs from literal HEAD'
proof={'base':'1d61234ed5e17066590769410b147a10456d3754','roi':roi,'pixelIdentical':True,'screenCellDp':29.38775416782924,'noPickerInOffOrBase':True,'nonDefaultIdSurvivedDowngrades':True,'apkSha256':{m:hashlib.sha256((out/'perf'/f'picker-{m}.apk').read_bytes()).hexdigest() for m in ['on','off','base']}}
(out/'checks/off-verification.json').write_text(json.dumps(proof,indent=2)+'\n')
print(json.dumps(proof,indent=2))
