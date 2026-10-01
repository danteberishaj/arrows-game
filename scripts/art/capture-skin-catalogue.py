#!/usr/bin/env python3
"""Real Android UI input/captures on 5556. Never accesses a progress save or another emulator."""
import json,pathlib,re,shlex,subprocess,sys,time,xml.etree.ElementTree as ET
root=pathlib.Path(__file__).resolve().parents[2]/'artifacts/ART-SKINS-07'
adb='/Users/gentlegen/Library/Android/sdk/platform-tools/adb';app='com.danteb.arrows'
specs=json.loads((root/'checks/contract-data.json').read_text())['specs']
def run(*args,binary=False): return subprocess.check_output([adb,'-s','emulator-5556',*args],timeout=120 if args[0]=='install' else 45,text=not binary)
def shot(name): (root/'screens'/f'{name}.png').write_bytes(run('exec-out','screencap','-p',binary=True))
def dump(name='navigation'):
    # A failed idle wait must never turn a previous screen's bounds into live input.
    for attempt in range(3):
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
    settings();tap('Arrow style')
    assert any(n.attrib.get('class')=='android.widget.RadioButton' for n in dump().iter('node'))
def scroll(down,fraction=.6):
    node=next(n for n in dump().iter('node') if n.attrib.get('class')=='android.widget.ScrollView')
    x1,y1,x2,y2=map(int,re.findall(r'\d+',node.attrib['bounds']))
    x=(x1+x2)//2; high=int(y1+(y2-y1)*(.5-fraction/2)); low=int(y1+(y2-y1)*(.5+fraction/2))
    run('shell','input','swipe',str(x),str(low if down else high),str(x),str(high if down else low),'500');time.sleep(.4)
def radio(id):
    name='Classic' if id=='classic' else specs[id]['name']
    target=0 if id=='classic' else specs[id]['numericId']
    labels={'Classic':0,**{s['name']:s['numericId'] for s in specs.values()}}
    for attempt in range(9):
        tree=dump(); visible=[]
        for node in tree.iter('node'):
            if node.attrib.get('class')!='android.widget.RadioButton': continue
            label=node.attrib.get('content-desc','').split(',')[0]
            bounds=list(map(int,re.findall(r'\d+',node.attrib['bounds'])))
            if label in labels and bounds[3]-bounds[1]>=100:
                visible.append(labels[label])
                if label==name and bounds[3]-bounds[1]>=154: return node
        assert visible, 'No visible radio controls'
        scroll(target >= max(visible),.25)
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
    if mode=='rainbow-refresh':
        all_boards('light',['rainbow-ribbon']);all_boards('dark',['rainbow-ribbon'])
        open_picker();choose('strawberry-glazed');back();back()
    elif mode in ['light-boards','dark-boards']: all_boards(mode.split('-')[0])
    else: {'sequence':sequence,'dark':dark}[mode]()
