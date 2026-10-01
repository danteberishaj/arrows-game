#!/usr/bin/env python3
import hashlib,json,pathlib,re,subprocess,zipfile
root=pathlib.Path(__file__).resolve().parents[2];out=root/'artifacts/ART-SKINS-07';results={}
base=root/'artifacts/ART-SKINS-06/perf/picker-base.apk'
# The already independently audited base APK is valid for this HEAD: no runtime/config/asset changes since that base.
unchanged=subprocess.check_output(['git','diff','--name-only','1d61234','bad7903','--','App.tsx','src','modules','assets','package.json','package-lock.json','app.json'],cwd=root,text=True)
assert not unchanged.strip()
for mode,path in [('on',out/'perf/catalogue-on.apk'),('perf',out/'perf/catalogue-perf.apk'),('off',out/'perf/catalogue-off.apk'),('base',base)]:
    with zipfile.ZipFile(path) as archive:
        assets=sorted(n for n in archive.namelist() if n.startswith('assets/') and not n.endswith('/'))
        ids=sorted(set(v.decode() for v in re.findall(rb'ca-app-pub-\d+/\d+',archive.read('assets/index.android.bundle'))))
        registered=any('SkinContractInstrumentation'.encode(e) in archive.read('AndroidManifest.xml') for e in ['utf-8','utf-16le'])
        dex=[n for n in archive.namelist() if n.startswith('classes') and n.endswith('.dex')]
        diagnostic={name:sum(archive.read(n).count(name.encode()) for n in dex) for name in ['SkinContractInstrumentation','Art03Paths','Art04Paths','ConcatenatedHeadPaths','Art07BeforePaths','SkinOptimizationContract']}
        assert not any(diagnostic.values())
    assert len(ids)==9 and all(v.startswith('ca-app-pub-3940256099942544/') for v in ids)
    assert not registered and len(assets)==15
    if mode!='base':
        flags=json.loads((out/'checks'/f'build-env-{mode}.json').read_text())
        meta={k:v for k,v in flags.items() if k.startswith('EXPO_PUBLIC_META_')}
        assert len(meta)==(17 if mode=='off' else 18) and set(meta.values())=={'1'}
        assert flags['EXPO_PUBLIC_ADMOB_TEST_ADS']=='1' and 'EXPO_PUBLIC_ART_SKIN' not in flags
    results[mode]={'path':str(path.relative_to(root)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size,
                   'assets':assets,'allUnitIdsTest':True,'unitIds':ids,'temporaryInstrumentation':registered,'diagnosticDexStrings':diagnostic}
assert all(r['assets']==results['base']['assets'] for r in results.values())
assert results['base']['sha256']==json.loads((root/'artifacts/ART-SKINS-06/checks/apk-checks.json').read_text())['base']['sha256']
(out/'checks/apk-checks.json').write_text(json.dumps({'baselineRuntimeIdenticalToHEAD':True,'apks':results},indent=2)+'\n')
print('Four APKs: nine test ad-unit IDs, identical fifteen asset names, no diagnostic instrumentation; baseline app sources match HEAD.')
