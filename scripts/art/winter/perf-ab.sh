#!/bin/bash
# WINTER-01 exit-snow perf A/B. Usage: perf-ab.sh LABEL OUTDIR
# Precondition: the app is on Level 1 (fresh, 60 left) with the wanted Exit chip already set.
# Taps 8 arrows that are free on a fresh Level 1 (~3 taps/s), waits for the effects to settle, then dumps gfxinfo.
set -euo pipefail
A=~/Library/Android/sdk/platform-tools/adb; S=(-s emulator-5556); P=com.danteb.arrows; label=$1; out=$2; mkdir -p "$out"
"$A" "${S[@]}" shell dumpsys activity activities | grep -m1 mResumedActivity | grep -q $P || { echo NOT ON APP; exit 3; }
"$A" "${S[@]}" logcat -c
"$A" "${S[@]}" shell dumpsys gfxinfo $P reset >/dev/null
t0=$(python3 -c 'import time;print(time.time())')
# display coords x1.56: top ups x3, left (row 680), upper-left (row 612), right (row 680), right (row 1405), left (row 1405)
"$A" "${S[@]}" shell 'for p in "562 840" "874 840" "975 840" "94 1061" "312 955" "1357 1061" "1388 2192" "47 2192"; do input tap $p; sleep 0.33; done; sleep 1.5'
t1=$(python3 -c 'import time;print(time.time())')
"$A" "${S[@]}" shell dumpsys gfxinfo $P > "$out/$label.gfx.txt"
"$A" "${S[@]}" logcat -d | grep SnowFx | sed 's/^.*SnowFx/SnowFx/' > "$out/$label.snow.txt" || true
win=$(python3 -c "print(round($t1-$t0,2))")
tot=$(grep -m1 'Total frames rendered' "$out/$label.gfx.txt" | awk -F: '{print $2}' | tr -d ' ')
jank=$(grep -m1 'Janky frames:' "$out/$label.gfx.txt" | awk -F: '{print $2}' | sed 's/^ *//')
p50=$(grep -m1 '50th percentile' "$out/$label.gfx.txt" | awk -F: '{print $2}' | tr -d ' ')
p90=$(grep -m1 '90th percentile' "$out/$label.gfx.txt" | awk -F: '{print $2}' | tr -d ' ')
p99=$(grep -m1 '99th percentile' "$out/$label.gfx.txt" | awk -F: '{print $2}' | tr -d ' ')
emits=$(grep -c 'emit' "$out/$label.snow.txt" || true)
crash=$("$A" "${S[@]}" logcat -b crash -d | wc -l | tr -d ' ')
echo "$label window_s=$win expected_at_60=$(python3 -c "print(int($win*60))") frames=$tot jank=$jank p50=$p50 p90=$p90 p99=$p99 snow_emits=$emits crash_lines=$crash" | tee -a "$out/summary.txt"
