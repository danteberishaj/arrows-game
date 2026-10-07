#!/bin/sh
# Shared local TEST-ADS APK build (PROCESS-SPEED E1 + E3, docs/process/speed-experiments-2026-10-07.md).
# NOT for store builds: Play AABs keep their own clean two-ABI recipe (artifacts/ART-SKINS-08/release/build-aab*.sh).
#
#   sh scripts/build/build-test-apk.sh --out DIR [--env FILE] [--clean] [--abis LIST] [--cert SHA256] [--dry-run]
#
#   --out DIR    logs, markers and DIR/test-ads.apk. Always leaves DIR/DONE on success or DIR/FAILED otherwise, so a
#                background wait can match both: until [ -f DIR/DONE ] || [ -f DIR/FAILED ]; do sleep 5; done
#   --env FILE   KEY=VALUE lines (EXPO_PUBLIC_* flags, optionally ARROWS_PERF_BUILD). Every inherited EXPO_PUBLIC_*
#                is unset first. EXPO_PUBLIC_ADMOB_TEST_ADS=1 is always forced; a file that sets it otherwise is refused.
#   --clean      force `expo prebuild --clean` + a clean native build.
#                Default: FINGERPRINT-GATED. When scripts/build/native-fingerprint.sh equals the stamp written by the
#                last successful build here AND android/ is byte-for-byte what that build left, prebuild is skipped and
#                Gradle runs incrementally with the JS bundle task forced to rerun (--rerun, Metro --reset-cache).
#                Any mismatch, a missing stamp, or a failed earlier build makes it clean. (E3: recommendation only until
#                the owner approves; until then pass --clean for evidence builds.)
#   --abis LIST  React Native ABIs (env ABIS works too). Default arm64-v8a: both AVDs and the owner's phone are
#                arm64-v8a, and x86_64 / armeabi-v7a never run on them (E1; recommendation only until the owner approves).
#   --cert SHA   expected signing-certificate SHA-256 (e.g. of the APK installed on emulator-5556); checked in the proof.
#   --dry-run    print the clean/incremental decision and its reason, build nothing.
# Guards kept from the October templates: Node v20.19.4, upload keystore present, product module has exactly its 6
# files and no diagnostic class, one Gradle build at a time, >= 5 GB free, bundle proof before any install.
# Host conditions are recorded before and after (scripts/process/load-gate.sh record) into DIR/conditions.jsonl.
set -eu
R=$(pwd)
out='' envfile='' clean=0 cert='' dry=0
ABIS=${ABIS:-arm64-v8a}
while [ $# -gt 0 ]; do
  case $1 in
    --out) out=$2; shift 2 ;;
    --env) envfile=$2; shift 2 ;;
    --clean) clean=1; shift ;;
    --abis) ABIS=$2; shift 2 ;;
    --cert) cert=$2; shift 2 ;;
    --dry-run) dry=1; shift ;;
    *) echo "unknown argument $1" >&2; exit 2 ;;
  esac
done
[ -n "$out" ] || { echo 'usage: build-test-apk.sh --out DIR [--env FILE] [--clean] [--abis LIST] [--cert SHA256] [--dry-run]' >&2; exit 2; }
[ -f "$R/app.json" ] && [ -f "$R/scripts/build/native-fingerprint.sh" ] || { echo 'run from the repo root' >&2; exit 2; }
export ABIS
STAMP=$R/android/.arrows-test-build-stamp
L=$(mkdir -p "$out" && cd "$out" && pwd)
now() { perl -MTime::HiRes=time -e 'printf "%.1f\n", time'; }
T0=$(now)

if [ "$dry" = 0 ]; then
  rm -f "$L/DONE" "$L/FAILED"
  trap 'status=$?; if [ "$status" -eq 0 ]; then date > "$L/DONE"; else echo "exit $status $(date)" > "$L/FAILED"; fi' EXIT
fi
export PATH=/Users/gentlegen/.nvm/versions/node/v20.19.4/bin:$PATH
[ "$(node -v)" = v20.19.4 ] || { echo "node $(node -v), want v20.19.4"; exit 7; }
export ANDROID_HOME=${ANDROID_HOME:-/Users/gentlegen/Library/Android/sdk}
export JAVA_HOME=${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}

# Flags: start from a clean EXPO_PUBLIC_ slate, apply the file, force test ads.
for v in $(env | sed -n 's/^\(EXPO_PUBLIC_[A-Za-z0-9_]*\)=.*/\1/p'); do unset "$v"; done
if [ -n "$envfile" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case $line in ''|'#'*) continue ;; EXPO_PUBLIC_*=*|ARROWS_PERF_BUILD=*) ;; *) echo "env file: unsupported line $line"; exit 8 ;; esac
    case $line in EXPO_PUBLIC_ADMOB_TEST_ADS=*) [ "$line" = EXPO_PUBLIC_ADMOB_TEST_ADS=1 ] || { echo 'test ads must stay on'; exit 8; } ;; esac
    export "$line"
  done < "$envfile"
fi
export EXPO_PUBLIC_ADMOB_TEST_ADS=1

# Decision: clean or incremental.
FP=$(sh scripts/build/native-fingerprint.sh "$L/native-inputs.txt")
android_state() {  # every android/ file except build outputs and our stamp
  [ -d android ] || { echo none; return; }
  find android -type f ! -path '*/build/*' ! -path '*/.gradle/*' ! -path '*/.cxx/*' ! -path '*/.kotlin/*' \
    ! -path 'android/.arrows-test-build-stamp' | LC_ALL=C sort | while IFS= read -r f; do
    printf '%s %s\n' "$(shasum -a 256 < "$f" | cut -c1-64)" "$f"; done | shasum -a 256 | cut -c1-64
}
mode=clean reason='--clean given'
if [ "$clean" = 0 ]; then
  if [ ! -f "$STAMP" ]; then reason='no stamp (first build, an earlier failure, or another script ran prebuild)'
  elif [ "$(sed -n 's/^fingerprint=//p' "$STAMP")" != "$FP" ]; then reason='native inputs changed since the stamped build'
  elif [ "$(sed -n 's/^android=//p' "$STAMP")" != "$(android_state)" ]; then reason='android/ differs from what the stamped build left'
  else mode=incremental reason='native fingerprint and android/ match the stamped build'
  fi
fi
echo "mode=$mode reason=$reason fingerprint=$FP abis=$ABIS" | tee "$L/decision.txt"
[ "$dry" = 1 ] && exit 0

sh scripts/process/load-gate.sh record --label "build-start $mode" >> "$L/conditions.jsonl"
[ -f "$R/credentials/keystore.properties" ] || { echo 'credentials/keystore.properties missing: the APK would be debug-signed'; exit 5; }
M=$R/modules/arrows-board/android/src/main/java/com/danteb/arrows/board
for f in "$R"/scripts/art/skin-contract/*.kt; do
  [ -e "$f" ] || continue
  if [ -e "$M/$(basename "$f")" ]; then echo "diagnostic class $(basename "$f") present in product module"; exit 4; fi
done
[ "$(ls "$M" | wc -l | tr -d ' ')" = 6 ] || { echo 'product module does not have exactly its 6 files'; exit 4; }
if pgrep -fl '[G]radleWrapperMain' > "$L/gradle-clients.txt"; then echo 'A Gradle build is running; not starting another.'; exit 2; fi
env | grep '^EXPO_PUBLIC_' | sort > "$L/env.txt"
git rev-parse HEAD > "$L/head.txt"
git status --short > "$L/status.txt"
rm -f "$STAMP"  # re-written only after a successful build: a failed/killed build always forces the next one clean

T1=$(now)
if [ "$mode" = clean ]; then
  npx expo prebuild --platform android --clean --no-install > "$L/prebuild.log" 2>&1
  [ -f android/app/build.gradle ]
  # Metro reuses its transform cache across EXPO_PUBLIC_* changes (engineering lessons, W6-01): reset it every bundle.
  if grep -q '^[[:space:]]*extraPackagerArgs' android/app/build.gradle; then exit 3; fi
  awk '{print} /^react \{/ && !done {print "    extraPackagerArgs = [\"--reset-cache\"] // build-test-apk.sh: no stale EXPO_PUBLIC_ transforms"; done=1}' \
    android/app/build.gradle > android/app/build.gradle.tmp
  mv android/app/build.gradle.tmp android/app/build.gradle
fi
T2=$(now)
[ "$(grep -c '^[[:space:]]*extraPackagerArgs = \["--reset-cache"\]' android/app/build.gradle)" = 1 ] || { echo 'android/ lacks the --reset-cache line'; exit 3; }
if grep -n skinTest android/app/build.gradle; then exit 3; fi
if grep -n SkinContractInstrumentation android/app/src/main/AndroidManifest.xml; then exit 3; fi
P=android/app/build/outputs/apk/release/app-release.apk
rm -f "$P" "$L/test-ads.apk"
df -h / > "$L/df-before.txt"
FREE_KB=$(df -k / | tail -1 | awk '{print $4}')
[ "$FREE_KB" -ge 5242880 ] || { echo 'less than 5 GB free'; exit 6; }
(cd android && ./gradlew :app:createBundleReleaseJsAndAssets --rerun :app:assembleRelease -PreactNativeArchitectures="$ABIS" \
  --no-daemon --console=plain '-Dorg.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=1g' > "$L/build.log" 2>&1)
T3=$(now)
cp "$P" "$L/test-ads.apk"
if [ -n "$cert" ]; then python3 scripts/build/prove-test-apk.py "$L/test-ads.apk" --cert "$cert" > "$L/proof.txt"
else python3 scripts/build/prove-test-apk.py "$L/test-ads.apk" > "$L/proof.txt"; fi
printf 'fingerprint=%s\nandroid=%s\nabis=%s\nhead=%s\ntime=%s\n' "$FP" "$(android_state)" "$ABIS" "$(cat "$L/head.txt")" "$(date -u +%FT%TZ)" > "$STAMP"
df -h / > "$L/df-after.txt"
sh scripts/process/load-gate.sh record --label "build-end $mode" >> "$L/conditions.jsonl"
tasks=$(sed -n 's/^\([0-9]*\) actionable tasks: \(.*\)$/\1 actionable: \2/p' "$L/build.log" | tail -1)
T4=$(now)
printf '{"mode":"%s","reason":"%s","abis":"%s","fingerprint":"%s","prebuild_s":%s,"gradle_s":%s,"total_s":%s,"tasks":"%s","apk_sha256":"%s"}\n' \
  "$mode" "$reason" "$ABIS" "$FP" "$(echo "$T2 - $T1" | bc)" "$(echo "$T3 - $T2" | bc)" "$(echo "$T4 - $T0" | bc)" "$tasks" \
  "$(shasum -a 256 < "$L/test-ads.apk" | cut -c1-64)" | tee "$L/build-meta.json"
