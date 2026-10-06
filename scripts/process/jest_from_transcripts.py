#!/usr/bin/env python3
"""PROCESS-SPEED: jest suite timings recovered from tool results in transcripts (no new jest runs).
Parses 'PASS|FAIL <path> (<n> s)' lines and full-run summaries ('Test Suites: ... total' + 'Time: <n> s').
Usage: python3 artifacts/PROCESS-SPEED/jest_from_transcripts.py <subagents dir>"""
import json, glob, os, re, sys, statistics, collections
D = os.path.expanduser(sys.argv[1])
SUITE = re.compile(r'(?:PASS|FAIL)\s+(?:\S+\s+)?(src/\S+\.test\.tsx?)\s+\((\d+(?:\.\d+)?) s\)')
SUM = re.compile(r'Test Suites:[^\n]*?(\d+) total[\s\S]{0,200}?Tests:[^\n]*?(\d+) total[\s\S]{0,200}?Time:\s+(\d+(?:\.\d+)?) ?s')
suites = collections.defaultdict(list); full = []
for p in glob.glob(D + '/*.jsonl'):
    for l in open(p):
        if 'Test Suites' not in l and ' s)' not in l: continue
        o = json.loads(l)
        if o.get('type') != 'user': continue
        c = o['message'].get('content')
        if not isinstance(c, list): continue
        for b in c:
            if not isinstance(b, dict) or b.get('type') != 'tool_result': continue
            t = b.get('content'); t = t if isinstance(t, str) else '\n'.join(x.get('text', '') for x in t if isinstance(x, dict))
            for m in SUITE.finditer(t): suites[m.group(1)].append(float(m.group(2)))
            ts_ = re.findall(r'Test Suites:[^\n]*?(\d+) total', t); tm = re.findall(r'\bTime:\s+(\d+(?:\.\d+)?)\s*s', t)
            if ts_ and tm and int(ts_[-1]) >= 150:
                full.append((int(ts_[-1]), 0, float(tm[-1]), o['timestamp'][:10]))
print('full-suite runs seen in results: %d; Time median %.0f s p90 %.0f s max %.0f s' % (len(full), statistics.median(f[2] for f in full), sorted(f[2] for f in full)[int(.9 * (len(full) - 1))], max(f[2] for f in full)) if full else 'no full runs')
print('suites/tests in latest full run:', sorted(full, key=lambda f: f[3])[-1] if full else None)
rows = sorted(((statistics.median(v), len(v), max(v), k) for k, v in suites.items()), reverse=True)
print('slowest suites (median s of reported times, n, max):')
for med, n, mx, k in rows[:15]: print('  %6.1f %3d %6.1f %s' % (med, n, mx, k))
print('suites with timings:', len(rows), ' sum of medians %.0f s' % sum(r[0] for r in rows))
