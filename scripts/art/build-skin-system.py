#!/usr/bin/env python3
"""Local arm64 test-ads/PERF build. Never invokes EAS or git writes."""
import json, os, pathlib, subprocess, sys, shutil
root=pathlib.Path(__file__).resolve().parents[2]
out=root/os.environ.get('ART_SKINS_DIR','artifacts/ART-SKINS-04')
for folder in ['patches','screens','perf','checks']: (out/folder).mkdir(parents=True,exist_ok=True)
selection=sys.argv[1] if len(sys.argv)>1 else 'cinnamon'
flags=json.loads(pathlib.Path(__file__).with_name('skin-build-flags.json').read_text())
if selection=='unset': flags.pop('EXPO_PUBLIC_ART_SKIN',None)
else: flags['EXPO_PUBLIC_ART_SKIN']=selection
(out/'checks'/f'build-env-{selection}.json').write_text(json.dumps(flags,indent=2)+'\n')
env=dict(os.environ)
for key in list(env):
    if key.startswith('EXPO_PUBLIC_'): del env[key]
env.update(flags); env['ANDROID_HOME']='/Users/gentlegen/Library/Android/sdk'
env['PATH']='/Users/gentlegen/.nvm/versions/node/v20.19.4/bin:'+env['PATH']
for phase,args in [('bundle',[':app:createBundleReleaseJsAndAssets','--rerun-tasks']),('apk',[':app:assembleRelease'])]:
    with (out/'checks'/f'build-{selection}-{phase}.txt').open('w') as log:
        subprocess.run(['./gradlew',*args,'-PreactNativeArchitectures=arm64-v8a','--max-workers=2'],cwd=root/'android',env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
shutil.copy2(root/'android/app/build/outputs/apk/release/app-release.apk',out/'perf'/f'{selection}.apk')
