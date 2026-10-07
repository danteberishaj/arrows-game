#!/usr/bin/env python3
"""Test-ads APK proof, run before any install (scripts/build/build-test-apk.sh). Exits non-zero on any failure.

Usage: prove-test-apk.py <apk> [--cert SHA256] [--allow-profileable]
- Hermes bundle; Google's test app id 3940256099942544 present; every production id absent, in UTF-8 and UTF-16LE.
- No instrumentation entry in the manifest and no SkinContractInstrumentation class in any dex (R8 renames the other
  diagnostic helpers, so the manifest-kept class is the live probe: engineering lessons, HALLOWEEN-01).
- Not profileable unless --allow-profileable (ARROWS_PERF_BUILD=1 perf builds).
- Signing certificate equal to --cert when given (the APK installed on the device, so `install -r` keeps the data).
Task-specific content checks (e.g. which skin names must or must not ship) stay in the task's own prover."""
import hashlib
import pathlib
import re
import subprocess
import sys
import zipfile

args = sys.argv[1:]
apk = pathlib.Path(args[0])
cert_want = args[args.index('--cert') + 1] if '--cert' in args else None
allow_profileable = '--allow-profileable' in args
TEST_ID = '3940256099942544'
PRODUCTION = ['6706292920', '7549521178', '3505414519', '5508761320', '5754923896']
ENC = ['utf-8', 'utf-16-le']


def counts(blob, text):
    return [blob.count(text.encode(e)) for e in ENC]


with zipfile.ZipFile(apk) as archive:
    bundle = archive.read('assets/index.android.bundle')
    dexes = {n: archive.read(n) for n in archive.namelist() if n.endswith('.dex')}
    manifest = archive.read('AndroidManifest.xml')
    libs = sorted(n for n in archive.namelist() if n.startswith('lib/'))
print('APK', apk, 'SHA256', hashlib.sha256(apk.read_bytes()).hexdigest())
print('ABIs', sorted({n.split('/')[1] for n in libs}), 'native libs', len(libs))
print('bundle bytes', len(bundle), 'sha256', hashlib.sha256(bundle).hexdigest(), 'Hermes', bundle[:8].hex() == 'c61fbc03c103191f')
assert bundle[:8].hex() == 'c61fbc03c103191f', 'not a Hermes bundle'
c = counts(bundle, TEST_ID); print(TEST_ID, 'UTF8 / UTF16LE', c); assert sum(c) > 0, 'test app id missing'
for identifier in PRODUCTION:
    c = counts(bundle, identifier); print(identifier, 'UTF8 / UTF16LE', c); assert sum(c) == 0, identifier
instrumentation = manifest.count('instrumentation'.encode('utf-16-le')) + manifest.count(b'instrumentation')
print('manifest instrumentation entries', instrumentation); assert instrumentation == 0
hits = sum(d.count(b'SkinContractInstrumentation') for d in dexes.values()); print('SkinContractInstrumentation dex hits', hits)
assert hits == 0
profileable = manifest.count('profileable'.encode('utf-16-le')) + manifest.count(b'profileable')
print('manifest profileable', profileable)
assert allow_profileable or profileable == 0, 'profileable manifest in a non-perf build'
tools = sorted(pathlib.Path('/Users/gentlegen/Library/Android/sdk/build-tools').glob('*/apksigner'))
out = subprocess.run([str(tools[-1]), 'verify', '--print-certs', str(apk)], capture_output=True, text=True, check=True).stdout
cert = re.search(r'certificate SHA-256 digest: ([0-9a-f]+)', out).group(1)
print('cert', cert, 'want', cert_want or '(not checked)')
assert cert_want is None or cert == cert_want, 'signing certificate differs from the installed APK'
print('PROOF OK')
