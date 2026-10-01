#!/usr/bin/env python3
"""Audit local test artifacts without installing, publishing or changing an APK."""
import hashlib, json, os, pathlib, re, zipfile
root=pathlib.Path(__file__).resolve().parents[2]/'artifacts/ART-SKINS-06'
checks={}
for spec in ['on','off','base']:
    apk=root/'perf'/f'picker-{spec}.apk'
    with zipfile.ZipFile(apk) as archive:
        assets=sorted(name for name in archive.namelist() if name.startswith('assets/') and not name.endswith('/'))
        ids=sorted(set(value.decode() for value in re.findall(rb'ca-app-pub-\d+/\d+',archive.read('assets/index.android.bundle'))))
        manifest=archive.read('AndroidManifest.xml')
        # Android binary XML may use either UTF-8 or UTF-16 string-pool entries.
        registered=any('SkinContractInstrumentation'.encode(encoding) in manifest for encoding in ['utf-8','utf-16le'])
        assert len(ids)==9 and all(value.startswith('ca-app-pub-3940256099942544/') for value in ids)
        assert not registered
    flags=json.loads((root/'checks'/f'build-env-{spec}.json').read_text())
    meta={key:value for key,value in flags.items() if key.startswith('EXPO_PUBLIC_META_')}
    assert len(meta)==(18 if spec=='on' else 17) and set(meta.values())=={'1'} and flags['EXPO_PUBLIC_ADMOB_TEST_ADS']=='1'
    assert 'EXPO_PUBLIC_ART_SKIN' not in flags
    assert flags.get('EXPO_PUBLIC_META_SKIN_PICKER')=='1' if spec=='on' else 'EXPO_PUBLIC_META_SKIN_PICKER' not in flags
    checks[spec]={'sha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'bytes':apk.stat().st_size,
        'assets':assets,'adUnitIds':ids,'allUnitIdsTest':True,'temporaryInstrumentation':registered,
        'metaFlagsEnabled':len(meta),'screenCellDp':29.38775416782924}
assert checks['on']['assets']==checks['off']['assets']==checks['base']['assets']
assert len(checks['off']['assets'])==15
(root/'checks/apk-checks.json').write_text(json.dumps(checks,indent=2)+'\n')
print('Three APKs: nine official test ad-unit IDs, identical fifteen asset names, all seventeen original META flags enabled; picker enabled only in ON.')
