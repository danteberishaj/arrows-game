#!/usr/bin/env python3
"""PROCESS-SPEED: per-request model latency vs context size.
latency = timestamp(last record of request) - timestamp(the record that preceded the request's first record)
Usage: python3 artifacts/PROCESS-SPEED/latency_vs_context.py <subagents dir>"""
import json, glob, os, sys, statistics, collections
from datetime import datetime
ts = lambda s: datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp()
D = os.path.expanduser(sys.argv[1])
rows = []
for p in glob.glob(D + '/*.jsonl'):
    prev_t = None; cur = None
    for l in open(p):
        o = json.loads(l); t = o.get('timestamp')
        if not t: continue
        t = ts(t)
        if o.get('type') == 'assistant':
            rid = o.get('requestId')
            u = o['message'].get('usage') or {}
            if cur and cur['rid'] == rid:
                cur['end'] = t; cur['out'] = max(cur['out'], u.get('output_tokens') or 0)
            else:
                if cur: rows.append(cur)
                ctx = (u.get('input_tokens') or 0) + (u.get('cache_read_input_tokens') or 0) + (u.get('cache_creation_input_tokens') or 0)
                cur = dict(rid=rid, start=prev_t if prev_t else t, end=t, ctx=ctx, out=u.get('output_tokens') or 0)
        elif o.get('type') == 'user':
            if cur: rows.append(cur); cur = None
        if o.get('type') in ('assistant', 'user'): prev_t = t
    if cur: rows.append(cur)
rows = [r for r in rows if 0 <= r['end'] - r['start'] < 900]
b = collections.defaultdict(list)
for r in rows:
    b[min(r['ctx'] // 100000, 6)].append(r)
print('requests', len(rows))
print('ctx bucket   n    median_s  p90_s  median_out_tok  median_s_per_1k_out')
for k in sorted(b):
    v = b[k]; d = [r['end'] - r['start'] for r in v]
    rate = [ (r['end'] - r['start']) / max(r['out'], 1) * 1000 for r in v if r['out'] > 200]
    print('%3d-%3dk %6d %8.1f %7.1f %10d %10.1f' % (k * 100, k * 100 + 100, len(v), statistics.median(d), sorted(d)[int(.9 * len(d))], statistics.median(r['out'] for r in v), statistics.median(rate) if rate else 0))
