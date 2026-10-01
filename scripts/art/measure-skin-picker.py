#!/usr/bin/env python3
"""Actual menu-picker input and first recorded board frame, on emulator-5556 only."""
import subprocess, pathlib, time, json, re, hashlib, shlex, xml.etree.ElementTree as ET
ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT/'artifacts/ART-SKINS-06'
ADB = '/Users/gentlegen/Library/Android/sdk/platform-tools/adb'
APP = 'com.danteb.arrows'
def adb(*args, binary=False):
    return subprocess.check_output([ADB,'-s','emulator-5556',*args],timeout=30,text=not binary)
def tap(x,y): adb('shell','input','tap',str(x),str(y))
def anchor():
    return json.loads(adb('shell','env','CLASSPATH=/data/local/tmp/art06-clock.jar','app_process','/system/bin','com.arrows.art.SkinPickerClock'))
def host():
    return {'uptime':subprocess.check_output(['uptime'],text=True).strip(),
        'emulators':[line for line in subprocess.check_output(['ps','-axo','command'],text=True).splitlines() if 'qemu-system-' in line]}
def shot(name): (OUT/'screens'/f'{name}.png').write_bytes(adb('exec-out','screencap','-p',binary=True))
adb('push',str(OUT/'perf/clock/clock.jar'),'/data/local/tmp/art06-clock.jar')
# Reset the foreground app before each sample; validate actual radio UI before timing.
rows={'classic':1333,'cinnamon':1543,'sherbet':1753}
data={'serial':'emulator-5556','graphics':'swiftshader_indirect','dpi':560,'physical':[1440,3120],
    'apkSha256':hashlib.sha256((OUT/'perf/picker-on.apk').read_bytes()).hexdigest(),
    'order':['cinnamon','sherbet','classic']*6,'runs':[]}
for i,target in enumerate(data['order']):
    before=host()
    adb('shell','am','force-stop',APP);adb('shell','am','start','-W','-n',APP+'/.MainActivity');time.sleep(2)
    tap(905,210);time.sleep(.8);tap(700,1455);time.sleep(.8)
    adb('shell','uiautomator','dump','/sdcard/art06-measure.xml')
    ui=ET.fromstring(adb('shell','cat','/sdcard/art06-measure.xml'))
    radios=[n for n in ui.iter('node') if n.attrib.get('class')=='android.widget.RadioButton']
    assert len(radios)==3, 'Reject navigation unless all three actual radios are visible'
    chosen=next(n for n in radios if n.attrib.get('checked')=='true').attrib['content-desc']
    if i==0 and chosen=='Cinnamon Roll':
        tap(700,rows['classic']);time.sleep(.5)
    elif i>0:
        assert chosen=={'classic':'Classic','cinnamon':'Cinnamon Roll','sherbet':'Sherbet'}[data['order'][i-1]]
    adb('logcat','-c')
    start=anchor()
    remote=f'/sdcard/art06-switch-{i}.mp4'
    command=f'echo $$; exec screenrecord --size 720x1560 --bit-rate 4M --time-limit 15 {remote}'
    recorder=subprocess.Popen([ADB,'-s','emulator-5556','shell','sh','-c',shlex.quote(command)],stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    recorderPid=recorder.stdout.readline().decode().strip()
    assert recorderPid.isdigit(), 'No owned recorder PID'
    time.sleep(.7)
    tap(700,rows[target]);time.sleep(.4)
    adb('shell','input','keyevent','4');time.sleep(.8);adb('shell','input','keyevent','4');time.sleep(.8);tap(700,1930);time.sleep(3)
    end=anchor()
    adb('shell','kill','-2',recorderPid);recordingOutput=recorder.communicate(timeout=15)[0].decode()
    video=f'switch-{i:02d}-{target}.mp4'
    adb('pull',remote,str(OUT/'perf'/video))
    logs=adb('logcat','-d','-v','epoch','-s','ReactNativeJS:I','ArtSkinPrep:I','ArtSkinFirstDraw:I','ArtSkinDraws:I','ArtSkinSpec:E','AndroidRuntime:E')
    (OUT/'perf'/f'switch-{i:02d}-{target}.log').write_text(logs)
    camera=re.findall(r'\[board-camera\].*?scale=([\d.e-]+)',logs)
    assert camera and abs(float(camera[-1])*40-29.387754)<.001, 'No real-config board; reject missed Play taps'
    taps=re.findall(r'\[skin-picker\] target=(\w+) tapEpochMs=(\d+)',logs)
    assert len(taps)==1 and taps[0][0]==target, 'Must change selection exactly once'
    preparations=re.findall(r'ArtSkinPrep:.*?spec=(\w+)',logs)
    if target!='classic': assert preparations==[target] and 'detail=2' in logs, 'Must prepare full detail exactly once'
    if i<3: shot('measured-'+target)
    run={'i':i,'target':target,'tapEpochMs':int(taps[0][1]),'screenCellDp':float(camera[-1])*40,
        'startClock':start,'endClock':end,'hostBefore':before,'hostAfter':host(),'video':video,
        'recordingPid':recorderPid,'recordingOutput':recordingOutput,'preparations':preparations}
    draw=re.findall(r'([\d.]+)\s+\d+\s+\d+\s+I ArtSkinFirstDraw: drawNs=(\d+)',logs)
    if draw: run['tapToDrawCommandMs']=float(draw[-1][0])*1000-run['tapEpochMs'];run['firstDrawCommandMs']=int(draw[-1][1])/1e6
    data['runs'].append(run)
    (OUT/'perf/switch-raw.json').write_text(json.dumps(data,indent=2)+'\n')
    print(json.dumps({'i':i,'target':target,'screenCellDp':run['screenCellDp'],'preparations':preparations}),flush=True)
    tap(110,210);time.sleep(.8)
