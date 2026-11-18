#!/bin/bash
# WINTER-01 emulator helper. Usage: scripts/art/winter/dev.sh launch | shot NAME | tap X Y | resumed | log
set -euo pipefail
A=~/Library/Android/sdk/platform-tools/adb
S=(-s emulator-5556)
D=artifacts/WINTER-01/evidence
mkdir -p "$D"
resumed() { "$A" "${S[@]}" shell dumpsys activity activities | grep -m1 mResumedActivity || true; }
case "$1" in
  launch)
    "$A" "${S[@]}" logcat -c
    "$A" "${S[@]}" shell monkey -p com.danteb.arrows -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
    for _ in $(seq 1 20); do resumed | grep -q com.danteb.arrows && break; sleep 1; done
    resumed ;;
  resumed) resumed ;;
  shot) resumed | grep -q com.danteb.arrows || { echo "NOT ON APP: $(resumed)"; exit 3; }
        "$A" "${S[@]}" exec-out screencap -p > "$D/$2.png"; echo "SHOT $D/$2.png" ;;
  tap) resumed | grep -q com.danteb.arrows || { echo "NOT ON APP: $(resumed)"; exit 3; }
       "$A" "${S[@]}" shell input tap "$2" "$3" ;;
  log) "$A" "${S[@]}" logcat -d | grep -iE "FATAL|AndroidRuntime: |ReactNativeJS" | tail -20 || true ;;
esac
