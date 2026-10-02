#!/usr/bin/env python3
"""Real Android UI input/captures on 5556. Never accesses a progress save or another emulator."""
import os
import json,pathlib,re,shlex,subprocess,sys,time,xml.etree.ElementTree as ET
root=pathlib.Path(__file__).resolve().parents[2]/os.environ.get('ART_SKINS_DIR','artifacts/ART-SKINS-07')
adb='/Users/gentlegen/Library/Android/sdk/platform-tools/adb';app='com.danteb.arrows'
specs=json.loads((root/'checks/contract-data.json').read_text())['specs']
def run(*args,binary=False):
    timeout=120 if args[0]=='install' else 45
    if os.environ.get('ART_SKINS_LIVE_HIERARCHY')=='1' and args[:3]==('shell','uiautomator','runtest'):
        timeout=90
    return subprocess.check_output([adb,'-s','emulator-5556',*args],timeout=timeout,text=not binary)
def shot(name): (root/'screens'/f'{name}.png').write_bytes(run('exec-out','screencap','-p',binary=True))
def dump(name='navigation'):
    # A failed idle wait must never turn a previous screen's bounds into live input.
    for attempt in range(3):
        if os.environ.get('ART_SKINS_LIVE_HIERARCHY')=='1':
            path='/data/local/tmp/local/tmp/art08-live-ui.xml'
            run('shell','rm','-f',path)
            try:
                result=run('shell','uiautomator','runtest','/system/framework/android.test.runner.jar',
                           '/system/framework/android.test.base.jar','/data/local/tmp/art08-hierarchy.jar',
                           '-c','com.arrows.art.ArrowsHierarchy#testDump')
            except (subprocess.CalledProcessError,subprocess.TimeoutExpired) as error:
                output=error.output or ''
                if isinstance(output,bytes): output=output.decode(errors='replace')
                rejected=root/'checks/rejected-opening'
                rejected.mkdir(exist_ok=True)
                (rejected/f'reader-failure-{time.time_ns()}.txt').write_text(str(error)+'\n'+output)
                raise
            if 'No fresh hierarchy' in result:
                # A cold window may not have an accessibility root yet. No stale file
                # is accepted, and the bounded retry does not wait for global idle.
                time.sleep(1)
                continue
            assert 'OK (1 test)' in result and 'FAILURES' not in result and 'shortMsg' not in result, result
            text=run('shell','cat',path)
            tree=ET.fromstring(text)
            (root/'checks'/f'{name}.xml').write_text(text)
            return tree
        run('shell','rm','-f','/sdcard/art07-ui.xml')
        result=run('shell','uiautomator','dump','/sdcard/art07-ui.xml')
        if 'dumped to' in result:
            text=run('shell','cat','/sdcard/art07-ui.xml')
            tree=ET.fromstring(text)
            (root/'checks'/f'{name}.xml').write_text(text)
            return tree
        time.sleep(.5)
    raise RuntimeError('No fresh accessibility dump: '+name)
def tap_node(node):
    x1,y1,x2,y2=map(int,re.findall(r'\d+',node.attrib['bounds']))
    assert x2>x1 and y2>y1
    run('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2));time.sleep(.4)
def find(name):
    return next((n for n in dump().iter('node') if n.attrib.get('content-desc')==name or n.attrib.get('content-desc','').startswith(name+',') or n.attrib.get('text')==name),None)
def tap(name):
    # Home breathes continuously under all META flags; its observed physical controls
    # cannot wait for UiAutomator idle. Picker controls still use live accessible bounds.
    observed={'Settings':(905,210),'Play':(700,1930),'Back':(110,210),'Dark mode':(1300,210)}
    if name in observed:
        x,y=observed[name];run('shell','input','tap',str(x),str(y));time.sleep(.7);return
    node=find(name)
    if node is None: raise RuntimeError('No rendered control '+name)
    # Sheet bounds can be reported before the existing panel spring has settled.
    for attempt in range(4):
        time.sleep(.4)
        current=find(name)
        if current is not None and current.attrib['bounds']==node.attrib['bounds']:
            tap_node(current);return
        node=current
        if node is None: raise RuntimeError('Control disappeared before input: '+name)
    raise RuntimeError('Control did not settle: '+name)
def back(): run('shell','input','keyevent','4');time.sleep(.5)
def start():
    run('shell','am','force-stop',app);run('logcat','-c');run('shell','input','keyevent','224')
    run('shell','am','start','-W','-n',app+'/.MainActivity');time.sleep(5)
    # The menu is verified by real captures; querying idle here never completes
    # while its existing Play breathing runs. No animation settings are changed.
def settings():
    # A successful tap is established by the actual panel, never by absence of a picker.
    for attempt in range(3):
        tap('Settings')
        tree=dump()
        if any(n.attrib.get('resource-id')=='settings-panel' for n in tree.iter('node')): return
        time.sleep(1)
    raise RuntimeError('Settings panel did not open')
def open_picker():
    settings()
    for attempt in range(3):
        tap('Arrow style')
        tree=dump()
        if any(n.attrib.get('class')=='android.widget.RadioButton' for n in tree.iter('node')): return tree
        # Touch delivery and panel state can lag on a contended host. Retry only from
        # the still-observed Settings panel; never invent bounds on an unknown screen.
        assert any(n.attrib.get('resource-id')=='settings-panel' for n in tree.iter('node')), 'Picker input left an unknown screen'
        time.sleep(1)
    raise RuntimeError('Picker did not open after observed Settings input')
def scroll(down,fraction=.6,observed_tree=None):
    tree=observed_tree if observed_tree is not None else dump()
    node=next(n for n in tree.iter('node') if n.attrib.get('class')=='android.widget.ScrollView')
    x1,y1,x2,y2=map(int,re.findall(r'\d+',node.attrib['bounds']))
    x=(x1+x2)//2; high=int(y1+(y2-y1)*(.5-fraction/2)); low=int(y1+(y2-y1)*(.5+fraction/2))
    run('shell','input','swipe',str(x),str(low if down else high),str(x),str(high if down else low),'500');time.sleep(.4)
def radio(id):
    name='Classic' if id=='classic' else specs[id]['name']
    target=0 if id=='classic' else specs[id]['numericId']
    labels={'Classic':0,**{s['name']:s['numericId'] for s in specs.values()}}
    scans=None
    if os.environ.get('ART_SKINS_LIVE_HIERARCHY')=='1':
        scans=root/'checks/picker-scans'/id/str(time.time_ns())
        scans.mkdir(parents=True)
    for attempt in range(9):
        tree=dump(); visible=[]
        if scans is not None:
            (scans/f'{attempt}.xml').write_text((root/'checks/navigation.xml').read_text())
        for node in tree.iter('node'):
            if node.attrib.get('class')!='android.widget.RadioButton': continue
            label=node.attrib.get('content-desc','').split(',')[0]
            bounds=list(map(int,re.findall(r'\d+',node.attrib['bounds'])))
            if label in labels and bounds[3]-bounds[1]>=100:
                visible.append(labels[label])
                if label==name and bounds[3]-bounds[1]>=154: return node
        assert visible, 'No visible radio controls'
        # This snapshot was just read and no input has occurred since it. Reuse its
        # actual scroll bounds; do not reconnect accessibility for the same state.
        scroll(target >= max(visible),.25,observed_tree=tree)
    raise RuntimeError('Radio not reachable '+name)
def choose(id): tap_node(radio(id))
def to_board():
    back();back();tap('Play');time.sleep(1.7)
def to_home(): tap('Back');time.sleep(.5)
def logs(name):
    text=run('logcat','-d','-v','epoch','-s','ReactNativeJS:I','ArtSkinPrep:I','ArtSkinFirstDraw:I','ArtSkinDraws:I','ArtSkinSpec:E','AndroidRuntime:E')
    (root/'checks'/f'{name}.log').write_text(text);return text

def picker_pages(theme):
    for page in range(4):
        shot(f'picker-{theme}-{page}');dump(f'picker-{theme}-{page}')
        scroll(True)

def sequence():
    start();open_picker();picker_pages('light')
    choose('classic');back();back();tap('Settings')
    cmd=shlex.quote('echo $$; exec screenrecord --size 720x1560 --bit-rate 4M --time-limit 180 /sdcard/art07-switches.mp4')
    recorder=subprocess.Popen([adb,'-s','emulator-5556','shell','sh','-c',cmd],stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    pid=recorder.stdout.readline().decode().strip();assert pid.isdigit();recordStarted=time.time()
    try:
        tap('Arrow style')
        for id in ['cinnamon','critter','yarn','rainbow-ribbon','neon-glass','classic']:
            run('logcat','-c');choose(id);to_board();shot('switch-'+id)
            text=logs('switch-'+id)
            assert '[board-camera]' in text
            if id!='classic': assert f'spec={id}' in text and 'detail=2' in text
            to_home();open_picker()
        start();open_picker();shot('restart-classic');tree=dump('restart-classic')
        assert next(n for n in tree.iter('node') if n.attrib.get('content-desc')=='Classic').attrib['checked']=='true'
    finally:

        if recorder.poll() is None: run('shell','kill','-2',pid)
        recorder.wait(timeout=15)
        run('pull','/sdcard/art07-switches.mp4',str(root/'screens/settings-switch-restart.mp4'))
    assert time.time()-recordStarted < 178, 'Recording limit would omit restart; rejected'
    (root/'checks/recording-duration.json').write_text(json.dumps({'wallSeconds':time.time()-recordStarted,'maxSeconds':180,'styles':['cinnamon','critter','yarn','rainbow-ribbon','neon-glass','classic'],'restart':'Classic'}))
    # Separate non-default save/restart evidence, retained for PERF opening diagnostics.
    choose('strawberry-glazed');start();open_picker();node=radio('strawberry-glazed');assert node.attrib['checked']=='true';shot('restart-strawberry');dump('restart-strawberry')
    back();back()

def dark():
    tap('Dark mode');open_picker();picker_pages('dark');back();back()



def all_boards(theme,ids=None):
    # One live app session keeps the in-memory theme while selection goes through real radios.
    if theme == 'light': start()
    else: tap('Dark mode')
    for id in ids or ['classic', *specs]:
        open_picker(); choose(id); run('logcat','-c'); to_board(); shot(f'{id}-{theme}-viewport'); dump(f'{id}-{theme}-viewport')
        text=logs(f'{id}-{theme}-viewport')
        assert '[board-camera]' in text
        if id!='classic': assert f'spec={id}' in text and 'detail=2' in text
        to_home();print(f'{theme}: {id} captured at 29.387754 dp',flush=True)

if __name__=='__main__':
    mode=sys.argv[1]
    if mode=='select-menu-style':
        id=sys.argv[2];started=time.monotonic();start();time.sleep(7)
        # Fixed startup delays can expose an empty RN container on a loaded boot.
        # Act only after a fresh hierarchy contains the actual menu control.
        canonical=root/'checks'/f'benchmark-seed-menu-{id}.xml'
        canonical.unlink(missing_ok=True)
        for attempt in range(6):
            snapshot=f'benchmark-seed-menu-{id}-{attempt}'
            tree=dump(snapshot)
            if any(n.attrib.get('content-desc')=='Settings' for n in tree.iter('node')):
                canonical.write_text((root/'checks'/f'{snapshot}.xml').read_text())
                break
            time.sleep(1)
        else: raise RuntimeError('No settled menu before picker setup: '+id)
        print(f'{id}: observed menu after {time.monotonic()-started:.3f}s untimed setup/reader wall time',flush=True)
        initial=open_picker()
        prior=[n.attrib.get('content-desc','').split(',')[0] for n in initial.iter('node')
               if n.attrib.get('class')=='android.widget.RadioButton' and n.attrib.get('checked')=='true']
        (root/'checks'/f'benchmark-selection-start-{id}.json').write_text(json.dumps({
            'requested':id,'checkedBeforeSelection':prior,'scope':'Observed picker after navigation, before intended style selection; offscreen checks may be absent. Not a save-file read.'},indent=2)+'\n')
        choose(id)
        assert radio(id).attrib['checked']=='true'
        dump(f'benchmark-selection-{id}')
        print(f'{id}: real picker preference checked; untimed setup complete',flush=True)
        back();back()
    elif mode=='select-perf-style':
        id=sys.argv[2];start()
        # Fresh emulator boots can expose the header before JS/native preparation settles.
        # Observe the first board before issuing Back; a coordinate tap alone is no proof.
        for attempt in range(30):
            text=logs('benchmark-seed-opening-'+id)
            if '[board-camera]' in text and 'ArtSkinFirstDraw' in text: break
            time.sleep(1)
        else: raise RuntimeError('No completed seed opening: '+id)
        to_home()
        tree=dump('benchmark-seed-home-'+id)
        assert not any(n.attrib.get('content-desc')=='perf-board' for n in tree.iter('node')), 'Back did not leave the seed board'
        open_picker();choose(id)
        assert radio(id).attrib['checked']=='true'
        dump(f'benchmark-selection-{id}');back();back()
    elif mode=='rainbow-refresh':
        all_boards('light',['rainbow-ribbon']);all_boards('dark',['rainbow-ribbon'])
        open_picker();choose('strawberry-glazed');back();back()
    elif mode in ['polish-light-boards','polish-dark-boards']:
        all_boards(mode.split('-')[1],['cinnamon','sherbet','candy-gloss','jelly','critter','rainbow-ribbon','campfire','strawberry-glazed','archery','ink-pro','clear-glass','paper-craft'])
    elif mode in ['light-boards','dark-boards']: all_boards(mode.split('-')[0])
    else: {'sequence':sequence,'dark':dark}[mode]()
