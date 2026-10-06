#!/bin/sh
# HALLOWEEN-PLUS local test-ads build (template: artifacts/HALLOWEEN-01b/build-test-apk.sh). POSIX sh; exits non-zero on
# any failed step and always leaves a marker: $L/DONE on success, $L/FAILED otherwise (wait on either).
# Flags: all META + picker + path + book + SEASONS + EXPO_PUBLIC_ADMOB_TEST_ADS=1, plus the existing camera log
# (EXPO_PUBLIC_LOG_BOARD_VIEWPORT) that the capture script uses to place taps on the zoomed board. Run from the repo root, e.g.
#   nohup sh scripts/art/halloween-plus/build-test-apk.sh > artifacts/HALLOWEEN-PLUS/build/on/nohup.log 2>&1 &
set -eu
R=$(pwd)
L=$R/artifacts/HALLOWEEN-PLUS/build/on
mkdir -p "$L"
rm -f "$L/DONE" "$L/FAILED"
trap 'status=$?; if [ "$status" -eq 0 ]; then date > "$L/DONE"; else echo "exit $status $(date)" > "$L/FAILED"; fi' EXIT
export PATH=/Users/gentlegen/.nvm/versions/node/v20.19.4/bin:$PATH
[ "$(node -v)" = v20.19.4 ]
[ -f "$R/src/ui/skinCandidates.ts" ] # run from the HALLOWEEN-PLUS repo root
export ANDROID_HOME=/Users/gentlegen/Library/Android/sdk
export JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home'
# Same signing certificate as the installed app: the upload-keystore plugin reads ../credentials (a gitignored link).
[ -f "$R/credentials/keystore.properties" ] || { echo 'credentials/keystore.properties missing: the APK would be debug-signed'; exit 5; }
# Diagnostic contract classes must never be in the product module for a normal build.
M=$R/modules/arrows-board/android/src/main/java/com/danteb/arrows/board
for f in "$R"/scripts/art/skin-contract/*.kt; do
  if [ -e "$M/$(basename "$f")" ]; then echo "diagnostic class $(basename "$f") present in product module"; exit 4; fi
done
[ "$(ls "$M" | wc -l | tr -d ' ')" = 6 ]
# One build at a time: refuse while any Gradle client (an active build) runs; idle daemons are reported only.
if pgrep -fl '[G]radleWrapperMain' > "$L/gradle-clients.txt"; then echo 'A Gradle build is running; not starting another.'; exit 2; fi
pgrep -fl '[G]radleDaemon' > "$L/gradle-daemons.txt" || true
for v in $(env | sed -n 's/^\(EXPO_PUBLIC_[A-Za-z0-9_]*\)=.*/\1/p'); do unset "$v"; done
export EXPO_PUBLIC_FTUE=1 EXPO_PUBLIC_FTUE_ASSIST=1 \
  EXPO_PUBLIC_META_STREAK_FREEZE=1 EXPO_PUBLIC_META_EXIT_TO_SCREEN_EDGE=1 EXPO_PUBLIC_META_BOARD_GRID=1 \
  EXPO_PUBLIC_META_ZOOMED_CAMERA=1 EXPO_PUBLIC_META_BANNER=1 EXPO_PUBLIC_META_MISSED_MARK=1 \
  EXPO_PUBLIC_META_PRESS_SPRING=1 EXPO_PUBLIC_META_LEVEL_TRANSITION=1 EXPO_PUBLIC_META_PANEL_MOTION=1 \
  EXPO_PUBLIC_META_DAILY=1 EXPO_PUBLIC_META_GALLERY=1 EXPO_PUBLIC_META_REVIEW_PROMPT=1 \
  EXPO_PUBLIC_META_BLOCKED_INK_HOLD=1 EXPO_PUBLIC_META_HEART_REFILL_POP=1 EXPO_PUBLIC_META_THEME_TRANSITION=1 \
  EXPO_PUBLIC_META_POST_CLEAR_TIMELINE=1 EXPO_PUBLIC_META_SETTINGS_SHEET=1 EXPO_PUBLIC_META_SKIN_PICKER=1 \
  EXPO_PUBLIC_ADMOB_TEST_ADS=1 EXPO_PUBLIC_META_REWARD_PATH=1 EXPO_PUBLIC_META_REWARD_BOOK=1 EXPO_PUBLIC_META_SEASONS=1 \
  EXPO_PUBLIC_LOG_BOARD_VIEWPORT=1
env | grep '^EXPO_PUBLIC_' | sort > "$L/env.txt"
git rev-parse HEAD > "$L/head.txt"
git status --short > "$L/status.txt"
npx expo prebuild --platform android --clean --no-install > "$L/prebuild.log" 2>&1
[ -f android/app/build.gradle ]
if grep -n skinTest android/app/build.gradle; then exit 3; fi
if grep -n SkinContractInstrumentation android/app/src/main/AndroidManifest.xml; then exit 3; fi
# Metro reuses its transform cache across EXPO_PUBLIC_* changes (engineering lessons, W6-01): reset it for every bundle.
if grep -q '^[[:space:]]*extraPackagerArgs' android/app/build.gradle; then exit 3; fi
awk '{print} /^react \{/ && !done {print "    extraPackagerArgs = [\"--reset-cache\"] // HALLOWEEN-PLUS: no stale EXPO_PUBLIC_ transforms"; done=1}' \
  android/app/build.gradle > android/app/build.gradle.tmp
mv android/app/build.gradle.tmp android/app/build.gradle
[ "$(grep -c 'extraPackagerArgs = \["--reset-cache"\]' android/app/build.gradle)" = 1 ]
P=android/app/build/outputs/apk/release/app-release.apk
rm -f "$P" "$L/test-ads.apk"
df -h / | tee "$L/df-before.txt"
FREE_KB=$(df -k / | tail -1 | awk '{print $4}')
[ "$FREE_KB" -ge 5242880 ] || { echo 'less than 5 GB free'; exit 6; }
cd android
./gradlew :app:createBundleReleaseJsAndAssets --rerun :app:assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64 \
  --no-daemon --console=plain '-Dorg.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=1g' > "$L/build.log" 2>&1
cp app/build/outputs/apk/release/app-release.apk "$L/test-ads.apk"
cd "$R"
python3 scripts/art/halloween-plus/prove-apk.py "$L/test-ads.apk" seasons | tee "$L/proof.txt"
df -h / | tee "$L/df-after.txt"
