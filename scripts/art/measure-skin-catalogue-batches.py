#!/usr/bin/env python3
"""Fresh owned 5556 boot per spec; never touch another AVD or hide incomplete batches."""
import datetime,hashlib,json,pathlib,re,signal,subprocess,time
root=pathlib.Path(__file__).resolve().parents[2]
out=root/'artifacts/ART-SKINS-07'
adb='/Users/gentlegen/Library/Android/sdk/platform-tools/adb'
emulator='/Users/gentlegen/Library/Android/sdk/emulator/emulator'
node='/Users/gentlegen/.nvm/versions/node/v20.19.4/bin/node'
specs=json.loads((out/'checks/contract-data.json').read_text())['specs']
apk=out/'perf/catalogue-perf.apk'
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
    log=out/'perf/device-boots'/f'{id}-{attempt}.txt'
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
installed=False
for id in specs:
    raw=out/'perf'/f'{id}-raw.json'
    if raw.exists():
        previous=json.loads(raw.read_text())
        if previous.get('apkSha256')==sha and len(previous['runs'])==24 and previous.get('deviceBoot',{}).get('systemServerStable'):
            print(id+': already complete on this APK',flush=True);continue
    for attempt in range(2):
        try:
            pid=boot(id,runTag+'-'+str(attempt))
            if not installed:
                assert 'Success' in device('install','--no-streaming','-r',str(apk),timeout=120)
                installed=True
            display=device('shell','wm','size')+device('shell','wm','density')
            assert '1440x3120' in display and '560' in display
            system_pid=device('shell','pidof','system_server').strip()
            log=out/'perf'/f'{id}-measurement.txt'
            with log.open('w') as stream:
                subprocess.run([node,str(root/'scripts/art/measure-skin-catalogue.mjs'),id],cwd=root,stdout=stream,stderr=subprocess.STDOUT,check=True,timeout=1800)
            stable=system_pid==device('shell','pidof','system_server').strip()
            data=json.loads(raw.read_text());data['deviceBoot']={'policy':'fresh same-config boot per spec; 20 s settle','pid':pid,'systemServerPid':system_pid,'systemServerStable':stable,'display':display}
            raw.write_text(json.dumps(data,indent=2)+'\n')
            assert stable and len(data['runs'])==24
            print(id+': 12 complete shuffled pairs at 29.387754 dp; system server stable',flush=True)
            break
        except (subprocess.SubprocessError,OSError,AssertionError,RuntimeError) as error:
            rejected=out/'checks/rejected-opening'/f'{id}-{runTag}-{attempt}'
            rejected.mkdir(parents=True,exist_ok=True)
            for path in (out/'perf').glob(id+'-*'):
                if path.is_file(): path.rename(rejected/path.name)
            (rejected/'reason.txt').write_text(str(error)+'\n')
            print(id+': rejected incomplete batch: '+str(error),flush=True)
    else:
        raise RuntimeError(id+': no completed batch after recovery; raw attempts retained')
print('All 17 specs have 12 complete same-APK pairs. Exit frame status remains subject to the quiet-host gate.',flush=True)
