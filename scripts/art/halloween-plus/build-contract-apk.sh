#!/bin/sh
# HALLOWEEN-PLUS diagnostic contract APK: the registered specs PLUS the unregistered candidates (ART_SKINS_CANDIDATES=1)
# in the native fixture data. Uses scripts/art/build-skin-catalogue.py contract, which injects the diagnostic classes and
# the instrumentation entry and removes them in `finally`; this wrapper then proves the product module has exactly its 6
# files again. Needs android/ from build-test-apk.sh. Marker: $L/DONE or $L/FAILED. Run from the repo root under nohup.
set -eu
R=$(pwd)
L=$R/artifacts/HALLOWEEN-PLUS/build/contract
mkdir -p "$L"
rm -f "$L/DONE" "$L/FAILED"
trap 'status=$?; if [ "$status" -eq 0 ]; then date > "$L/DONE"; else echo "exit $status $(date)" > "$L/FAILED"; fi' EXIT
export PATH=/Users/gentlegen/.nvm/versions/node/v20.19.4/bin:$PATH
[ "$(node -v)" = v20.19.4 ]
[ -f "$R/src/ui/skinCandidates.ts" ]
[ -f "$R/credentials/keystore.properties" ] || { echo 'credentials missing: the APK would not match the installed cert'; exit 5; }
[ -f "$R/android/app/build.gradle" ] || { echo 'run build-test-apk.sh first (prebuild)'; exit 5; }
M=$R/modules/arrows-board/android/src/main/java/com/danteb/arrows/board
[ "$(ls "$M" | wc -l | tr -d ' ')" = 6 ]
if pgrep -fl '[G]radleWrapperMain' > "$L/gradle-clients.txt"; then echo 'A Gradle build is running; not starting another.'; exit 2; fi
df -h / | tee "$L/df-before.txt"
FREE_KB=$(df -k / | tail -1 | awk '{print $4}')
[ "$FREE_KB" -ge 5242880 ] || { echo 'less than 5 GB free'; exit 6; }
export ART_SKINS_DIR=artifacts/HALLOWEEN-PLUS ART_SKINS_CANDIDATES=1
node scripts/art/skin-contract-data.cjs > "$L/contract-data.log"
python3 scripts/art/build-skin-catalogue.py contract
ls "$M" > "$L/module-after.txt"
[ "$(ls "$M" | wc -l | tr -d ' ')" = 6 ] || { echo 'diagnostic classes left in the product module'; exit 4; }
if grep -n skinTest android/app/build.gradle; then exit 3; fi
if grep -n SkinContractInstrumentation android/app/src/main/AndroidManifest.xml; then exit 3; fi
python3 scripts/art/halloween-plus/prove-apk.py artifacts/HALLOWEEN-PLUS/perf/catalogue-contract.apk contract | tee "$L/proof.txt"
df -h / | tee "$L/df-after.txt"
