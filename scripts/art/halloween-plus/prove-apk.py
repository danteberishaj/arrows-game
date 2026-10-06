#!/usr/bin/env python3
"""HALLOWEEN-PLUS APK proof before any install. Usage: prove-apk.py <apk> <seasons|contract>
- Hermes bundle; Google's test app id 3940256099942544 present; production ids absent (UTF-8 and UTF-16LE).
- Same signing certificate as the APK backed up from emulator-5556 (artifacts/HALLOWEEN-PLUS/device/backup.json).
- seasons: no instrumentation in the manifest and no diagnostic class names in any dex; contract: instrumentation present.
- The shipped Mummy / Potion Slime names ARE in the bundle (with 'Candy Corn' as before); the still-unregistered
  candidates (Little Bat) and the unpicked concept variant ids are NOT.
Exits non-zero on any failure."""
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import zipfile

apk = pathlib.Path(sys.argv[1]); mode = sys.argv[2]
assert mode in ('seasons', 'contract'), mode
TEST_ID = '3940256099942544'
PRODUCTION = ['6706292920', '7549521178', '3505414519', '5508761320', '5754923896']
ENC = ['utf-8', 'utf-16-le']


def counts(blob, text):
    return [blob.count(text.encode(e)) for e in ENC]


with zipfile.ZipFile(apk) as archive:
    bundle = archive.read('assets/index.android.bundle')
    dexes = {n: archive.read(n) for n in archive.namelist() if n.endswith('.dex')}
    manifest = archive.read('AndroidManifest.xml')
print('APK', apk, 'SHA256', hashlib.sha256(apk.read_bytes()).hexdigest())
print('bundle bytes', len(bundle), 'Hermes', bundle[:8].hex() == 'c61fbc03c103191f')
assert bundle[:8].hex() == 'c61fbc03c103191f'
c = counts(bundle, TEST_ID); print(TEST_ID, 'UTF8 / UTF16LE', c); assert sum(c) > 0
for identifier in PRODUCTION:
    c = counts(bundle, identifier); print(identifier, 'UTF8 / UTF16LE', c); assert sum(c) == 0, identifier
tools = sorted(pathlib.Path('/Users/gentlegen/Library/Android/sdk/build-tools').glob('*/apksigner'))
out = subprocess.run([str(tools[-1]), 'verify', '--print-certs', str(apk)], capture_output=True, text=True, check=True).stdout
cert = re.search(r'certificate SHA-256 digest: ([0-9a-f]+)', out).group(1)
installed = json.loads(pathlib.Path('artifacts/HALLOWEEN-PLUS/device/backup.json').read_text())['apks'][0]['certSha256']
print('cert', cert, 'installed', installed, 'equal', cert == installed)
assert cert == installed
instrumentation = manifest.count('instrumentation'.encode('utf-16-le')) + manifest.count(b'instrumentation')
print('manifest instrumentation entries', instrumentation)
if mode == 'seasons':
    assert instrumentation == 0
    # R8 renames helper classes; the manifest-kept instrumentation class name is the live probe (HALLOWEEN-01 lesson).
    for cls in ['SkinContractInstrumentation', 'SkinHalloweenContract', 'SkinPolishContract']:
        hits = sum(d.count(cls.encode()) for d in dexes.values()); print('diagnostic class', cls, 'dex hits', hits); assert hits == 0
    for phrase in ['Halloween', 'until']:
        c = counts(bundle, phrase); print(repr(phrase), 'UTF8 / UTF16LE', c); assert sum(c) > 0
else:
    assert instrumentation > 0
    hits = sum(d.count(b'SkinContractInstrumentation') for d in dexes.values()); print('instrumentation class dex hits', hits); assert hits > 0
c = counts(bundle, 'Candy Corn'); print("positive control 'Candy Corn'", c); assert sum(c) > 0
for phrase in ['Mummy', 'Potion Slime', 'potion-slime']:  # shipped 2026-10-07 (registered names and id)
    c = counts(bundle, phrase); print('shipped', repr(phrase), c); assert sum(c) > 0, phrase
for phrase in ['Little Bat', 'little-bat', 'mummy-a', 'mummy-b', 'potion-slime-a', 'potion-slime-b', 'potion-slime-c', 'Mummy A', 'Potion Slime B']:
    c = counts(bundle, phrase); print('candidate', repr(phrase), c); assert sum(c) == 0, phrase
print('PROOF OK', mode)
