#!/bin/bash
# WINTER-01: run taps in one shell (fast burst), grab a frame, print SnowFx lines and the crash buffer.
# Usage: burst.sh NAME "x1 y1" "x2 y2" ...
set -euo pipefail
A=~/Library/Android/sdk/platform-tools/adb; S=(-s emulator-5556); D=artifacts/WINTER-01/evidence; name=$1; shift
"$A" "${S[@]}" shell dumpsys activity activities | grep -m1 mResumedActivity | grep -q com.danteb.arrows || { echo NOT ON APP; exit 3; }
"$A" "${S[@]}" logcat -c
cmd=""; for p in "$@"; do cmd+="input tap $p; "; done
"$A" "${S[@]}" shell "$cmd screencap -p /sdcard/$name.png"
"$A" "${S[@]}" pull "/sdcard/$name.png" "$D/$name.png" >/dev/null
sleep 1
"$A" "${S[@]}" logcat -d | grep -E "SnowFx" | sed 's/^.*SnowFx/SnowFx/' || echo "no SnowFx lines"
echo "crash: $("$A" "${S[@]}" logcat -b crash -d | wc -l | tr -d ' ') lines"
