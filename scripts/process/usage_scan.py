#!/usr/bin/env python3
"""PROCESS-SPEED: per-request token usage from subagent transcripts (streamed).
Usage: python3 artifacts/PROCESS-SPEED/usage_scan.py <subagents dir>"""
import json, glob, os, sys, statistics
D = os.path.expanduser(sys.argv[1])
reqs = {}; prompts = []
for p in glob.glob(D + '/*.jsonl'):
    first = True
    for l in open(p):
        o = json.loads(l)
        if first and o.get('type') == 'user':
            c = o['message']['content']; prompts.append(len(c) if isinstance(c, str) else len(json.dumps(c))); first = False
        if o.get('type') != 'assistant':
            continue
        m = o.get('message', {}); u = m.get('usage') or {}
        rid = o.get('requestId') or m.get('id')
        r = reqs.setdefault(rid, dict(out=0, inp=0, cr=0, cc=0))
        r['out'] = max(r['out'], u.get('output_tokens', 0) or 0)
        r['inp'] = max(r['inp'], u.get('input_tokens', 0) or 0)
        r['cr'] = max(r['cr'], u.get('cache_read_input_tokens', 0) or 0)
        r['cc'] = max(r['cc'], u.get('cache_creation_input_tokens', 0) or 0)
R = list(reqs.values())
ctx = [r['inp'] + r['cr'] + r['cc'] for r in R]
print('requests', len(R), 'output tokens', sum(r['out'] for r in R), 'median out/request', statistics.median(r['out'] for r in R))
print('context tokens per request: median %d p90 %d max %d' % (statistics.median(ctx), sorted(ctx)[int(.9 * len(ctx))], max(ctx)))
print('brief chars: median %d p90 %d max %d n %d' % (statistics.median(prompts), sorted(prompts)[int(.9 * len(prompts))], max(prompts), len(prompts)))
