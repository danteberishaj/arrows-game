#!/usr/bin/env python3
"""ART07 report-only opening table. Preserve counts, raw contrast exceptions, and native controls."""
import json,pathlib,statistics,hashlib
root=pathlib.Path(__file__).resolve().parents[2]/'artifacts/ART-SKINS-07'
data=json.loads((root/'checks/contract-data.json').read_text())
def stats(a): return {'n':len(a),'medianMs':statistics.median(a),'maxMs':max(a),'minMs':min(a)}
apkSha=hashlib.sha256((root/'perf/catalogue-perf.apk').read_bytes()).hexdigest()
summary={'screenCellDp':29.38775416782924,'gate':'REPORT_ONLY','apkSha256':apkSha,'specs':{}}
for id,spec in data['specs'].items():
    raw=json.loads((root/'perf'/f'{id}-raw.json').read_text());assert len(raw['runs'])==24 and len(raw['order'])==12
    assert raw['apkSha256']==apkSha and raw['deviceBoot']['systemServerStable']
    assert sum(order[0] for order in raw['order'])==6
    on=[r for r in raw['runs'] if r['enabled']];off=[r for r in raw['runs'] if not r['enabled']]
    assert len(on)==len(off)==12
    for pair in range(12): assert sorted(r['enabled'] for r in raw['runs'] if r['pair']==pair)==[False,True]
    assert all(abs(r['screenCell']-summary['screenCellDp'])<.001 for r in raw['runs'])
    assert all(r['propSetup'] and len(r['firstDraw'])==1 and r['recording'] for r in raw['runs'])
    assert all(len(r['preparation'])==1 and any(d['draws']<=8 and d['draws']>2 for d in r['draws']) for r in on)
    assert all(sum(r['propSetup']) >= sum(r['selection'])+sum(r['cells'])+sum(r['baseGeometry']) for r in raw['runs'])
    result={'numericId':spec['numericId'],'screenCellDp':summary['screenCellDp'],
        **{key:stats([r[field] for r in on]) for key,field in [('preparation','preparationMs'),('stripRecordingOn','recordingMs'),('firstDraw','firstDrawMs'),('totalOpenOn','totalOpenMs')]},
        'retainedPreparation':stats([sum(r['preparation']) for r in on]),'lazyBuildInsideFirstDraw':stats([sum(r['lazy']) for r in on]),
        'stripRecordingOff':stats([r['recordingMs'] for r in off]),'totalOpenOff':stats([r['totalOpenMs'] for r in off]),
        'nestedParsers':{key:stats([sum(r[key]) for r in on]) for key in ['selection','cells','baseGeometry','propSetup','construction']},
        'pairedOverhead':stats([next(r['totalOpenMs'] for r in on if r['pair']==pair)-next(r['totalOpenMs'] for r in off if r['pair']==pair) for pair in range(12)]),
        'deviceBoot':raw['deviceBoot'],
        'hostLoadMin':min(r[k]['load'] for r in raw['runs'] for k in ['before','exitHost','after']),
        'hostLoadMax':max(r[k]['load'] for r in raw['runs'] for k in ['before','exitHost','after']),
        'exitStatus':'UNVERIFIED','acceptedFrameCount':0}
    result['historicalOpeningBudget']='PASS' if all(result['totalOpenOn'][k] <= result['totalOpenOff'][k]+16 for k in ['medianMs','maxMs']) else 'FAIL'
    summary['specs'][id]=result
(root/'perf/summary.json').write_text(json.dumps(summary,indent=2)+'\n')
lines=['| Spec | ID | Cell dp | n ON/OFF | Prep med/max ms | Record ON med/max ms | Record OFF med/max ms | First draw med/max ms | **Total ON med/max ms** | Total OFF med/max ms | Paired overhead med/max ms | Historical +16 ms |',
       '| --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |']
for id,r in summary['specs'].items():
    def pair(key): return f"{r[key]['medianMs']:.3f}/{r[key]['maxMs']:.3f}"
    lines.append(f"| {data['specs'][id]['name']} | {r['numericId']} | 29.387754 | 12/12 | {pair('preparation')} | {pair('stripRecordingOn')} | {pair('stripRecordingOff')} | {pair('firstDraw')} | **{pair('totalOpenOn')}** | {pair('totalOpenOff')} | {pair('pairedOverhead')} | {r['historicalOpeningBudget']} (report only) |")
(root/'perf/opening-table.md').write_text('\n'.join(lines)+'\n')
print('\n'.join(lines))

setup=['| Spec | Cell dp | n ON | Construction med/max ms | All prop setup med/max ms | Selection JSON (nested) | Owned cells (nested) | Base geometry (nested) | Retained prep | Lazy template/merge (inside first draw) |',
       '| --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- |']
for id,r in summary['specs'].items():
    def pair(a): return f"{a['medianMs']:.3f}/{a['maxMs']:.3f}"
    p=r['nestedParsers']
    setup.append(f"| {data['specs'][id]['name']} | 29.387754 | 12 | {pair(p['construction'])} | {pair(p['propSetup'])} | {pair(p['selection'])} | {pair(p['cells'])} | {pair(p['baseGeometry'])} | {pair(r['retainedPreparation'])} | {pair(r['lazyBuildInsideFirstDraw'])} |")
(root/'perf/setup-table.md').write_text('\n'.join(setup)+'\n')
