#!/bin/sh
# Host-load gate (PROCESS-SPEED E4, docs/process/speed-experiments-2026-10-07.md). POSIX sh, read-only: it never
# signals, renices or kills any process.
#
#   load-gate.sh record [--label L]                          print one JSON conditions line and exit 0
#   load-gate.sh wait   [--label L] [--max-load X] [--timeout S] [--interval S] [--quiet gradle,jest,emulator|none]
#
# record: 1/5/15-min load average, CPU count, free disk on /, and every gradle build client, gradle daemon, jest and
#   emulator process that was NOT started by the calling shell (ancestry walk from LOAD_GATE_OWNER_PID, default the
#   caller's PID). Append the line to a run log or the process ledger.
# wait: polls until the 1-min load is below --max-load AND no foreign process of the --quiet classes runs (default:
#   gradle builds only, the one-build-at-a-time rule), or until --timeout passes. Prints the JSON line with
#   "result":"ok" (exit 0) or "result":"timeout" (exit 3). Run it with run_in_background; it is a blocking wait.
#
# Threshold: --max-load defaults to LOAD_GATE_MAX_LOAD, else 1.0 x CPU count. That is an OWNER-PICKED STARTING VALUE
# derived from archived data (scripts/process/load_vs_jest.py): below 1.0 load per CPU all 5 paired full-jest runs took
# 50-80 s (quiet median 53 s); at or above it, 5 of 10 took 89-263 s.
#
# Test hooks (used by src/__tests__/loadGate.test.ts): LOAD_GATE_LOADAVG_FILE (a file holding "l1 l5 l15", re-read on
# every poll), LOAD_GATE_PS_FILE (a file in `ps -Ao pid=,ppid=,args=` format), LOAD_GATE_NCPU.
set -u

mode=${1:-}
[ -n "$mode" ] && shift
label=''
max_load=${LOAD_GATE_MAX_LOAD:-}
timeout=1800
interval=15
quiet=gradle
while [ $# -gt 0 ]; do
  case $1 in
    --label) label=$2; shift 2 ;;
    --max-load) max_load=$2; shift 2 ;;
    --timeout) timeout=$2; shift 2 ;;
    --interval) interval=$2; shift 2 ;;
    --quiet) quiet=$2; shift 2 ;;
    *) echo "load-gate: unknown argument $1" >&2; exit 2 ;;
  esac
done
case $mode in record|wait) ;; *) echo 'usage: load-gate.sh record|wait [options]' >&2; exit 2 ;; esac

owner=${LOAD_GATE_OWNER_PID:-$PPID}
self=$$

ncpu() {
  if [ -n "${LOAD_GATE_NCPU:-}" ]; then echo "$LOAD_GATE_NCPU"; return; fi
  sysctl -n hw.ncpu 2>/dev/null || getconf _NPROCESSORS_ONLN 2>/dev/null || echo 1
}

loadavg() {  # prints "l1 l5 l15"
  if [ -n "${LOAD_GATE_LOADAVG_FILE:-}" ]; then cat "$LOAD_GATE_LOADAVG_FILE"; return; fi
  if [ -r /proc/loadavg ]; then cut -d' ' -f1-3 /proc/loadavg; return; fi
  sysctl -n vm.loadavg | tr -d '{}' | awk '{print $1, $2, $3}'
}

processes() {
  if [ -n "${LOAD_GATE_PS_FILE:-}" ]; then cat "$LOAD_GATE_PS_FILE"; return; fi
  ps -Ao pid=,ppid=,args=
}

# Prints "class pid basename" for each foreign heavy process. A process is ours (skipped) when the owner shell or this
# script is one of its ancestors.
foreign() {
  processes | awk -v owner="$owner" -v self="$self" '
    { pid = $1; parent[pid] = $2; $1 = ""; $2 = ""; sub(/^  */, ""); cmd[pid] = $0 }
    END {
      for (pid in cmd) {
        c = cmd[pid]; cls = ""
        if (c ~ /GradleWrapperMain/) cls = "gradle_build"
        else if (c ~ /GradleDaemon/) cls = "gradle_daemon"
        else if (c ~ /qemu-system/) cls = "emulator"
        else if (c ~ /node_modules\/(\.bin\/jest|jest\/bin\/jest|jest-cli\/bin|jest-worker\/build\/(workers\/)?processChild)/) cls = "jest"
        if (cls == "") continue
        mine = 0; p = pid; hops = 0
        while (p != "" && p != "0" && hops < 64) {
          if (p == owner || p == self) { mine = 1; break }
          p = parent[p]; hops++
        }
        if (mine) continue
        split(c, words, " "); n = split(words[1], parts, "/")
        print cls, pid, parts[n]
      }
    }'
}

json_line() {  # $1 result, $2 waited seconds
  set -- "$1" "$2" "$(loadavg)" "$(foreign)"
  l1=$(echo "$3" | awk '{print $1}'); l5=$(echo "$3" | awk '{print $2}'); l15=$(echo "$3" | awk '{print $3}')
  free_kb=$(df -k / | tail -1 | awk '{print $4}')
  printf '%s\n' "$4" | awk -v mode="$mode" -v label="$label" -v l1="$l1" -v l5="$l5" -v l15="$l15" -v n="$(ncpu)" \
    -v free_kb="$free_kb" -v max="$max_load" -v result="$1" -v waited="$2" -v when="$(date -u +%Y-%m-%dT%H:%M:%SZ)" '
    function esc(s) { gsub(/\\/, "\\\\", s); gsub(/"/, "\\\"", s); return s }
    NF >= 2 { count[$1]++; list = list (list == "" ? "" : ",") "{\"class\":\"" $1 "\",\"pid\":" $2 ",\"exe\":\"" esc($3) "\"}" }
    END {
      printf "{\"schema\":\"load-gate/1\",\"time\":\"%s\",\"mode\":\"%s\",\"label\":\"%s\",", when, mode, esc(label)
      printf "\"load1\":%s,\"load5\":%s,\"load15\":%s,\"ncpu\":%d,\"load1_per_cpu\":%.2f,", l1, l5, l15, n, l1 / n
      printf "\"disk_free_gb\":%.1f,\"foreign\":{\"gradle_build\":%d,\"gradle_daemon\":%d,\"jest\":%d,\"emulator\":%d},", free_kb / 1048576, count["gradle_build"], count["gradle_daemon"], count["jest"], count["emulator"]
      printf "\"foreign_procs\":[%s]", list
      if (result != "") printf ",\"max_load\":%s,\"waited_s\":%d,\"result\":\"%s\"", max, waited, result
      printf "}\n"
    }'
}

if [ "$mode" = record ]; then
  json_line '' 0
  exit 0
fi

[ -n "$max_load" ] || max_load=$(ncpu)
start=$(date +%s)
while :; do
  l1=$(loadavg | awk '{print $1}')
  blocked=0
  if [ "$quiet" != none ]; then
    for cls in $(echo "$quiet" | tr ',' ' '); do
      case $cls in
        gradle) pattern='^gradle_build ' ;;
        jest) pattern='^jest ' ;;
        emulator) pattern='^emulator ' ;;
        *) echo "load-gate: unknown --quiet class $cls" >&2; exit 2 ;;
      esac
      if foreign | grep -q "$pattern"; then blocked=1; fi
    done
  fi
  waited=$(( $(date +%s) - start ))
  if [ "$blocked" = 0 ] && awk -v a="$l1" -v b="$max_load" 'BEGIN { exit !(a < b) }'; then
    json_line ok "$waited"
    exit 0
  fi
  if [ "$waited" -ge "$timeout" ]; then
    json_line timeout "$waited"
    exit 3
  fi
  sleep "$interval"
done
