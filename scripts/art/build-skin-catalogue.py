#!/usr/bin/env python3
"""ART07 local test-ads builds; diagnostic classes never remain in runtime source."""
import os
import json, pathlib, shutil, subprocess, sys
root=pathlib.Path(__file__).resolve().parents[2]
out=root/os.environ.get('ART_SKINS_DIR','artifacts/ART-SKINS-07')
mode=sys.argv[1] if len(sys.argv)>1 else 'on'
assert mode in ['on','off','perf','contract','phone']
flags=json.loads((root/'scripts/art/skin-build-flags.json').read_text())
flags.pop('EXPO_PUBLIC_ART_SKIN',None)
if mode!='off': flags['EXPO_PUBLIC_META_SKIN_PICKER']='1'
flags['EXPO_PUBLIC_PERF_SCREEN']='game' if mode in ['perf','contract'] else 'menu'
if mode=='phone':
    flags={key:value for key,value in flags.items() if not key.startswith('EXPO_PUBLIC_PERF_')}
    flags['EXPO_PUBLIC_DEV_LEVEL']='3827'
    flags['EXPO_PUBLIC_DEV_GEN_VERSION']='1'
(out/'checks'/f'build-env-{mode}.json').write_text(json.dumps(flags,indent=2)+'\n')
env={k:v for k,v in os.environ.items() if not k.startswith('EXPO_PUBLIC_')}
env.update(flags)
env['ANDROID_HOME']='/Users/gentlegen/Library/Android/sdk'
env['JAVA_HOME']='/Applications/Android Studio.app/Contents/jbr/Contents/Home'
env['PATH']='/Users/gentlegen/.nvm/versions/node/v20.19.4/bin:'+env['PATH']
manifest=root/'android/app/src/main/AndroidManifest.xml'
original=manifest.read_bytes()
gradle=root/'android/app/build.gradle'
original_gradle=gradle.read_bytes()
package=root/'modules/arrows-board/android/src/main/java/com/danteb/arrows/board'
injected=[]
try:
    # A local optimized test variant preserves the PERF boundary without creating
    # a release APK. It inherits the existing signing/optimization configuration.
    text=original_gradle.decode()
    marker='    packagingOptions {'
    assert text.count(marker)==1
    text=text.replace(marker,"    buildTypes { skinTest { initWith release; matchingFallbacks = ['release'] } }\n"+marker)
    gradle.write_text(text)
    if mode=='contract':
        for source in (root/'scripts/art/skin-contract').glob('*.kt'):
            dest=package/source.name
            assert not dest.exists()
            shutil.copy2(source,dest); injected.append(dest)
        manifest.write_text(original.decode().replace('</manifest>', '<instrumentation android:name="com.danteb.arrows.board.SkinContractInstrumentation" android:targetPackage="com.danteb.arrows" />\n</manifest>'))
    phases = [('bundle',[':app:createBundleSkinTestJsAndAssets','--rerun']),('apk',[':app:assembleSkinTest'])]
    if os.environ.get('ART_SKIN_SKIP_BUNDLE')=='1': phases=phases[1:]
    for phase,args in phases:
        with (out/'checks'/f'build-{mode}-{phase}.txt').open('w') as log:
            subprocess.run(['./gradlew',*args,'-PreactNativeArchitectures=arm64-v8a','--max-workers=2','--no-daemon','-Pkotlin.compiler.execution.strategy=in-process','-Dorg.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=1g'],cwd=root/'android',env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
    shutil.copy2(root/'android/app/build/outputs/apk/skinTest/app-skinTest.apk',out/'perf'/f'catalogue-{mode}.apk')
finally:
    manifest.write_bytes(original)
    gradle.write_bytes(original_gradle)
    for dest in injected: dest.unlink()
