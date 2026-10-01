#!/usr/bin/env python3
"""Join ART07 timings, spec features and verified work counts without inferring causality."""
import csv
import hashlib
import json
from pathlib import Path
import statistics

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'artifacts/ART-SKINS-07'


def read(relative):
    return json.loads((ART / relative).read_text())


def stats(values):
    return {'n': len(values), 'medianMs': statistics.median(values),
            'maxMs': max(values), 'minMs': min(values)}


def pair(value):
    return f"{value['medianMs']:.3f}/{value['maxMs']:.3f}"


def next_question(spec):
    if spec['face']['eyes'] and spec['face'].get('anchor', 'tail') == 'head':
        return 'Can head-anchored faces be cached per direction while preserving clipping and blocked eyes?'
    if any(layer['kind'] == 'bands' for layer in spec['layers']):
        return 'After cap reuse, does merging band templates or submitting their compound paths dominate?'
    if spec['tail']['kind'] == 'roll+face':
        return 'After roll reuse, does ribbon/stripe construction or translated strip merging dominate?'
    if any(layer['kind'] == 'fold' for layer in spec['layers']):
        return 'Can directional fold caps be shared separately from arrow-specific bend creases?'
    if any(layer['kind'] == 'glow' for layer in spec['layers']):
        return 'How much cost belongs to path construction versus GPU overdraw on a quiet device?'
    if any(layer['kind'] == 'spots' for layer in spec['layers']):
        return 'Does periodic spot generation contribute materially beyond tube construction and merging?'
    return 'Does translated strip merging or base/prop setup dominate after current template reuse?'


def main():
    specs = read('checks/contract-data.json')['specs']
    summary = read('perf/summary.json')
    contract = read('checks/contract-summary.json')
    optimization = read('checks/optimization-summary.json')
    assert optimization['status'] == 'PASS' and optimization['everyPixelComparisonNonEmpty']
    counters = {row['spec']: row for row in optimization['denseCounters']}
    assert set(specs) == set(summary['specs']) == set(counters) == set(contract['specs'])
    sources = ['checks/contract-data.json', 'checks/contract-summary.json',
               'checks/optimization-summary.json', 'perf/summary.json']
    rows = []
    for key, spec in specs.items():
        raw_path = f'perf/{key}-raw.json'
        raw = read(raw_path)
        sources.append(raw_path)
        measured = summary['specs'][key]
        assert raw['apkSha256'] == summary['apkSha256'] and raw['deviceBoot']['systemServerStable']
        on = [run for run in raw['runs'] if run['enabled']]
        off = [run for run in raw['runs'] if not run['enabled']]
        assert len(on) == len(off) == 12 and len(raw['order']) == 12
        assert sum(order[0] for order in raw['order']) == 6
        for index in range(12):
            assert sorted(run['enabled'] for run in raw['runs'] if run['pair'] == index) == [False, True]
        for run in raw['runs']:
            assert abs(run['screenCell'] - summary['screenCellDp']) < .001
            assert abs(run['totalOpenMs'] - run['preparationMs'] - run['recordingMs'] - run['firstDrawMs']) < .00001
            assert run['exitStatus'] == 'UNVERIFIED' and run['frames'] is None
        remainder = [run['firstDrawMs'] - sum(run['lazy']) for run in on]
        assert min(remainder) >= 0
        builds = counters[key]
        assert builds['templates'] == 57 and builds['runtimeAuditPaths'] == 0
        reduced_work = {field: {'before': builds[field + 'Before'], 'after': builds[field + 'After']}
                        for field in ['faceBuilds', 'spiralBuilds', 'centrelineBuilds', 'bandHeadBuilds']}
        rows.append({
            'id': key, 'name': spec['name'], 'numericId': spec['numericId'],
            'screenCellDp': summary['screenCellDp'], 'nOn': 12, 'nOff': 12,
            'features': {'palette': spec['palette']['rule'], 'layers': spec['layers'],
                         'bodyPattern': spec.get('bodyPattern', 'tube'), 'head': spec['head'],
                         'tail': spec['tail'], 'face': spec['face']},
            'contract': contract['specs'][key], 'maxDrawsIncludingMark': contract['specs'][key]['maxDrawsIncludingMark'],
            'workCounts': {'sharedTemplates': 57, 'runtimeAuditPaths': 0,
                           'avoidedAuditPaths': builds['avoidedAuditPaths'], **reduced_work},
            'openingOn': measured['totalOpenOn'], 'openingOff': measured['totalOpenOff'],
            'pairedOverhead': measured['pairedOverhead'], 'setup': measured['preparation'],
            'recording': measured['stripRecordingOn'], 'firstDraw': measured['firstDraw'],
            'lazyGeometryAndMergeInsideDraw': measured['lazyBuildInsideFirstDraw'],
            'firstDrawRemainder': stats(remainder),
            'historicalMedianAndMaxBudget': measured['historicalOpeningBudget'],
            'everyPairedOpenWithin16Ms': measured['pairedOverhead']['maxMs'] <= 16,
            'hostLoad': [measured['hostLoadMin'], measured['hostLoadMax']],
            'frameStatus': 'UNVERIFIED', 'acceptedFrames': 0,
            'performanceNeutrality': 'UNVERIFIED', 'irreducibleCostEstablished': False,
            'nextQuestion': next_question(spec), 'nextQuestionStatus': 'HYPOTHESIS — not measured in isolation',
            'raw': raw_path,
        })
    output = {
        'task': 'ART-SKINS-07', 'levelIndex': 3827, 'screenCellDp': summary['screenCellDp'],
        'apkSha256': summary['apkSha256'], 'opens': 408, 'pairs': 204,
        'method': '12 shuffled OFF/ON pairs per spec, six each order, same PERF APK, fresh same-config owned boot per spec',
        'historicalBudget': 'ON median and max <= batch OFF median and max +16 ms; report only',
        'limitations': ['Host contended and another emulator present; no valid exit frames.',
                        'Elapsed native timers include scheduling delay; firstDraw remainder is not GPU completion.',
                        'Feature costs are not isolated. Counts prove avoided work, not a speed percentage.',
                        'No style is established as impossible to optimize or performance-neutral.'],
        'sources': {path: hashlib.sha256((ART / path).read_bytes()).hexdigest() for path in sources},
        'specs': rows,
    }
    (ART / 'perf/style-evidence.json').write_text(json.dumps(output, indent=2) + '\n')
    with (ART / 'perf/style-evidence.csv').open('w', newline='') as handle:
        writer = csv.writer(handle)
        writer.writerow(['spec', 'numericId', 'cellDp', 'nOn', 'nOff', 'drawsIncludingMark',
                         'onMedianMs', 'onMaxMs', 'offMedianMs', 'offMaxMs', 'pairedMedianMs', 'pairedMaxMs',
                         'lazyMedianMs', 'lazyMaxMs', 'drawRemainderMedianMs', 'drawRemainderMaxMs',
                         'historicalBudget', 'eachPairWithin16Ms', 'avoidedAuditPaths', 'frameStatus'])
        for row in rows:
            writer.writerow([row['name'], row['numericId'], row['screenCellDp'], 12, 12, row['maxDrawsIncludingMark'],
                             *[row[field][stat] for field in ['openingOn', 'openingOff', 'pairedOverhead',
                                                            'lazyGeometryAndMergeInsideDraw', 'firstDrawRemainder']
                               for stat in ['medianMs', 'maxMs']], row['historicalMedianAndMaxBudget'],
                             row['everyPairedOpenWithin16Ms'], row['workCounts']['avoidedAuditPaths'], 'UNVERIFIED'])
    lines = [
        '<!-- Generated by scripts/art/summarize-skin-performance.py; source hashes in style-evidence.json. -->',
        '| Style · ID | Draws incl. mark | Opening ON med/max ms | Paired overhead med/max ms | Lazy geometry + merge med/max ms | Draw remainder med/max ms | Historical +16 | Each pair ≤16 |',
        '| --- | ---: | --- | --- | --- | --- | --- | --- |',
    ]
    for row in rows:
        lines.append(f"| {row['name']} · {row['numericId']} | {row['maxDrawsIncludingMark']} | "
                     f"{pair(row['openingOn'])} | {pair(row['pairedOverhead'])} | "
                     f"{pair(row['lazyGeometryAndMergeInsideDraw'])} | {pair(row['firstDrawRemainder'])} | "
                     f"{row['historicalMedianAndMaxBudget']} | {'YES' if row['everyPairedOpenWithin16Ms'] else 'NO'} |")
    lines += ['', '| Style | Audit paths avoided | Faces before→after | Spirals | Centrelines | Band heads | Next isolated question (unverified) |',
              '| --- | ---: | --- | --- | --- | --- | --- |']
    for row in rows:
        work = row['workCounts']
        counts = [f"{work[field]['before']}→{work[field]['after']}" for field in
                  ['faceBuilds', 'spiralBuilds', 'centrelineBuilds', 'bandHeadBuilds']]
        lines.append(f"| {row['name']} | {work['avoidedAuditPaths']} | " + ' | '.join(counts) + f" | {row['nextQuestion']} |")
    (ART / 'perf/style-evidence.md').write_text('\n'.join(lines) + '\n')
    print('17 styles joined; 408 raw opens validated; JSON, CSV and evidence tables saved.')


if __name__ == '__main__':
    main()
