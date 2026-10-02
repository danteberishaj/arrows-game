#!/usr/bin/env python3
"""Join ART08 art, actual native work and raw timings; never infer feature causality."""
import csv
import hashlib
import json
import os
from pathlib import Path
import statistics
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / os.environ.get('ART_SKINS_DIR', 'artifacts/ART-SKINS-08')


def read(path):
    return json.loads((ART / path).read_text())


def stats(values):
    return {'n': len(values), 'medianMs': statistics.median(values), 'maxMs': max(values)}


def main():
    specs = read('checks/contract-data.json')['specs']
    summary = read('perf/summary.json')
    contract = read('checks/contract-summary.json')['specs']
    work = read('checks/polish-summary.json')['denseRuntimeWork']
    changes = {row['id']: row for row in read('checks/spec-diff.json')['specs']}
    sources = ['checks/contract-data.json', 'checks/contract-summary.json',
               'checks/polish-summary.json', 'checks/spec-diff.json', 'perf/summary.json']
    rows = []
    for key, measured in summary['specs'].items():
        raw_path = f'perf/{key}-raw.json'
        raw = read(raw_path)
        sources.append(raw_path)
        assert raw['selectionPreparation']['style'] == key
        assert raw['apkSha256'] == summary['apkSha256'] and raw['deviceBoot']['systemServerStable']
        assert raw['env'] == read('checks/build-env-perf.json')
        meta = {name: value for name, value in raw['env'].items() if name.startswith('EXPO_PUBLIC_META_')}
        assert len(meta) == 18 and set(meta.values()) == {'1'}
        selection_path = raw['selectionPreparation']['xml']
        selection = ET.fromstring((ART / selection_path).read_text())
        checked = [node.attrib.get('content-desc', '').split(',')[0] for node in selection.iter('node')
                   if node.attrib.get('class') == 'android.widget.RadioButton' and node.attrib.get('checked') == 'true']
        assert checked == [specs[key]['name']]
        sources.append(selection_path)
        on = [run for run in raw['runs'] if run['enabled']]
        off = [run for run in raw['runs'] if not run['enabled']]
        assert len(on) == len(off) == 12
        for run in raw['runs']:
            assert run['frames'] is None and run['exitStatus'] == 'UNVERIFIED'
            assert abs(run['screenCell'] - summary['screenCellDp']) < .001
            assert abs(run['totalOpenMs'] - run['preparationMs'] - run['recordingMs'] - run['firstDrawMs']) < .00001
        remainder = [run['firstDrawMs'] - sum(run['lazy']) for run in on]
        assert min(remainder) >= 0 and work[key]['runtimeAuditPaths'] == 0
        spec = specs[key]
        if spec['face']['eyes'] and spec['face'].get('anchor') == 'head':
            question = 'Test directional head-face reuse; preserve upright open/closed eyes and .03 fill clearance in all four directions.'
        elif any(layer['kind'] == 'bands' for layer in spec['layers']):
            question = 'Isolate band template merging versus Canvas submission after existing directional cap reuse.'
        else:
            question = ('Isolate zero-amplitude ribbon sampling/fade construction versus translated merging; preserve exact visible pixels and centreline.'
                        if any(layer['kind'] == 'ribbon' for layer in spec['layers']) else
                        'Isolate template/layer merging versus base and prop setup before assigning a cost to the visible accent.')
        rows.append({'id': key, 'name': spec['name'], 'numericId': spec['numericId'],
                     'screenCellDp': summary['screenCellDp'], 'nOn': 12, 'nOff': 12,
                     'spec': spec, 'change': changes[key], 'contract': contract[key],
                     'workCounts': work[key], 'openingOn': measured['totalOpenOn'],
                     'openingOff': measured['totalOpenOff'], 'pairedOverhead': measured['pairedOverhead'],
                     'setup': measured['preparation'], 'recording': measured['stripRecordingOn'],
                     'firstDraw': measured['firstDraw'], 'lazyGeometryAndMerge': measured['lazyBuildInsideFirstDraw'],
                     'firstDrawRemainder': stats(remainder),
                     'historicalBudget': measured['historicalOpeningBudget'],
                     'eachPairWithin16Ms': measured['pairedOverhead']['maxMs'] <= 16,
                     'hostLoad': [measured['hostLoadMin'], measured['hostLoadMax']],
                     'performanceNeutrality': 'UNVERIFIED', 'acceptedFrames': 0,
                     'irreducibleCostEstablished': False, 'nextQuestion': question,
                     'nextQuestionStatus': 'HYPOTHESIS — not isolated', 'raw': raw_path})
    output = {'task': 'ART-SKINS-08', 'levelIndex': 3827, 'screenCellDp': summary['screenCellDp'],
              'apkSha256': summary['apkSha256'], 'opens': len(rows) * 24, 'pairs': len(rows) * 12,
              'method': '12 shuffled pairs per spec; real picker seeded before native OFF/ON override; same APK and selected board tint in both arms',
              'limitations': ['Contended host/another emulator: no exit percentiles or phone neutrality claim.',
                              'First draw is native submission, not GPU completion.',
                              'Art changed from ART07; no before/after speed percentage or isolated feature cost.',
                              'No style established as intrinsically too expensive.'],
              'sources': {path: hashlib.sha256((ART / path).read_bytes()).hexdigest() for path in sources},
              'specs': rows}
    (ART / 'perf/style-evidence.json').write_text(json.dumps(output, indent=2) + '\n')
    with (ART / 'perf/style-evidence.csv').open('w', newline='') as handle:
        writer = csv.writer(handle)
        writer.writerow(['spec', 'id', 'cellDp', 'nOn', 'nOff', 'drawsIncludingMark', 'onMedianMs', 'onMaxMs',
                         'offMedianMs', 'offMaxMs', 'pairedMedianMs', 'pairedMaxMs', 'lazyMedianMs', 'lazyMaxMs',
                         'historicalBudget', 'eachPairWithin16Ms', 'headFaceBuilds', 'frames'])
        for row in rows:
            writer.writerow([row['name'], row['numericId'], row['screenCellDp'], 12, 12,
                             row['contract']['maxDrawsIncludingMark'],
                             *[row[field][stat] for field in ['openingOn', 'openingOff', 'pairedOverhead', 'lazyGeometryAndMerge']
                               for stat in ['medianMs', 'maxMs']], row['historicalBudget'], row['eachPairWithin16Ms'],
                             row['workCounts']['faceBuilds'], 0])
    readable = ['# ART-SKINS-08 per-style evidence', '',
                f'{len(rows)}/8 completed styles; {output["opens"]} opens / {output["pairs"]} shuffled pairs. '
                'Every row is 29.387754 dp on dense index 3827, same PERF APK and selected tint.', '',
                'Work counts describe the current output. They do not establish a speed gain from ART07. '
                'Exit frames: 0 accepted; performance neutrality UNVERIFIED. Owner review pending.', '',
                '| Spec · ID | Cell dp | n ON/OFF | Draws incl. mark | Templates | Runtime audit paths | Faces | Spirals | Centrelines | Nested heads |',
                '| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |']
    for row in rows:
        work = row['workCounts']
        readable.append(f'| {row["name"]} · {row["numericId"]} | 29.387754 | 12/12 | '
                        f'{row["contract"]["maxDrawsIncludingMark"]} | {work["templates"]} | '
                        f'{work["runtimeAuditPaths"]} | {work["faceBuilds"]} | {work["spiralBuilds"]} | '
                        f'{work["centrelineBuilds"]} | {work["bandHeadBuilds"]} |')
    readable += ['', 'Lazy time is nested in full first draw. Remainder is calculated per run as '
                 'first draw minus lazy time; it is native submission, not GPU completion. '
                 'Sum each run before statistics; phase medians/maxima do not add.', '',
                 '| Spec | Cell dp | n ON | Lazy geometry/merge med/max ms | First-draw remainder med/max ms | Historical +16 ms | Every paired overhead ≤16 ms |',
                 '| --- | ---: | ---: | --- | --- | --- | --- |']
    for row in rows:
        def pair(field):
            value = row[field]
            assert value['n'] == 12
            return f'{value["medianMs"]:.3f}/{value["maxMs"]:.3f}'
        readable.append(f'| {row["name"]} | 29.387754 | 12 | {pair("lazyGeometryAndMerge")} | '
                        f'{pair("firstDrawRemainder")} | {row["historicalBudget"]} (report only) | '
                        f'{"YES" if row["eachPairWithin16Ms"] else "NO"} |')
    readable += ['', '| Spec | General recipe | Next isolated question (HYPOTHESIS) |',
                 '| --- | --- | --- |']
    for row in rows:
        spec = row['spec']
        kinds = ', '.join(dict.fromkeys(layer['kind'] for layer in spec['layers']))
        face = spec['face'].get('anchor', 'tail') if spec['face']['eyes'] else 'none'
        readable.append(f'| {row["name"]} | {kinds}; tail={spec["tail"]["kind"]}; face={face} | '
                        f'{row["nextQuestion"]} |')
    readable += ['', 'No style is established as intrinsically unoptimizable. Features, art and host '
                 'scheduling differ; these rows do not isolate marginal feature cost. '
                 'See opening-table.md for complete sums, setup-table.md for nested parsers, '
                 'style-evidence.json for raw/source hashes and every retained value.', '']
    (ART / 'perf/style-evidence.md').write_text('\n'.join(readable))
    print(f'{len(rows)} polished styles joined; {output["opens"]} raw opens validated; JSON, CSV and readable tables saved.')


if __name__ == '__main__':
    main()
