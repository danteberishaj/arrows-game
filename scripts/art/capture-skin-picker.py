#!/usr/bin/env python3
import subprocess,pathlib,time,json,xml.etree.ElementTree as ET,re,sys,hashlib,shlex
root=pathlib.Path(__file__).resolve().parents[2];out=root/'artifacts/ART-SKINS-06';adb='/Users/gentlegen/Library/Android/sdk/platform-tools/adb';app='com.danteb.arrows'
def run(*args,binary=False): return subprocess.check_output([adb,'-s','emulator-5556',*args],timeout=30,text=not binary)
def tap(x,y): run('shell','input','tap',str(x),str(y))
def shot(name): (out/'screens'/f'{name}.png').write_bytes(run('exec-out','screencap','-p',binary=True))
def dump(name):
 run('shell','uiautomator','dump','/sdcard/art06.xml');s=run('shell','cat','/sdcard/art06.xml');(out/'checks'/f'{name}.xml').write_text(s);return s
names={'classic':1333,'cinnamon':1543,'sherbet':1753}
def menu_to_picker():
 tap(905,210);time.sleep(.6);tap(700,1455);time.sleep(.5)
def picker_to_board(id):
 tap(700,names[id]);time.sleep(.6);tap(700,1945);time.sleep(.5);tap(70,800);time.sleep(.8);tap(700,1930);time.sleep(2)
def home(): tap(110,210);time.sleep(.8)
def main():
    mode=sys.argv[1]
    if mode=='sequence':
     run('shell','am','force-stop',app);run('shell','am','start','-W','-n',app+'/.MainActivity');time.sleep(2)
     # Capture starts on Settings, real pointer input throughout.
     tap(905,210);time.sleep(.4)
     command='echo $$; exec screenrecord --size 720x1560 --bit-rate 4M --time-limit 60 /sdcard/art06-sequence.mp4'
     rec=subprocess.Popen([adb,'-s','emulator-5556','shell','sh','-c',shlex.quote(command)],stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
     recPid=rec.stdout.readline().decode().strip();assert recPid.isdigit()
     time.sleep(.6);tap(700,1455);time.sleep(.6);shot('picker-light');dump('picker-light')
     for id in ['cinnamon','sherbet','classic']:
      picker_to_board(id);shot('runtime-'+id)
      (out/'checks'/f'runtime-{id}.log').write_text(run('logcat','-d','-v','epoch','-s','ReactNativeJS:I','ArtSkinPrep:I','ArtSkinFirstDraw:I','ArtSkinDraws:I','ArtSkinSpec:E','AndroidRuntime:E'))
      if id!='classic':home();menu_to_picker()
     run('shell','am','force-stop',app);run('shell','am','start','-W','-n',app+'/.MainActivity');time.sleep(2);menu_to_picker();shot('restart-classic');dump('restart-classic')
     run('shell','kill','-2',recPid);rec.wait(timeout=12);run('pull','/sdcard/art06-sequence.mp4',str(out/'screens/settings-switch-restart.mp4'))
     print('sequence done')
    elif mode=='dark':
     tap(70,800);time.sleep(.2);tap(1300,210);time.sleep(.8);menu_to_picker();shot('picker-dark');dump('picker-dark')
     tap(700,names['sherbet']);time.sleep(.5)
     run('shell','am','force-stop',app);run('shell','am','start','-W','-n',app+'/.MainActivity');time.sleep(2);menu_to_picker();shot('restart-sherbet');dump('restart-sherbet')
     picker_to_board('sherbet');shot('restart-sherbet-board');home()
     print('dark and non-default persistence done')

if __name__ == '__main__': main()
