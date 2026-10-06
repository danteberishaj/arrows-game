#!/usr/bin/env python3
"""PROCESS-SPEED: parse every Gradle console log under artifacts/ and summarise build cost.

Signals used (no --profile output exists in any log):
  "BUILD SUCCESSFUL in 5m 44s" / "BUILD FAILED in ..."      -> gradle wall time
  "646 actionable tasks: 618 executed, 28 up-to-date"      -> clean vs incremental
  task lines "> Task :x:y" (console=plain)                   -> what ran (CMake, Kotlin, dex, bundle)
  bundleRelease vs assembleRelease task names                -> AAB vs APK
  file mtime                                                 -> when it ran
Usage: python3 artifacts/PROCESS-SPEED/parse_builds.py [artifacts]  (run from repo root)
"""
import os, re, sys, json, collections, statistics, time

ROOT = sys.argv[1] if len(sys.argv) > 1 else 'artifacts'
DUR = re.compile(r'BUILD (SUCCESSFUL|FAILED) in (?:(\d+)h )?(?:(\d+)m )?(?:(\d+)s|(\d+)ms)')
ACT = re.compile(r'(\d+) actionable tasks?: (?:(\d+) executed)?(?:, )?(?:(\d+) from cache)?(?:, )?(?:(\d+) up-to-date)?')
TASK = re.compile(r'^> Task (:\S+)(?: (UP-TO-DATE|SKIPPED|NO-SOURCE|FROM-CACHE))?\s*$')
rows = []
for dp, dn, fn in os.walk(ROOT):
    if 'PROCESS-SPEED' in dp:
        continue
    for f in fn:
        if not (f.endswith('.log') or f.endswith('.out') or f.endswith('.txt')):
            continue
        p = os.path.join(dp, f)
        try:
            if os.path.getsize(p) > 50_000_000:
                continue
            s = open(p, errors='replace').read()
        except Exception:
            continue
        ms = list(DUR.finditer(s))
        if not ms:
            continue
        # a file may contain several builds (driver logs that tail build.log): take each match
        tasks = [m.group(1) for m in (TASK.match(l) for l in s.splitlines()) if m and not m.group(2)]
        skipped = sum(1 for m in (TASK.match(l) for l in s.splitlines()) if m and m.group(2))
        cmake = sum(1 for t in tasks if re.search(r'CMake|externalNativeBuild|buildCMake|configureCMake', t))
        kotlin = sum(1 for t in tasks if 'compile' in t and 'Kotlin' in t)
        kind = 'aab' if re.search(r'Task :app:(bundleRelease|signReleaseBundle|packageReleaseBundle)\b', s) else ('apk' if re.search(r'Task :app:(assembleRelease|packageRelease)\b', s) else ('debug' if 'assembleDebug' in s else '?'))
        abis = re.findall(r'reactNativeArchitectures=([\w,-]+)', s)
        for m in ms:
            h, mi, se, msec = (int(x) if x else 0 for x in m.group(2, 3, 4, 5))
            sec = h * 3600 + mi * 60 + se + msec / 1000
            a = ACT.search(s, m.end())
            total = ex = utd = None
            if a:
                total = int(a.group(1)); ex = int(a.group(2) or 0); utd = int(a.group(4) or 0)
            rows.append(dict(path=p, status=m.group(1), sec=sec, total=total, executed=ex, uptodate=utd,
                             kind=kind, cmake_tasks_run=cmake, kotlin_tasks_run=kotlin, n_task_lines=len(tasks),
                             skipped=skipped, abis=abis[0] if abis else None,
                             mtime=time.strftime('%Y-%m-%d %H:%M', time.localtime(os.path.getmtime(p)))))

# de-duplicate: driver logs that `tail` a build.log repeat the same summary; key on (dir, sec, executed)
seen = set(); uniq = []
for r in sorted(rows, key=lambda r: r['path']):
    k = (os.path.dirname(r['path']).split('/checks')[0].split('/build-')[0], r['sec'], r['executed'], r['mtime'][:13])
    if k in seen:
        continue
    seen.add(k); uniq.append(r)

def cls(r):
    if r['executed'] is None:
        return 'unknown'
    return 'clean(>=400 executed)' if r['executed'] >= 400 else 'incremental(<400 executed)'

g = collections.defaultdict(list)
for r in uniq:
    g[(r['status'], cls(r), r['kind'])].append(r['sec'])
print('builds parsed: %d (raw matches %d)' % (len(uniq), len(rows)))
print('total gradle wall: %.2f h' % (sum(r['sec'] for r in uniq) / 3600))
for k, v in sorted(g.items(), key=lambda kv: -sum(kv[1])):
    print('%-8s %-28s %-5s n=%3d total=%5.2fh median=%5.1fmin p90=%5.1fmin max=%5.1fmin' % (k[0], k[1], k[2], len(v), sum(v) / 3600, statistics.median(v) / 60, sorted(v)[int(.9 * (len(v) - 1))] / 60, max(v) / 60))
print('ABI flags seen:', collections.Counter(r['abis'] for r in uniq))
by_day = collections.Counter(); n_day = collections.Counter()
for r in uniq:
    by_day[r['mtime'][:10]] += r['sec']; n_day[r['mtime'][:10]] += 1
print('by day:', {d: (n_day[d], round(by_day[d] / 3600, 2)) for d in sorted(by_day)})
json.dump(uniq, open(os.path.join(os.path.dirname(__file__), 'out', 'builds.json'), 'w'), indent=1)
