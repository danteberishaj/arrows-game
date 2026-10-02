#!/usr/bin/env python3
"""Ordinary test-ads capture: real picker, accepted core inputs, theme/save restart; no save editing."""
import json, pathlib, re, runpy, shlex, subprocess, time
from PIL import Image, ImageChops
workspace=pathlib.Path(__file__).resolve().parents[2]
globals().update({key:value for key,value in runpy.run_path(str(workspace/'scripts/art/capture-skin-catalogue.py'),run_name='capture_helpers').items() if not key.startswith('__')})
node='/Users/gentlegen/.nvm/versions/node/v20.19.4/bin/node'
evidence={'apk':'perf/catalogue-phone.apk','noUninstall':True,'displayOrAnimationChanges':False,'events':[]}
def event(name,**values):evidence['events'].append({'name':name,'hostSeconds':time.time(),**values})
def tint_bounds(name,colour):
    shot(name);image=Image.open(root/'screens'/f'{name}.png').convert('RGB')
    diff=ImageChops.difference(image,Image.new('RGB',image.size,colour))
    r,g,b=diff.split();mask=ImageChops.lighter(ImageChops.lighter(r,g),b).point(lambda v:255 if v==0 else 0)
    count=mask.histogram()[255];bounds=mask.getbbox();assert count>100000 and bounds is not None
    return {'colour':colour,'pixels':count,'bounds':bounds}
def remaining(name):
    tree=dump(name);values=[n.attrib.get('content-desc','') for n in tree.iter('node')]
    labels=[v for v in values if re.fullmatch(r'\d+ left',v)];assert len(labels)==1;return int(labels[0].split()[0])
def main():
    assert 'Success' in run('install','--no-streaming','-r',str(root/'perf/catalogue-phone.apk'))
    start();shot('phone-menu-before');open_picker();target=radio('critter');shot('phone-picker-before')
    command=shlex.quote('echo $$; exec screenrecord --size 720x1560 --bit-rate 4M --time-limit 180 /sdcard/art08-phone.mp4')
    recorder=subprocess.Popen([adb,'-s','emulator-5556','shell','sh','-c',command],stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    pid=recorder.stdout.readline().decode().strip();assert pid.isdigit();started=time.time()
    try:
        tap_node(target);event('pick-critter');run('logcat','-c');to_board()
        tint=tint_bounds('phone-critter-opening',specs['critter']['board']['light'])
        text=logs('phone-critter-opening');assert 'spec=critter' in text
        scale,tx,ty=map(float,re.findall(r'\[board-camera\].*?scale=([\d.e-]+) tx=([\d.e-]+) ty=([\d.e-]+)',text)[-1])
        assert abs(scale*40-29.387754)<.001
        # Two flings settle against the existing right-board pan clamp. No zoom/display change.
        for _ in range(2):run('shell','input','swipe','1260','1600','180','1600','250');time.sleep(2)
        pan=tint_bounds('phone-critter-panned',specs['critter']['board']['light'])
        level=json.loads((root/'checks/contract-data.json').read_text())['levels'][-1]
        width=float(re.findall(r'viewport=([\d.e-]+)x',text)[-1]);tx=width-level['cols']*40*scale-min(72,width*.25)
        plan=json.loads(subprocess.check_output([node,str(workspace/'scripts/art/skin-polish-gesture-plan.cjs'),*[str(v) for v in [scale,tx,ty,pan['bounds'][1],pan['bounds'][3]]]],text=True))
        assert remaining('phone-before-input')==250
        blocked=plan['blocked'];run('shell','input','tap',str(blocked['point']['x']),str(blocked['point']['y']));event('blocked-tap',arrow=blocked)
        shot('phone-critter-blocked');time.sleep(.5);assert remaining('phone-after-blocked')==250
        for arrow in plan['exits']:
            run('shell','input','tap',str(arrow['point']['x']),str(arrow['point']['y']));event('clear-arrow',arrow=arrow);time.sleep(1)
        assert remaining('phone-after-five')==245;shot('phone-critter-five-cleared')
        evidence['plan']=plan;evidence['critterTint']=tint;evidence['remainingAfterFive']=245
        to_home();open_picker();choose('cinnamon');event('pick-cinnamon');to_board()
        evidence['cinnamonLight']=tint_bounds('phone-cinnamon-light',specs['cinnamon']['board']['light'])
        to_home();tap('Dark mode');event('toggle-dark');tap('Play');time.sleep(2)
        evidence['cinnamonDark']=tint_bounds('phone-cinnamon-dark',specs['cinnamon']['board']['dark'])
        start();event('kill-and-relaunch');tap('Play');time.sleep(2)
        evidence['restartTint']=tint_bounds('phone-restart-cinnamon-dark',specs['cinnamon']['board']['dark'])
        text=logs('phone-restart-cinnamon-dark');assert 'spec=cinnamon' in text
        evidence['restartStyleAndTheme']='PASS';time.sleep(1)
    finally:
        if recorder.poll() is None:run('shell','kill','-2',pid)
        recorder.wait(timeout=20);run('pull','/sdcard/art08-phone.mp4',str(root/'screens/critter-clears-cinnamon-dark-restart.mp4'))
        evidence['recordingWallSeconds']=time.time()-started
        (root/'checks/phone-interaction.json').write_text(json.dumps(evidence,indent=2)+'\n')
    assert evidence['recordingWallSeconds']<178,'Recording may have truncated the restart'
    print(json.dumps(evidence))
if __name__=='__main__':main()
