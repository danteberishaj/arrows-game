#!/bin/bash
# Local Play release bundle, the way vc17-vc19 were built (no EAS, no cloud cost):
#   bash scripts/release/build-aab.sh 21
# Requirements: a clean tree exactly at tag release/vc<N>, release/vc<N>.env, the gitignored credentials/ link
# (plugins/withUploadKeystore.js signs with it; without it Gradle silently signs with the DEBUG key), Node 20.19.4,
# Android SDK. Steps: flags from the record only -> prebuild --clean -> versionCode N -> both arm ABIs -> clean caches ->
# :app:bundleRelease -> copy to ~/Desktop/arrows-vc<N>-<commit>.aab. Prove it with scripts/release/prove-aab.sh.
set -euo pipefail
N=${1:?usage: build-aab.sh <versionCode>}
ROOT=$(cd "$(dirname "$0")/../.." && pwd); cd "$ROOT"
REC=release/vc$N.env
[ -f "$REC" ] || { echo "missing $REC"; exit 2; }
[ -f credentials/keystore.properties ] || { echo 'credentials/ missing: the bundle would be debug-signed'; exit 3; }
TAG=$(git describe --exact-match --tags HEAD 2>/dev/null || true)
[ "$TAG" = "release/vc$N" ] || { echo "HEAD is not tag release/vc$N (got '$TAG')"; exit 4; }
[ -z "$(git status --porcelain)" ] || { echo 'tree not clean'; git status --short; exit 5; }
COMMIT=$(git rev-parse --short HEAD)
echo "free disk: $(df -h . | tail -1 | awk '{print $4}')"

# Only the record's flags: drop every inherited EXPO_PUBLIC_* first, then export the record.
for v in $(env | grep -o '^EXPO_PUBLIC_[A-Z0-9_]*' || true); do unset "$v"; done
set -a; . "./$REC"; set +a
if env | grep -qE '^EXPO_PUBLIC_(ADMOB_TEST_ADS|QA_|CAPTURE_DIAG|PERF_|DEV_|CONSENT_FIXTURE)'; then echo 'banned flag in env'; exit 6; fi
env | grep '^EXPO_PUBLIC_' | sort > "$ROOT/android-flags.txt.tmp"

npx expo prebuild --clean -p android --no-install
mv "$ROOT/android-flags.txt.tmp" android/flags.txt
sed -i '' -E "s/versionCode [0-9]+/versionCode $N/" android/app/build.gradle
grep -q "versionCode $N\$" android/app/build.gradle || { echo 'versionCode not set'; exit 7; }
if grep -q '^reactNativeArchitectures=' android/gradle.properties; then
  sed -i '' -E 's/^reactNativeArchitectures=.*/reactNativeArchitectures=armeabi-v7a,arm64-v8a/' android/gradle.properties
else echo 'reactNativeArchitectures=armeabi-v7a,arm64-v8a' >> android/gradle.properties; fi

# Metro's cache key ignores env values, so a stale cache can ship old flags (RELEASE.md section 3).
rm -rf "${TMPDIR:-/tmp}"/metro-* "${TMPDIR:-/tmp}"/haste-map-* node_modules/.cache
cd android
./gradlew --stop >/dev/null 2>&1 || true
./gradlew :app:bundleRelease
cd "$ROOT"
OUT=android/app/build/outputs/bundle/release/app-release.aab
DEST="$HOME/Desktop/arrows-vc$N-$COMMIT.aab"
cp "$OUT" "$DEST"
echo "AAB $DEST"; shasum -a 256 "$DEST"
