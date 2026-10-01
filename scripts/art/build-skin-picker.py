#!/usr/bin/env python3
"""Local ART06 Android builds; picker ON/OFF, unchanged test/PERF configuration."""
import json, os, pathlib, subprocess, shutil, sys
root = pathlib.Path(__file__).resolve().parents[2]
out = root / 'artifacts/ART-SKINS-06'
mode = sys.argv[1] if len(sys.argv) > 1 else 'on'
assert mode in ['on', 'off', 'base']
for folder in ['checks', 'perf', 'screens', 'patches']: (out/folder).mkdir(parents=True, exist_ok=True)
if mode == 'base':
    # A base label must never silently build the restored picker source.
    assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip().startswith('1d61234')
    assert not subprocess.check_output(['git','diff','--name-only','HEAD','--','App.tsx','src','modules/arrows-board'],cwd=root,text=True).strip()
    assert not subprocess.check_output(['git','ls-files','--others','--exclude-standard','--','src','modules/arrows-board'],cwd=root,text=True).strip()
flags = json.loads((root / 'scripts/art/skin-build-flags.json').read_text())
flags.pop('EXPO_PUBLIC_ART_SKIN', None)
if mode == 'on': flags['EXPO_PUBLIC_META_SKIN_PICKER'] = '1'
flags['EXPO_PUBLIC_PERF_SCREEN'] = 'menu'
(out / 'checks' / f'build-env-{mode}.json').write_text(json.dumps(flags, indent=2) + '\n')
env = {k:v for k,v in os.environ.items() if not k.startswith('EXPO_PUBLIC_')}
env.update(flags)
env['ANDROID_HOME'] = '/Users/gentlegen/Library/Android/sdk'
env['PATH'] = '/Users/gentlegen/.nvm/versions/node/v20.19.4/bin:' + env['PATH']
for phase, args in [('bundle', [':app:createBundleReleaseJsAndAssets', '--rerun-tasks']), ('apk', [':app:assembleRelease'])]:
    with (out/'checks'/f'build-{mode}-{phase}.txt').open('w') as log:
        subprocess.run(['./gradlew', *args, '-PreactNativeArchitectures=arm64-v8a', '--max-workers=2'], cwd=root/'android', env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
shutil.copy2(root/'android/app/build/outputs/apk/release/app-release.apk', out/'perf'/f'picker-{mode}.apk')
