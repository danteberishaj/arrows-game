#!/usr/bin/env python3
"""Fresh owned 5556 boot per spec; never touch another AVD or hide incomplete batches."""
import os
import datetime,hashlib,json,pathlib,re,shutil,signal,subprocess,time
root=pathlib.Path(__file__).resolve().parents[2]
out=root/os.environ.get('ART_SKINS_DIR','artifacts/ART-SKINS-07')
adb='/Users/gentlegen/Library/Android/sdk/platform-tools/adb'
emulator='/Users/gentlegen/Library/Android/sdk/emulator/emulator'
node='/Users/gentlegen/.nvm/versions/node/v20.19.4/bin/node'
specs=json.loads((out/'checks/contract-data.json').read_text())['specs']
if os.environ.get('ART_SKINS_SPEC_IDS'):
    requested=os.environ['ART_SKINS_SPEC_IDS'].split(',');specs={id:specs[id] for id in requested}
apk=out/'perf/catalogue-perf.apk'
seed_apk=out/'perf/catalogue-on.apk'
sha=hashlib.sha256(apk.read_bytes()).hexdigest()
(out/'perf/device-boots').mkdir(exist_ok=True)
def device(*args,timeout=15):
    return subprocess.check_output([adb,'-s','emulator-5556',*args],text=True,timeout=timeout)
def stop_owned():
    lines=subprocess.check_output(['ps','-axo','pid,command'],text=True).splitlines()
    owned=[int(line.strip().split(None,1)[0]) for line in lines
      if re.search(r'^\s*\d+ /\S+/qemu-system-\S+ -avd fleet_floor_api31 -port 5556(?: |$)',line)]
    assert len(owned)<=1
    for pid in owned:
        subprocess.run(['kill','-TERM',str(pid)],check=True)
        for _ in range(30):
            if subprocess.run(['kill','-0',str(pid)],stderr=subprocess.DEVNULL).returncode: break
            time.sleep(1)
        else: raise RuntimeError('Owned emulator did not stop')
def boot(id,label):
    stop_owned()
    log=out/'perf/device-boots'/f'{id}-{label}.txt'
    with log.open('w') as stream:
        process=subprocess.Popen([emulator,'-avd','fleet_floor_api31','-port','5556','-no-snapshot','-no-boot-anim','-gpu','host','-no-audio'],stdout=stream,stderr=subprocess.STDOUT,start_new_session=True)
    for _ in range(75):
        if process.poll() is not None: raise RuntimeError('Owned emulator exited during boot')
        try:
            if device('shell','getprop','sys.boot_completed').strip()=='1': break
        except (subprocess.SubprocessError,OSError): pass
        time.sleep(2)
    else: raise RuntimeError('Boot did not complete')
    time.sleep(20)
    (out/'perf/owned-emulator.json').write_text(json.dumps({'pid':process.pid,'gpu':'host','avd':'fleet_floor_api31','serial':'emulator-5556'}))
    return process.pid
runTag=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
if os.environ.get('ART_SKINS_LIVE_HIERARCHY')=='1':
    subprocess.run(['python3',str(root/'scripts/art/build-skin-hierarchy.py')],cwd=root,env=os.environ,check=True)
for id in specs:
    raw=out/'perf'/f'{id}-raw.json'
    if raw.exists():
        previous=json.loads(raw.read_text())
        if previous.get('apkSha256')==sha and len(previous['runs'])==24 and previous.get('deviceBoot',{}).get('systemServerStable'):
            print(id+': already complete on this APK',flush=True);continue
    for attempt in range(2):
        try:
            pid=boot(id,runTag+'-'+str(attempt))
            if os.environ.get('ART_SKINS_LIVE_HIERARCHY')=='1':
                device('shell','mkdir','-p','/data/local/tmp/local/tmp')
                device('push',str(out/'checks/hierarchy-driver/hierarchy.jar'),'/data/local/tmp/art08-hierarchy.jar')
            # Seed the real preference without navigating away from a cold native board.
            # Both arms below still use the exact same PERF APK; setup is not a timed open.
            assert 'Success' in device('install','--no-streaming','-r',str(seed_apk),timeout=120)
            subprocess.run(['python3',str(root/'scripts/art/capture-skin-catalogue.py'),'select-menu-style',id],cwd=root,env=os.environ,check=True,timeout=600)
            assert 'Success' in device('install','--no-streaming','-r',str(apk),timeout=120)
            display=device('shell','wm','size')+device('shell','wm','density')
            assert '1440x3120' in display and '560' in display
            system_pid=device('shell','pidof','system_server').strip()
            log=out/'perf'/f'{id}-measurement.txt'
            with log.open('w') as stream:
                subprocess.run([node,str(root/'scripts/art/measure-skin-catalogue.mjs'),id],cwd=root,stdout=stream,stderr=subprocess.STDOUT,check=True,timeout=3600)
            stable=system_pid==device('shell','pidof','system_server').strip()
            data=json.loads(raw.read_text());data['deviceBoot']={'policy':'fresh same-config boot per spec; 20 s settle','pid':pid,'systemServerPid':system_pid,'systemServerStable':stable,'display':display}
            data['selectionPreparation']={'method':'real picker in menu-start capture APK before timed opens','hierarchy':'live stable-bounds shell reader' if os.environ.get('ART_SKINS_LIVE_HIERARCHY')=='1' else 'standard idle reader','seedApkSha256':hashlib.sha256(seed_apk.read_bytes()).hexdigest(),'style':id,'board':specs[id].get('board'),'xml':f'checks/benchmark-selection-{id}.xml'}
            raw.write_text(json.dumps(data,indent=2)+'\n')
            assert stable and len(data['runs'])==24
            print(id+': 12 complete shuffled pairs at 29.387754 dp; system server stable',flush=True)
            break
        except (subprocess.SubprocessError,OSError,AssertionError,RuntimeError) as error:
            rejected=out/'checks/rejected-opening'/f'{id}-{runTag}-{attempt}'
            rejected.mkdir(parents=True,exist_ok=True)
            for path in (out/'perf').glob(id+'-*'):
                if path.is_file(): path.rename(rejected/path.name)
            for path in [out/'checks/navigation.xml', *(out/'checks').glob('benchmark-*'+id+'*')]:
                if path.is_file(): shutil.copy2(path,rejected/path.name)
            (rejected/'reason.txt').write_text(str(error)+'\n')
            print(id+': rejected incomplete batch: '+str(error),flush=True)
    else:
        raise RuntimeError(id+': no completed batch after recovery; raw attempts retained')
print(f'All {len(specs)} specs have 12 complete same-APK pairs. Exit frame status remains subject to the quiet-host gate.',flush=True)
