#!/usr/bin/env python3
"""PROCESS-SPEED phase 1: where does helper-agent wall-clock go?

Streams every subagent transcript (JSONL) line by line; never loads a file whole.

Method
------
* Timestamps: the ISO-8601 `timestamp` on each JSONL record (millisecond resolution).
* Foreground tool call duration = timestamp(record carrying the tool_result) -
  timestamp(record carrying the tool_use block). Includes permission/classifier
  latency and harness overhead, which is part of what the agent waits on.
* Agent wall-clock = last record timestamp - first record timestamp.
* Exclusive attribution (so categories sum to wall-clock exactly): the agent
  timeline is cut into elementary segments at every tool start/end. A segment
  covered by k concurrent foreground tool calls gives 1/k of its length to each.
  An uncovered segment is "model" time (thinking + text/tool-input generation +
  API latency), EXCEPT when the segment ends at a background-task notification
  (queued_command <task-notification>) and the agent had no foreground call in
  flight: that idle gap is "bg-wait:<category of the background command>".
* Background Bash (run_in_background) calls are also measured end-to-end
  (notification ts - launch ts) and reported separately, not in the exclusive sum.

Usage
-----
python3 artifacts/PROCESS-SPEED/agent_time_audit.py <subagents dir> [out dir] \
    [--metrics ~/.claude/process-metrics/arrows-game.jsonl] [--min-idle-min 30] [--no-metrics]
e.g.
python3 artifacts/PROCESS-SPEED/agent_time_audit.py \
    ~/.claude/projects/-Users-gentlegen-Desktop-Projects-arrows-game/529758e6-3b29-4422-a19a-51e6c72a0675/subagents \
    artifacts/PROCESS-SPEED/out

Process-metrics ledger (owner rule 2026-10-07): one JSON line per helper agent is APPENDED to
--metrics (default ~/.claude/process-metrics/arrows-game.jsonl). Idempotent: task_ids already in
the file are skipped, existing lines are never rewritten, and agents whose last record is newer
than --min-idle-min minutes (probably still running) are left for a later run.
"""
import json, os, re, sys, glob, statistics, collections
from datetime import datetime

_args = sys.argv[1:]
METRICS = os.path.expanduser('~/.claude/process-metrics/arrows-game.jsonl')
MIN_IDLE_MIN = 30.0
WRITE_METRICS = True
_pos = []
_i = 0
while _i < len(_args):
    if _args[_i] == '--metrics':
        METRICS = os.path.expanduser(_args[_i + 1]); _i += 2
    elif _args[_i] == '--min-idle-min':
        MIN_IDLE_MIN = float(_args[_i + 1]); _i += 2
    elif _args[_i] == '--no-metrics':
        WRITE_METRICS = False; _i += 1
    else:
        _pos.append(_args[_i]); _i += 1
SRC = os.path.expanduser(_pos[0])
OUT = _pos[1] if len(_pos) > 1 else 'out'
os.makedirs(OUT, exist_ok=True)


def ts(s):
    return datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp()


# ---------------------------------------------------------------- classification
RX = lambda p: re.compile(p, re.I | re.S)
BASH_RULES = [
    # order matters: first match wins
    ('build:gradle', RX(r'gradlew|assembleRelease|bundleRelease|assembleDebug|\bgradle\b')),
    ('build:prebuild', RX(r'expo\s+prebuild')),
    ('build:js-repack', RX(r'export:embed|hermesc|apksigner|zipalign|bundle-proof|repack')),
    ('build:script', RX(r'(artifacts/[^ ]*/build[^ ]*\.sh|build[-_a-z0-9]*\.sh\b|run-aab|build-test|build_apk)')),
    ('emulator:boot', RX(r'emulator\s+-avd|boot_completed|-no-snapshot|avdmanager|emu\s+kill')),
    ('wait-loop', RX(r'(^|[;&|\n]\s*)(until|while|for)\b.*\bsleep\b|^\s*sleep\s+\d+\s*($|;|&&)|\bwait\s+\$|tail\s+-f')),
    ('test:jest', RX(r'\bjest\b|npm (run )?test|yarn test')),
    ('test:tsc', RX(r'\btsc\b')),
    ('adb:install', RX(r'adb\b[^\n]*\binstall|pm\s+install|install-multiple')),
    ('adb:backup-restore', RX(r'adb\b[^\n]*(\btar\b|backup|restore|run-as|pull\s+/data|push[^\n]*/data)')),
    ('adb:su-sqlite', RX(r'adb\b[^\n]*(\bsu\b|sqlite)')),
    ('adb:screen', RX(r'screencap|screenrecord|exec-out')),
    ('adb:uiautomator', RX(r'uiautomator')),
    ('adb:perf', RX(r'gfxinfo|dumpsys|perfetto|atrace|framestats|simpleperf|meminfo')),
    ('adb:input', RX(r'adb\b[^\n]*input\s+(tap|swipe|keyevent|text)')),
    ('adb:logcat', RX(r'logcat')),
    ('adb:other', RX(r'\badb\b')),
    ('capture-harness', RX(r'capture[-_a-z0-9]*\.(mjs|js|py|sh)|harness')),
    ('image:sharp-ffmpeg', RX(r'\bsharp\b|ffmpeg|ffprobe|magick|convert\s|pixelmatch|sips\b|\.png')),
    ('analysis:python-node', RX(r'\bpython3?\b|\bnode\b|\bnpx\s+(tsx|ts-node)|\btsx\b')),
    ('git', RX(r'^\s*(cd [^;&]+[;&]+\s*)?git\b')),
    ('fs:read-search', RX(r'^\s*(cd [^;&]+[;&]+\s*)?(cat|head|tail|grep|rg|sed -n|ls|find|wc|stat|du|df|awk|diff)\b')),
]


WAIT_TARGETS = [
    ('build', RX(r'build|gradle|\.aab|\.apk|assemble|prebuild|repack')),
    ('perf-series', RX(r'series|chain|perf|pace|soak|gate|fps|gfxinfo|trace|A/?B|run-log')),
    ('test', RX(r'jest|tsc|tdd')),
    ('capture', RX(r'capture|shot|screen|record|png|mp4|frames?')),
    ('device', RX(r'adb|emulator|boot')),
]


def classify_bash(cmd):
    for name, rx in BASH_RULES:
        if rx.search(cmd):
            if name == 'wait-loop':
                for sub, rx2 in WAIT_TARGETS:
                    if rx2.search(cmd):
                        return 'wait-loop:' + sub
                return 'wait-loop:other'
            return name
    return 'bash:other'


def classify(name, inp):
    if name == 'Bash':
        return classify_bash(inp.get('command', '') or '')
    if name in ('Read',):
        return 'tool:Read'
    if name in ('Edit', 'Write', 'MultiEdit', 'NotebookEdit'):
        return 'tool:Edit/Write'
    if name in ('Grep', 'Glob'):
        return 'tool:Grep/Glob'
    if name.startswith('mcp__Claude_Browser') or name.startswith('mcp__claude-in-chrome'):
        return 'tool:browser'
    if name in ('Agent', 'Task', 'SendMessage'):
        return 'tool:agent'
    if name in ('Monitor', 'TaskOutput', 'BashOutput'):
        return 'wait-loop:tool'
    return 'tool:' + name.split('__')[-1]


def norm_cmd(c):
    return re.sub(r'\s+', ' ', c).strip()[:400]


def pct(xs, p):
    if not xs:
        return 0
    xs = sorted(xs)
    k = (len(xs) - 1) * p
    f = int(k)
    c = min(f + 1, len(xs) - 1)
    return xs[f] + (xs[c] - xs[f]) * (k - f)


TIMEOUT_RX = re.compile(r'timed out|Exceeded|timeout after|Command timed out', re.I)
BUILD_FAIL_RX = re.compile(r'BUILD FAILED|FAILURE: Build failed|Execution failed for task', re.I)
HOST_RX = re.compile(r'host (is )?(load|busy|contended)|loaded host|host load|load average|contention|flak', re.I)
NOTIF_RX = re.compile(r'<tool-use-id>(toolu_[A-Za-z0-9]+)</tool-use-id>')


def content_text(c):
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        out = []
        for b in c:
            if isinstance(b, dict):
                if b.get('type') == 'text':
                    out.append(b.get('text', ''))
                elif b.get('type') == 'image':
                    out.append('[image]')
                else:
                    out.append(str(b.get('content', '')))
        return '\n'.join(out)
    return str(c)


agents = []
calls = []  # every foreground tool call
bg = []     # background bash launches

for path in sorted(glob.glob(os.path.join(SRC, '*.jsonl'))):
    aid = os.path.basename(path)[:-6]
    meta = {}
    mp = path[:-6] + '.meta.json'
    if os.path.exists(mp):
        try:
            meta = json.load(open(mp))
        except Exception:
            pass
    first = last = None
    pending = {}   # tool_use_id -> dict
    bg_pending = {}
    events = []    # (t, kind, payload) kind in use/result/notif/assist
    prompt = None
    n_assist_text = 0
    host_mentions = 0
    lessons_reads = []
    usage = {}       # requestId -> max usage seen (records of one request repeat it)
    wake_texts = []
    with open(path) as fh:
        for line in fh:
            try:
                o = json.loads(line)
            except Exception:
                continue
            t = o.get('timestamp')
            if not t:
                continue
            t = ts(t)
            first = t if first is None else min(first, t)
            last = t if last is None else max(last, t)
            typ = o.get('type')
            if typ == 'attachment':
                a = o.get('attachment', {}) or {}
                if a.get('type') == 'queued_command':
                    m = NOTIF_RX.search(str(a.get('prompt', '')))
                    if m:
                        events.append((t, 'notif', m.group(1)))
                continue
            msg = o.get('message', {}) or {}
            c = msg.get('content')
            if typ == 'user':
                if prompt is None and isinstance(c, str):
                    prompt = c
                elif isinstance(c, str):
                    kind = 'resume-session-ended' if 'session ended' in c else ('resume-coordinator' if 'coordinator sent a message' in c else ('resume-bg-notification' if 'SYSTEM NOTIFICATION' in c else 'resume-other'))
                    if 'cut off mid-stream' in c:
                        kind = 'api-cutoff'
                    events.append((t, 'wake', kind))
                    wake_texts.append(c[:3000])
                if isinstance(c, str) and '<task-notification>' in c:
                    m = NOTIF_RX.search(c)
                    if m:
                        events.append((t, 'notif', m.group(1)))
                if isinstance(c, list):
                    for b in c:
                        if not isinstance(b, dict):
                            continue
                        if b.get('type') == 'text' and '<task-notification>' in b.get('text', ''):
                            m = NOTIF_RX.search(b['text'])
                            if m:
                                events.append((t, 'notif', m.group(1)))
                        if b.get('type') == 'tool_result':
                            tid = b.get('tool_use_id')
                            txt = content_text(b.get('content'))
                            events.append((t, 'result', (tid, txt, bool(b.get('is_error')))))
            elif typ == 'assistant':
                u = msg.get('usage') or {}
                rid = o.get('requestId') or msg.get('id')
                if u and rid:
                    r = usage.setdefault(rid, dict(output=0, input=0, cache_read=0, cache_creation=0))
                    r['output'] = max(r['output'], u.get('output_tokens') or 0)
                    r['input'] = max(r['input'], u.get('input_tokens') or 0)
                    r['cache_read'] = max(r['cache_read'], u.get('cache_read_input_tokens') or 0)
                    r['cache_creation'] = max(r['cache_creation'], u.get('cache_creation_input_tokens') or 0)
                if isinstance(c, list):
                    for b in c:
                        if not isinstance(b, dict):
                            continue
                        if b.get('type') == 'tool_use':
                            events.append((t, 'use', b))
                        elif b.get('type') in ('text', 'thinking'):
                            events.append((t, 'assist', None))
                            tx = b.get('text') or ''
                            if HOST_RX.search(tx):
                                host_mentions += 1
    events.sort(key=lambda e: e[0])
    # pair uses and results
    uses = {}
    intervals = []  # (start, end, category, callrec)
    bg_ids = {}
    notif_times = {}
    for t, kind, p in events:
        if kind == 'use':
            uses[p['id']] = (t, p)
        elif kind == 'notif':
            notif_times.setdefault(p, t)
    agent_calls = []
    for t, kind, p in events:
        if kind != 'result':
            continue
        tid, txt, iserr = p
        if tid not in uses:
            continue
        t0, b = uses.pop(tid)
        name = b.get('name', '?')
        inp = b.get('input', {}) or {}
        cat = classify(name, inp)
        cmd = inp.get('command') if name == 'Bash' else (inp.get('file_path') or inp.get('pattern') or inp.get('description') or '')
        rec = dict(agent=aid, desc=meta.get('description'), tool=name, cat=cat, start=t0, end=t,
                   dur=t - t0, cmd=(cmd or '')[:300], full_cmd=norm_cmd(cmd or ''), result_len=len(txt),
                   is_error=iserr, timeout=bool(TIMEOUT_RX.search(txt[:4000] + txt[-2000:])) and (name == 'Bash'),
                   build_failed=bool(BUILD_FAIL_RX.search(txt)) and cat.startswith('build'),
                   background=bool(inp.get('run_in_background')))
        if name == 'Read':
            rec['read_offset'] = inp.get('offset')
            rec['read_limit'] = inp.get('limit')
            rec['read_lines'] = txt.count('\n')
        if 'engineering-lessons' in (cmd or '') or (name == 'Read' and 'engineering-lessons' in str(inp.get('file_path'))):
            lessons_reads.append(dict(tool=name, chars=len(txt), lines=txt.count('\n'), cmd=(cmd or '')[:160]))
        if rec['background']:
            bg_ids[b['id']] = rec
            nt = notif_times.get(b['id'])
            bg.append(dict(agent=aid, desc=meta.get('description'), cat=cat, cmd=rec['cmd'], start=t0,
                           end=nt, dur=(nt - t0) if nt else None))
        agent_calls.append(rec)
        intervals.append((t0, t, rec))
    calls.extend(agent_calls)
    # exclusive attribution
    excl = collections.Counter()
    if first is not None:
        cuts = sorted(set([first, last] + [i[0] for i in intervals] + [i[1] for i in intervals]))
        notif_set = {}
        for nid, nt in notif_times.items():
            if nid in bg_ids:
                notif_set[nt] = bg_ids[nid]['cat']
        notif_sorted = sorted(notif_set.items())
        # also include notification times as cuts so idle gaps end exactly there
        wakes = {e[0]: e[2] for e in events if e[1] == 'wake'}
        cuts = sorted(set(cuts + [n for n, _ in notif_sorted if first <= n <= last] + list(wakes)))
        # last activity time before each cut, to split an idle segment into
        # 'model' (up to the last assistant/tool record) and dormant tail
        acts = sorted(set(e[0] for e in events if e[1] in ('use', 'assist', 'result')))
        # events times for 'last activity' detection
        act_times = sorted(set([e[0] for e in events if e[1] in ('use', 'assist', 'result')]))
        import bisect
        for a, b2 in zip(cuts, cuts[1:]):
            if b2 <= a:
                continue
            mid = (a + b2) / 2
            active = [r for (s, e, r) in intervals if s <= mid < e]
            L = b2 - a
            if active:
                for r in active:
                    excl[r['cat']] += L / len(active)
            else:
                # idle segment: is it waiting for a bg notification?
                # split at the last assistant/tool record inside (a, b2)
                i = bisect.bisect_left(acts, b2) - 1
                lastact = acts[i] if i >= 0 and acts[i] > a else a
                busy = lastact - a      # assistant still producing records -> model
                idle = b2 - lastact     # nothing happening until b2
                excl['model'] += busy
                if b2 in wakes:
                    excl['dormant:' + wakes[b2]] += idle
                elif b2 in notif_set:
                    excl['bg-wait:' + notif_set[b2]] += idle
                else:
                    excl['model'] += idle
    wall = (last - first) if first else 0
    agents.append(dict(agent=aid, desc=meta.get('description'), model=meta.get('model'),
                       prompt=(prompt or '')[:200], start=first, end=last, wall=wall,
                       ncalls=len(agent_calls), excl=dict(excl), host_mentions=host_mentions,
                       lessons_reads=lessons_reads,
                       orphan_uses=len(uses),
                       tokens={k: sum(r[k] for r in usage.values()) for k in ('output', 'input', 'cache_read', 'cache_creation')} if usage else None,
                       n_requests=len(usage), wake_texts=wake_texts))

# ---------------------------------------------------------------- aggregate
tot_wall = sum(a['wall'] for a in agents)
cat_excl = collections.Counter()
for a in agents:
    cat_excl.update(a['excl'])
by_cat = collections.defaultdict(list)
for c in calls:
    by_cat[c['cat']].append(c['dur'])

dormant = sum(v for k, v in cat_excl.items() if k.startswith('dormant:'))
tot_active = tot_wall - dormant
rows = []
for cat in sorted(set(cat_excl) | set(by_cat), key=lambda k: -cat_excl.get(k, 0)):
    d = by_cat.get(cat, [])
    rows.append(dict(cat=cat, excl_h=cat_excl.get(cat, 0) / 3600, share=(cat_excl.get(cat, 0) / tot_active if not cat.startswith('dormant:') else float('nan')),
                     n=len(d), raw_h=sum(d) / 3600, median_s=pct(d, .5), p90_s=pct(d, .9), max_s=max(d) if d else 0))

# session-level union (calendar) of agent activity
spans = sorted((a['start'], a['end']) for a in agents if a['start'])
union = 0
cs, ce = None, None
for s, e in spans:
    if ce is None or s > ce:
        if ce is not None:
            union += ce - cs
        cs, ce = s, e
    else:
        ce = max(ce, e)
if ce is not None:
    union += ce - cs

# retries: identical normalized bash command repeated within one agent
retries = collections.Counter()
seen = collections.defaultdict(collections.Counter)
for c in calls:
    if c['tool'] == 'Bash' and c['full_cmd']:
        seen[c['agent']][c['full_cmd']] += 1
retry_rows = []
for aid, cnt in seen.items():
    for cmd, k in cnt.items():
        if k > 1:
            durs = [c['dur'] for c in calls if c['agent'] == aid and c['full_cmd'] == cmd]
            retry_rows.append(dict(agent=aid, n=k, cmd=cmd[:160], cat=classify_bash(cmd), extra_s=sum(durs) - durs[0]))
retry_rows.sort(key=lambda r: -r['extra_s'])

summary = dict(
    n_agents=len(agents), n_calls=len(calls), total_agent_wall_h=tot_wall / 3600,
    session_union_h=union / 3600,
    excl_sum_h=sum(cat_excl.values()) / 3600,
    dormant_h=dormant / 3600, active_wall_h=tot_active / 3600,
    tool_fg_h=sum(v for k, v in cat_excl.items() if not (k == 'model' or k.startswith('dormant:') or k.startswith('bg-wait:'))) / 3600,
    model_h=cat_excl.get('model', 0) / 3600,
    bgwait_h=sum(v for k, v in cat_excl.items() if k.startswith('bg-wait:')) / 3600,
    wait_cap_hits=sum(1 for c in calls if c['cat'].startswith('wait-loop') and c['dur'] >= 590),
    fg_calls_over_590s=sum(1 for c in calls if c['dur'] >= 590),
    first=min(a['start'] for a in agents if a['start']), last=max(a['end'] for a in agents if a['end']),
    timeouts=sum(1 for c in calls if c['timeout']),
    timeout_h=sum(c['dur'] for c in calls if c['timeout']) / 3600,
    errors=sum(1 for c in calls if c['is_error']),
    build_failed=sum(1 for c in calls if c['build_failed']),
    big_reads=sum(1 for c in calls if c['tool'] == 'Read' and c['result_len'] > 20000),
    big_read_chars=sum(c['result_len'] for c in calls if c['tool'] == 'Read' and c['result_len'] > 20000),
    host_mentions=sum(a['host_mentions'] for a in agents),
    retry_extra_h=sum(r['extra_s'] for r in retry_rows) / 3600,
    bg_launches=len(bg), bg_total_h=sum(b['dur'] or 0 for b in bg) / 3600,
)

json.dump(dict(summary=summary, rows=rows, agents=[{k: v for k, v in a.items() if k != 'wake_texts'} for a in agents], retries=retry_rows[:60], bg=bg), open(os.path.join(OUT, 'audit.json'), 'w'), indent=1, default=str)
with open(os.path.join(OUT, 'calls.jsonl'), 'w') as fh:
    for c in calls:
        fh.write(json.dumps({k: v for k, v in c.items() if k != 'full_cmd'}) + '\n')

# ---------------------------------------------------------------- print
print(json.dumps(summary, indent=1, default=str))
print('\n%-24s %8s %7s %6s %9s %9s %9s %8s' % ('category', 'excl_h', 'share', 'n', 'raw_h', 'med_s', 'p90_s', 'max_s'))
for r in rows:
    print('%-24s %8.2f %6.1f%% %6d %9.2f %9.1f %9.1f %8.0f' % (r['cat'], r['excl_h'], 100 * r['share'], r['n'], r['raw_h'], r['median_s'], r['p90_s'], r['max_s']))
print('\nTop 15 slowest single foreground tool calls:')
for c in sorted(calls, key=lambda c: -c['dur'])[:15]:
    print('%7.1f min  %-20s %-34s %s' % (c['dur'] / 60, c['cat'], (c['desc'] or '')[:34], c['cmd'][:140].replace('\n', ' ')))
print('\nTop background tasks:')
for b in sorted([b for b in bg if b['dur']], key=lambda b: -b['dur'])[:10]:
    print('%7.1f min  %-20s %-34s %s' % (b['dur'] / 60, b['cat'], (b['desc'] or '')[:34], b['cmd'][:120].replace('\n', ' ')))


# ---------------------------------------------------------------- process-metrics ledger
METRIC_CATS = {
    'builds': lambda c: c.startswith('build:') and c != 'build:prebuild',
    'prebuild': lambda c: c == 'build:prebuild',
    'jest': lambda c: c == 'test:jest',
    'tsc': lambda c: c == 'test:tsc',
    'adb_capture': lambda c: (c.startswith('adb:') and c != 'adb:install') or c == 'capture-harness',
    'adb_install': lambda c: c == 'adb:install',
    'emulator_boot': lambda c: c == 'emulator:boot',
    'waits': lambda c: c.startswith('wait-loop') or c.startswith('bg-wait:'),
    'analysis_scripts': lambda c: c == 'analysis:python-node',
    'image_work': lambda c: c == 'image:sharp-ffmpeg',
    'git': lambda c: c == 'git',
}


def metric_cat(c):
    if c == 'model':
        return 'model'
    if c.startswith('dormant:'):
        return 'dormant'
    for k, f in METRIC_CATS.items():
        if f(c):
            return k
    return 'other'


def outcome_of(a):
    """Only when obvious from the coordinator's follow-up messages in the transcript."""
    txt = '\n'.join(a.get('wake_texts') or [])
    if re.search(r'\brevert(ed)?\b', txt, re.I) and re.search(r'\b(we|controller|coordinator)\b[^\n]{0,40}revert', txt, re.I):
        return 'reverted'
    if re.search(r'REQUEST CHANGES|fix round \d|Controller review[^\n]{0,80}fix', txt):
        return 'changes'
    if re.search(r'\bAPPROVE(D)?\b', txt):
        return 'approved'
    return None


if WRITE_METRICS:
    import time as _time
    os.makedirs(os.path.dirname(METRICS), exist_ok=True)
    have = set()
    if os.path.exists(METRICS):
        for line in open(METRICS):
            try:
                have.add(json.loads(line).get('task_id'))
            except Exception:
                pass
    now = _time.time()
    by_agent_calls = collections.defaultdict(list)
    for c in calls:
        by_agent_calls[c['agent']].append(c)
    added = skipped_existing = skipped_recent = 0
    with open(METRICS, 'a') as fh:
        for a in agents:
            if a['agent'] in have:
                skipped_existing += 1
                continue
            if a['end'] is None or now - a['end'] < MIN_IDLE_MIN * 60:
                skipped_recent += 1
                continue
            cm = collections.Counter()
            for k, v in a['excl'].items():
                cm[metric_cat(k)] += v / 60
            ac = by_agent_calls[a['agent']]
            reps = collections.Counter(c['full_cmd'] for c in ac if c['tool'] == 'Bash' and c['full_cmd'] and not c['cat'].startswith('wait-loop'))
            purpose = (a['desc'] or (a['prompt'] or '').strip().splitlines()[0] if (a['desc'] or a['prompt']) else '')[:120]
            rec = dict(
                task_id=a['agent'],
                date=_time.strftime('%Y-%m-%d', _time.localtime(a['start'])),
                purpose=purpose,
                wall_min=round(a['wall'] / 60, 1),
                active_min=round((a['wall'] - sum(v for k, v in a['excl'].items() if k.startswith('dormant:'))) / 60, 1),
                tool_calls=a['ncalls'],
                tokens=(a['tokens']['output'] if a.get('tokens') else None),
                tokens_detail=a.get('tokens'),
                cat_min={k: round(cm.get(k, 0), 1) for k in list(METRIC_CATS) + ['other', 'model', 'dormant']},
                builds_n=sum(1 for c in ac if c['cat'].startswith('build:')),
                timeouts_n=sum(1 for c in ac if c['timeout']),
                retries_n=sum(k - 1 for k in reps.values() if k > 1),
                big_reads_n=sum(1 for c in ac if c['tool'] == 'Read' and c['result_len'] > 20000),
                outcome=outcome_of(a),
                source='agent_time_audit.py v1 (tokens = output tokens; cat_min sums to wall_min incl. model+dormant)',
            )
            fh.write(json.dumps(rec) + '\n')
            added += 1
    print('\nprocess-metrics: %s  added=%d already-present=%d too-recent=%d' % (METRICS, added, skipped_existing, skipped_recent))
