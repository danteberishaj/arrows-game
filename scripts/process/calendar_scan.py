#!/usr/bin/env python3
"""PROCESS-SPEED: calendar decomposition of the session (main transcript + helper active intervals).
A stretch counts as 'active' for a stream when consecutive records are < GAP s apart.
Usage: python3 artifacts/PROCESS-SPEED/calendar_scan.py <main.jsonl> <subagents dir> [GAP=300]"""
import json, glob, os, sys
from datetime import datetime
ts = lambda s: datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp()
MAIN, SUB = map(os.path.expanduser, sys.argv[1:3]); GAP = float(sys.argv[3]) if len(sys.argv) > 3 else 300

def intervals(times):
    times = sorted(times); out = []
    for t in times:
        if out and t - out[-1][1] < GAP: out[-1][1] = t
        else: out.append([t, t])
    return out

def union(iv):
    iv = sorted(iv); out = []
    for s, e in iv:
        if out and s <= out[-1][1]: out[-1][1] = max(out[-1][1], e)
        else: out.append([s, e])
    return out

def length(iv): return sum(e - s for s, e in iv)

def inter(a, b):
    i = j = 0; out = []
    while i < len(a) and j < len(b):
        s = max(a[i][0], b[j][0]); e = min(a[i][1], b[j][1])
        if s < e: out.append([s, e])
        if a[i][1] < b[j][1]: i += 1
        else: j += 1
    return out

main_t = []; owner_msgs = []
for l in open(MAIN):
    try: o = json.loads(l)
    except Exception: continue
    t = o.get('timestamp')
    if not t: continue
    t = ts(t); main_t.append(t)
    if o.get('type') == 'user' and not o.get('isMeta') and not o.get('isSidechain'):
        c = o.get('message', {}).get('content')
        if isinstance(c, str) and not c.startswith('<') and 'SYSTEM NOTIFICATION' not in c:
            owner_msgs.append(t)
helper = []
for p in glob.glob(SUB + '/*.jsonl'):
    tt = []
    for l in open(p):
        try: o = json.loads(l)
        except Exception: continue
        if o.get('timestamp') and o.get('type') in ('assistant', 'user'): tt.append(ts(o['timestamp']))
    # a long foreground tool call has no records in between: bridge gaps up to 11 min (tool cap) as active
    helper += intervals(tt) if False else []
    tt.sort(); cur = None
    for t in tt:
        if cur and t - cur[1] <= 660: cur[1] = t
        else:
            if cur: helper.append(cur)
            cur = [t, t]
    if cur: helper.append(cur)
H = union(helper)
lo = min(s for s, e in H); hi = max(e for s, e in H)
M = [iv for iv in intervals([t for t in main_t if lo <= t <= hi])]
A = union(H + M)
print('window %s .. %s = %.1f h calendar' % (datetime.fromtimestamp(lo), datetime.fromtimestamp(hi), (hi - lo) / 3600))
print('helper-active union %.1f h; main-session active %.1f h; any activity %.1f h; nothing running %.1f h' % (length(H) / 3600, length(M) / 3600, length(A) / 3600, (hi - lo - length(A)) / 3600))
print('main active while no helper active: %.1f h' % ((length(M) - length(inter(M, H))) / 3600))
print('owner (genuine user) messages in window: %d' % sum(1 for t in owner_msgs if lo <= t <= hi))
gaps = sorted([(b[0] - a[1]) for a, b in zip(A, A[1:])], reverse=True)
print('idle gaps >1h: %d totalling %.1f h; >8h: %d totalling %.1f h' % (sum(1 for g in gaps if g > 3600), sum(g for g in gaps if g > 3600) / 3600, sum(1 for g in gaps if g > 28800), sum(g for g in gaps if g > 28800) / 3600))
# helper concurrency
ev = sorted([(s, 1) for s, e in helper] + [(e, -1) for s, e in helper]); k = 0; last = None; conc = {}
for t, d in ev:
    if last is not None and k > 0: conc[k] = conc.get(k, 0) + t - last
    k += d; last = t
print('helper concurrency hours:', {k: round(v / 3600, 1) for k, v in sorted(conc.items())})
