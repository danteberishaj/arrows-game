#!/usr/bin/env python3
import json, pathlib, statistics
root=pathlib.Path('artifacts/ART-SKINS-04')
def stats(values): return {'n':len(values),'medianMs':statistics.median(values),'maxMs':max(values),'minMs':min(values)}
summary={'screenCellDp':29.38775416782924,'specs':{}}
for spec in json.loads((root/'checks/contract-data.json').read_text())['specs']:
    raw=json.loads((root/'perf'/f'{spec}-raw.json').read_text())
    assert len(raw['runs'])==24 and len(raw['order'])==12
    on=[r for r in raw['runs'] if r['enabled']]; off=[r for r in raw['runs'] if not r['enabled']]
    assert len(on)==len(off)==12
    for pair in range(12): assert sorted(r['enabled'] for r in raw['runs'] if r['pair']==pair)==[False,True]
    assert all(abs(r['screenCell']-summary['screenCellDp'])<.001 for r in raw['runs'])
    assert all(len(r['preparation'])==1 and any(d['draws']<=8 and d['draws']>2 for d in r['draws']) for r in on)
    result={'screenCellDp':summary['screenCellDp'],'preparation':stats([r['preparationMs'] for r in on]),
      'breakdown':{key:stats([sum(r[key]) for r in on]) for key in ['selection','cells','baseGeometry','preparation']},
      'stripRecordingOn':stats([r['recordingMs'] for r in on]),'stripRecordingOff':stats([r['recordingMs'] for r in off]),
      'firstDrawDeferred':stats([r['firstDrawMs'] for r in on]),
      'trackedNativeOpen':stats([r['preparationMs']+r['recordingMs']+r['firstDrawMs']-sum(r['lazyRecording']) for r in on]),
      'exitStatus':'UNVERIFIED','frameCount':0,'hostLoadMin':min(r['before']['load'] for r in raw['runs']),
      'hostLoadMax':max(r['after']['load'] for r in raw['runs'])}
    result['preparationGate']='PASS' if result['preparation']['maxMs']<=16 else 'FAIL'
    valid=[]
    for pair in range(12):
        runs=[r for r in raw['runs'] if r['pair']==pair]
        if all(r['before']['quiet'] and r['exitHost']['quiet'] and r['after']['quiet'] and r.get('acceptedExit') and r['frames'] and r['frames']['completed']>0 for r in runs): valid.extend(runs)
    if len(valid)==24:
        result['exitStatus']='CAPTURED';result['frames']=[{'i':r['i'],'enabled':r['enabled'],'count':r['frames']['completed'],
          'percentiles':{k:{'valueMs':v,'frameCount':r['frames']['completed']} for k,v in r['frames'].items() if 'P50' in k or 'P95' in k or 'P99' in k}} for r in valid]
        # Counts are carried beside each row's percentiles, never dropped in a pooled statistic.
        result['frameCount']=sum(r['frames']['completed'] for r in valid)
    summary['specs'][spec]=result
    print(json.dumps({spec:result},indent=2))
before=json.loads((root/'checks/native-before.json').read_text());after=json.loads((root/'checks/native-after.json').read_text())
assert len(before)==len(after)==21 and all(r['fitFailures']>0 for r in before) and all(r['fitFailures']==0 and r['status']=='PASS' for r in after)
assert all(s['zeroLengthNegativeComponents']==2 for r in after for s in r['specs'])
summary['contract']={'arrowsPerSpec':sum(r['specs'][0]['arrows'] for r in after),
  'beforeFailedPaths':sum(r['fitFailures'] for r in before),'beforeCheckedPaths':sum(r['checkedPaths'] for r in before),
  'singleCellChecks':sum(s['singleCellChecks'] for r in after for s in r['specs']),
  'afterCheckedPaths':sum(r['checkedPaths'] for r in after),'afterFailedPaths':0,'headFailures':sum(s['headFailures'] for r in after for s in r['specs'])}
(root/'perf/summary.json').write_text(json.dumps(summary,indent=2)+'\n')
