#!/usr/bin/env python3
"""Confirm selected tint in both arms and visibly presented native art in ON."""
import hashlib,json,os
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[2]/os.environ.get('ART_SKINS_DIR','artifacts/ART-SKINS-08')
specs=json.loads((root/'checks/contract-data.json').read_text())['specs']
summary=json.loads((root/'perf/summary.json').read_text())
rows=[]
def visible_rim(colours,spec):
    rim=next(layer for layer in spec['layers'] if layer['kind']=='rim')
    assert rim.get('opacity',1)==1 and rim['colour']!='palette'
    expected=tuple(bytes.fromhex(rim['colour'].removeprefix('#')))
    count=colours.get(expected,0)
    assert count>1000, ('No visibly presented spec rim',spec['id'],count)
    return count

for key in summary['specs']:
    expected=tuple(bytes.fromhex(specs[key]['board']['light'].removeprefix('#')))
    row={'id':key,'screenCellDp':summary['screenCellDp'],'expectedLightTint':specs[key]['board']['light'],'nativeArms':{}}
    for arm in ['on','off']:
        path=root/'screens'/f'{key}-{arm}-viewport.png'
        with Image.open(path) as image:
            assert image.size==(1440,3120)
            roi=(0,305,1440,2952)
            colours=dict((colour,count) for count,colour in image.convert('RGB').crop(roi).getcolors(1440*2647))
        count=colours.get(expected,0)
        assert count>250000, (key,arm,expected,count)
        row['nativeArms'][arm]={'image':str(path.relative_to(root)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'roi':roi,'exactTintPixels':count}
        if arm=='on': row['nativeArms'][arm]['exactOpaqueRimPixels']=visible_rim(colours,specs[key])
    rows.append(row)
blank=root/'screens/restoration-before-visible-art.png'
if blank.exists():
    with Image.open(blank) as image:
        colours=dict((colour,count) for count,colour in image.convert('RGB').getcolors(image.width*image.height))
    try: visible_rim(colours,specs['cinnamon'])
    except AssertionError: rejected={'source':str(blank.relative_to(root)),'sha256':hashlib.sha256(blank.read_bytes()).hexdigest(),'status':'REJECTED — native timer preceded visible art'}
    else: raise AssertionError('Expected the retained pre-presentation negative control to be blank')
else:
    try: visible_rim({(255,255,255):1440*2647},specs['cinnamon'])
    except AssertionError: rejected={'source':'synthetic blank board','status':'REJECTED'}
    else: raise AssertionError('Blank board must fail visible-art check')
result={'status':'PASS','specCount':len(rows),'scope':'Selected tint in both native arms and opaque spec rim in every ON screenshot. This does not compare art pixels or measure GPU completion.','blankNegativeControl':rejected,'specs':rows}
(root/'checks/timing-config-verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(f'{len(rows)} completed styles: selected tint in both arms and visible spec art in ON; blank control rejected.')
