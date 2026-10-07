#!/usr/bin/env python3
"""Entry-by-entry APK comparison (PROCESS-SPEED E1/E3 byte guard). Exits 1 when a GUARDED entry differs.

Usage: apk-diff.py <a.apk> <b.apk> [--abi arm64-v8a] [--guard e1|e3] [--json out.json]
  --guard e3 (default): assets/index.android.bundle, classes*.dex, lib/**/*.so, resources.arsc and AndroidManifest.xml
             must be byte-identical (manifest/resources are also compared as `aapt2 dump` text when bytes differ).
  --guard e1: the bundle must be identical and lib/<abi>/*.so must have the same names (bytes are reported, a byte
             difference is printed for explanation, not failed automatically); other ABIs may be absent in b.
META-INF/* (signatures) is listed but never guarded."""
import hashlib
import json
import pathlib
import subprocess
import sys
import zipfile

args = sys.argv[1:]
a_path, b_path = pathlib.Path(args[0]), pathlib.Path(args[1])
abi = args[args.index('--abi') + 1] if '--abi' in args else 'arm64-v8a'
guard = args[args.index('--guard') + 1] if '--guard' in args else 'e3'
out = args[args.index('--json') + 1] if '--json' in args else None


def entries(path):
    with zipfile.ZipFile(path) as z:
        return {i.filename: (hashlib.sha256(z.read(i.filename)).hexdigest(), i.file_size, i.compress_type) for i in z.infolist()}


def aapt2_dump(apk, what):
    tools = sorted(pathlib.Path('/Users/gentlegen/Library/Android/sdk/build-tools').glob('*/aapt2'))
    cmd = [str(tools[-1]), 'dump', 'xmltree', '--file', 'AndroidManifest.xml', str(apk)] if what == 'manifest' else \
        [str(tools[-1]), 'dump', 'resources', str(apk)]
    return subprocess.run(cmd, capture_output=True, text=True).stdout


A, B = entries(a_path), entries(b_path)
same = sorted(n for n in A if n in B and A[n][0] == B[n][0])
differ = sorted(n for n in A if n in B and A[n][0] != B[n][0])
only_a = sorted(set(A) - set(B))
only_b = sorted(set(B) - set(A))
apk_same = hashlib.sha256(a_path.read_bytes()).hexdigest() == hashlib.sha256(b_path.read_bytes()).hexdigest()


def guarded(name):
    if name.startswith('META-INF/'): return False
    if guard == 'e1':
        return name == 'assets/index.android.bundle' or name.startswith(f'lib/{abi}/')
    return (name == 'assets/index.android.bundle' or name.endswith('.dex') and '/' not in name or name.startswith('lib/')
            or name in ('resources.arsc', 'AndroidManifest.xml'))


failures = []
text_equal = {}
for name in differ:
    if not guarded(name): continue
    if name == 'AndroidManifest.xml' or name == 'resources.arsc':
        what = 'manifest' if name == 'AndroidManifest.xml' else 'resources'
        text_equal[name] = aapt2_dump(a_path, what) == aapt2_dump(b_path, what)
    if guard == 'e1' and name.startswith(f'lib/{abi}/'):
        continue  # reported for explanation below
    failures.append(name)
if guard == 'e1':
    names_a = sorted(n for n in A if n.startswith(f'lib/{abi}/')); names_b = sorted(n for n in B if n.startswith(f'lib/{abi}/'))
    if names_a != names_b: failures.append(f'lib/{abi}/ name sets differ')
    other_abis = sorted({n.split('/')[1] for n in only_a if n.startswith('lib/')})
else:
    failures += [n for n in only_a + only_b if guarded(n)]
    other_abis = []
summary = {'a': str(a_path), 'b': str(b_path), 'guard': guard, 'apk_bytes_identical': apk_same,
           'entries_a': len(A), 'entries_b': len(B), 'identical': len(same), 'differ': differ, 'only_a_count': len(only_a),
           'only_b': only_b, 'only_a_abis': other_abis, 'only_a_non_lib': [n for n in only_a if not n.startswith('lib/')],
           'guarded_identical': sorted(n for n in same if guarded(n)), 'aapt2_text_equal': text_equal,
           'lib_abi_bytes_differ': [n for n in differ if n.startswith(f'lib/{abi}/')], 'failures': failures,
           'verdict': 'PASS' if not failures else 'FAIL'}
print(json.dumps({k: (v if k != 'guarded_identical' else f'{len(v)} entries') for k, v in summary.items()}, indent=1))
if out: json.dump(summary, open(out, 'w'), indent=1)
sys.exit(1 if failures else 0)
