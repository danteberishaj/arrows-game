#!/bin/bash
# Proves a local release bundle before it goes to Play:  bash scripts/release/prove-aab.sh 21 path/to.aab [reference.apk]
# Gates: versionCode N in the merged manifest; only armeabi-v7a + arm64-v8a; signed by the upload key (not the debug key,
# and equal to the reference APK's signer when given); the built flag set equals release/vc<N>.env with no test-ads, QA
# or diagnostic flag; every owner ad unit id is in the JS bundle; no instrumentation. Prints PROOF OK or exits non-zero.
set -euo pipefail
N=${1:?versionCode}; AAB=${2:?aab}; REF=${3:-}
ROOT=$(cd "$(dirname "$0")/../.." && pwd); cd "$ROOT"
fail() { echo "FAIL: $*"; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT

MAN=$(find android/app/build/intermediates -path '*release*' -name AndroidManifest.xml -exec grep -l 'android:versionCode' {} + | head -1)
[ -n "$MAN" ] || fail 'no merged release manifest'
grep -q "android:versionCode=\"$N\"" "$MAN" || fail "versionCode is not $N in $MAN"
grep -q '<instrumentation' "$MAN" && fail 'instrumentation in manifest'
echo "versionCode $N ok ($MAN)"

ABIS=$(unzip -l "$AAB" | grep -oE 'base/lib/[^/]+/' | sort -u | tr '\n' ' ')
[ "$ABIS" = "base/lib/arm64-v8a/ base/lib/armeabi-v7a/ " ] || fail "ABIs: $ABIS"
echo "ABIs ok: $ABIS"

CERT=$(keytool -printcert -jarfile "$AAB" | grep -m1 'SHA256:' | awk '{print $2}')
[ -n "$CERT" ] || fail 'unsigned'
DBG=$(keytool -list -v -keystore android/app/debug.keystore -storepass android 2>/dev/null | grep -m1 'SHA256:' | awk '{print $2}' || true)
[ "$CERT" != "$DBG" ] || fail 'signed with the DEBUG key'
if [ -n "$REF" ]; then
  AS=$(ls -d "$HOME"/Library/Android/sdk/build-tools/*/ | tail -1)apksigner
  RC=$("$AS" verify --print-certs "$REF" | grep -m1 'SHA-256 digest' | awk '{print $NF}' | tr a-f A-F | sed 's/../&:/g; s/:$//')
  [ "$CERT" = "$RC" ] || fail "signer $CERT differs from reference $RC"
  echo "signer equals reference $(basename "$REF")"
fi
echo "signer SHA256 $CERT (not debug)"

grep '^EXPO_PUBLIC_' "release/vc$N.env" | sort > "$T/want"
diff "$T/want" android/flags.txt > /dev/null || fail 'built flag set differs from the record'
grep -qE '^EXPO_PUBLIC_(ADMOB_TEST_ADS|QA_|CAPTURE_DIAG|PERF_|DEV_|CONSENT_FIXTURE)' android/flags.txt && fail 'banned flag built in'
echo "flags equal release/vc$N.env ($(wc -l < "$T/want" | tr -d ' ') flags), no test-ads/QA/diag flag"

unzip -p "$AAB" base/assets/index.android.bundle > "$T/b"
python3 - "$T/b" src/ui/adUnits.ts <<'EOF'
import re, sys
b = open(sys.argv[1], 'rb').read()
ids = sorted(set(re.findall(r"ca-app-pub-9813131856455133/\d+", open(sys.argv[2]).read())))
assert ids, 'no owner ids in adUnits.ts'
for i in ids:
    n = b.count(i.encode()) + b.count(i.encode('utf-16-le'))
    print(f'  owner unit {i}: {n}')
    assert n >= 1, f'owner unit {i} missing from bundle'
print('owner ad units present:', len(ids))
EOF
echo "PROOF OK $(shasum -a 256 "$AAB" | awk '{print $1}')"
