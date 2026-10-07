#!/usr/bin/env python3
"""PROCESS-SPEED E4: derive a host-load gate threshold from archived data (no new runs).

Pairs every full jest run seen in transcript tool results (>= 100 suites, 'Time: N s') with the host load average
logged closest in time by ANY transcript (uptime 'load averages: a b c', sysctl vm.loadavg '{ a b c }', or a
load-gate JSON line), within +-WINDOW s of the run's midpoint. Load is host-wide, so a sample from another agent of
the same host counts. Prints the pairs and a bucket table (1-min load per CPU vs jest wall time).

Usage: python3 scripts/process/load_vs_jest.py <transcript .jsonl or dir> [...] [--window 600] [--ncpu 8] [--json out]"""
import collections
import datetime as dt
import glob
import json
import os
import re
import statistics
import sys

args = sys.argv[1:]
WINDOW = 600.0
NCPU = 8
OUT = None
paths = []
i = 0
while i < len(args):
    if args[i] == '--window': WINDOW = float(args[i + 1]); i += 2
    elif args[i] == '--ncpu': NCPU = int(args[i + 1]); i += 2
    elif args[i] == '--json': OUT = args[i + 1]; i += 2
    else: paths.append(os.path.expanduser(args[i])); i += 1
files = []
for p in paths:
    files += sorted(glob.glob(p + '/**/*.jsonl', recursive=True)) if os.path.isdir(p) else [p]

LOAD = [re.compile(r'load averages?: ([\d.]+),? ([\d.]+),? ([\d.]+)'),
        re.compile(r'\{ ([\d.]+) ([\d.]+) ([\d.]+) \}'),
        re.compile(r'"load1": ?([\d.]+), ?"load5": ?([\d.]+), ?"load15": ?([\d.]+)')]
SUITES = re.compile(r'Test Suites:[^\n]*?(\d+) total')
TIME = re.compile(r'\bTime:\s+(\d+(?:\.\d+)?)\s*s')


def ts(text):
    return dt.datetime.fromisoformat(text.replace('Z', '+00:00')).timestamp()


def text_of(block):
    t = block.get('content')
    if isinstance(t, str): return t
    if isinstance(t, list): return '\n'.join(x.get('text', '') for x in t if isinstance(x, dict))
    return ''


loads, runs = [], []
for path in files:
    with open(path, errors='replace') as handle:
        for line in handle:
            if 'tool_result' not in line: continue
            if 'load average' not in line and '{ ' not in line and 'Test Suites' not in line and 'load1' not in line: continue
            try: rec = json.loads(line)
            except ValueError: continue
            if rec.get('type') != 'user' or 'timestamp' not in rec: continue
            content = rec['message'].get('content')
            if not isinstance(content, list): continue
            when = ts(rec['timestamp'])
            for block in content:
                if not isinstance(block, dict) or block.get('type') != 'tool_result': continue
                text = text_of(block)
                for rx in LOAD:
                    for m in rx.finditer(text):
                        a = float(m.group(1))
                        if 0 <= a < 200: loads.append((when, a, os.path.basename(path)))
                suites = SUITES.findall(text); times = TIME.findall(text)
                if suites and times and int(suites[-1]) >= 100:
                    runs.append({'end': when, 'secs': float(times[-1]), 'suites': int(suites[-1]), 'file': os.path.basename(path)})

loads.sort()
seen, pairs = set(), []
for run in runs:
    key = (round(run['end']), run['secs'])
    if key in seen: continue  # the same summary re-printed by a later cat
    seen.add(key)
    mid = run['end'] - run['secs'] / 2
    near = [l for l in loads if abs(l[0] - mid) <= WINDOW]
    if not near: continue
    best = min(near, key=lambda l: abs(l[0] - mid))
    pairs.append({**run, 'load1': best[1], 'dt_s': round(best[0] - mid), 'date': dt.datetime.fromtimestamp(run['end']).isoformat(timespec='minutes')})

print(f'files {len(files)}; load samples {len(loads)}; full jest runs {len(runs)} (unique {len(seen)}); paired within +-{WINDOW:.0f} s: {len(pairs)}')
for p in sorted(pairs, key=lambda p: p['end']):
    print(f"  {p['date']}  suites {p['suites']:3d}  jest {p['secs']:6.1f} s  load1 {p['load1']:5.2f} ({p['load1'] / NCPU:4.2f}/cpu)  dt {p['dt_s']:+5d} s")
edges = [0, 0.5, 1.0, 1.5, 2.0, 3.0, 99]
buckets = collections.OrderedDict()
for lo, hi in zip(edges, edges[1:]):
    xs = [p['secs'] for p in pairs if lo <= p['load1'] / NCPU < hi]
    buckets[f'{lo}-{hi}'] = xs
    if xs:
        print(f'  load/cpu {lo:>4}-{hi:<4}: n {len(xs):3d}  median {statistics.median(xs):6.1f} s  min {min(xs):6.1f}  max {max(xs):6.1f}')
    else:
        print(f'  load/cpu {lo:>4}-{hi:<4}: n   0')
if OUT:
    with open(OUT, 'w') as handle:
        json.dump({'window_s': WINDOW, 'ncpu': NCPU, 'pairs': pairs, 'buckets': buckets}, handle, indent=1)
