#!/usr/bin/env python3
"""Join the independent native results and honest outline contrast rows per registry entry."""
import json,pathlib,copy
root=pathlib.Path(__file__).resolve().parents[2]/'artifacts/ART-SKINS-07'
checks=root/'checks';data=json.loads((checks/'contract-data.json').read_text())
after=json.loads((checks/'native-after.json').read_text());before=json.loads((checks/'native-before.json').read_text())
contrast=json.loads((checks/'contrast.json').read_text());assert len(after)==len(before)==21
result={'levels':[r['level'] for r in after],'checkedPaths':sum(r['checkedPaths'] for r in after),
        'fitFailures':sum(r['fitFailures'] for r in after),'frozenArt03':{'checkedPaths':sum(r['checkedPaths'] for r in before),'fitFailures':sum(r['fitFailures'] for r in before)},'specs':{}}
assert result['fitFailures']==0 and result['frozenArt03']['fitFailures']>0
# K4's hex ratios describe an opaque outline. Translucent body/glow are allowed;
# a new transparent rim needs a composited contrast audit before it is certifiable.
def require_opaque_outline(spec):
    outline=next(layer for layer in spec['layers'] if layer['kind']=='rim')
    assert outline.get('opacity',1)==1, 'Outline alpha requires a composited K4 audit'
result['outlineAlphaNegativeControls']=0
for id,spec in data['specs'].items():
    require_opaque_outline(spec)
    damaged=copy.deepcopy(spec)
    next(layer for layer in damaged['layers'] if layer['kind']=='rim')['opacity']=.2
    try: require_opaque_outline(damaged)
    except AssertionError: result['outlineAlphaNegativeControls']+=1
    else: raise AssertionError('Transparent outline negative control was accepted')
    rows=[next(s for s in level['specs'] if s['spec']==id) for level in after]
    outlines=[r for r in contrast if r['usage']['id'].startswith(f'skin-{id}-outline-')]
    blocked=[r for r in contrast if r['usage']['id']==f'skin-{id}-blocked']
    assert all(r['fitFailures']==r['headFailures']==r['headBoundaryPixels']==0 for r in rows)
    assert all(r['flatLod'] and r['reducedMotion'] for r in rows)
    assert all(d['drawsWithMark']<=8 for r in rows for d in r['draws'])
    assert all(r['pass'] for r in outlines+blocked if r['required'])
    assert spec['tail']['oneCell']=='none'
    value={'numericId':spec['numericId'],'arrows':sum(r['arrows'] for r in rows),
      'oneCellChecks':sum(r['oneCellChecks'] for r in rows),'alignedShaftChecks':sum(r['alignedShaftChecks'] for r in rows),
      'featureNegativeControls':sum(r['featureNegativeControls'] for r in rows),
      'maxDrawsIncludingMark':max(d['drawsWithMark'] for r in rows for d in r['draws']),
      'K1':'PASS','K2':'PASS','K3':'PASS','K4':'PASS (declared dark preference)' if spec.get('preferredTheme') else 'PASS',
      'K5':'PASS','K6':'PASS','K7':'REPORT_ONLY','K8':'PASS','joinsAndAccents':'PASS',
      'outlineRatios':{theme:min(r['ratio'] for r in outlines if r['palette']==theme) for theme in ['Daylight','Ink Night']},
      'nonGatingLightFailures':[{'colour':r['fg'],'ratio':r['ratio'],'pass':r['pass'],'required':r['required']} for r in outlines if not r['pass']]}
    result['specs'][id]=value
result['oneCellChecks']=sum(r['oneCellChecks'] for r in result['specs'].values())
result['featureNegativeControls']=sum(r['featureNegativeControls'] for r in result['specs'].values())
result['alignedShaftChecks']=sum(r['alignedShaftChecks'] for r in result['specs'].values())
(checks/'contract-summary.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='specs'}))
