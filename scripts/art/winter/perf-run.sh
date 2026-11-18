#!/bin/bash
# WINTER-01 exit-snow A/B: interleaved Off/Full reps on a fresh Level 1. Usage: perf-run.sh REPS OUTDIR
# Starts from the menu with the Exit chip on Full. Full reps must log 8 SnowFx emits, Off reps 0, or the run aborts.
set -euo pipefail
reps=$1; O=$2; mkdir -p "$O"; rm -f "$O/summary.txt"
D=(bash scripts/art/winter/dev.sh); CHIP=(914 785); PLAY=(720 1922); BACK=(119 203)
uptime > "$O/conditions.txt"
rep() { # label expected_emits
  "${D[@]}" tap "${PLAY[@]}"; sleep 3
  bash scripts/art/winter/perf-ab.sh "$1" "$O"
  "${D[@]}" shot "perf-$1" >/dev/null
  n=$(grep -c emit "$O/$1.snow.txt" || true); [ "$n" = "$2" ] || { echo "ABORT $1: emits=$n want $2"; exit 4; }
  "${D[@]}" tap "${BACK[@]}"; sleep 2
}
for i in $(seq 1 "$reps"); do
  "${D[@]}" tap "${CHIP[@]}"; sleep 0.6; "${D[@]}" tap "${CHIP[@]}"; sleep 0.6   # Full -> Lite -> Off
  rep "off-$i" 0
  "${D[@]}" tap "${CHIP[@]}"; sleep 0.6                                      # Off -> Full
  rep "full-$i" 8
done
uptime >> "$O/conditions.txt"; cat "$O/conditions.txt"
