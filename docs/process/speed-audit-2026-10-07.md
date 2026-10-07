# Process speed audit, phase 1 (2026-10-07)

Question from the owner (2026-10-07): why does the work take so long, where are the bottlenecks, and how can we go
faster without any loss of performance or visual quality?

This is phase 1: measurement and experiment design only. No product code, build, emulator or git state was touched.
Every number below was produced by a script in `artifacts/PROCESS-SPEED/` and can be re-run. Tags:
**[measured]** = executed and read from data; **[inferred]** = reasoning from data, not executed;
**[unmeasured]** = no data exists yet, so it becomes a phase-2 measurement.

## 0. Answer in five lines

1. Most calendar time is time when nothing runs. In the 20.2-day window, some helper or the main session was active for
   94.9 h of 485.5 h. 390.6 h had nothing running (38 gaps over 1 h, 13 of them over 8 h). Tool speed cannot fix that;
   only keeping the queue full and owner turnaround can. **[measured]**
2. Inside helper work (101.3 active agent-hours), the largest costs are model time (34.2 %) and waiting on emulator perf
   and gate series (23.2 %). Builds are only 6.2 %, jest 7.0 % and installs 2.9 %. **[measured]**
3. The clear waste is:
   - clean native rebuilds for test APKs: 31 clean test builds took 3.6 h; incremental builds would have taken about
     0.6 h;
   - the x86_64 ABI in the October test-APK template, although both AVDs are arm64-v8a;
   - perf runs discarded because of host load from other sessions;
   - per-task copies of harness scripts.
4. Several premises in the brief do not hold:
   - helpers rarely read `docs/engineering-lessons.md`: 15 of 92 agents, by grep/sed, about 93k tokens in total;
   - literal command retries cost only 0.74 h;
   - `prebuild` itself takes 5–18 s, so the cost of `--clean` is the clean native compile it forces;
   - most September test builds were already incremental and arm64-only.
5. The biggest safe lever inside agent time is the perf-series protocol, if a pre-registered early-stop rule reaches the
   same verdict as the full series on all historical data. That replay can be tested offline, without the emulator.

## (a) Measured breakdown

**Source:** 93 subagent transcripts of session `529758e6…` (`subagents/*.jsonl` + `.meta.json`, 394 MB), streamed line
by line. They cover 2026-09-16 19:33 to 2026-10-07 01:04 local time, with 12,263 tool calls. The 93rd agent is this audit,
which is still running and adds well under 1 h.

**Method:**
- **Duration of a foreground call:** timestamp of the record carrying the `tool_result`, minus the timestamp of the record
  carrying the `tool_use`. Timestamps are ISO-8601 with **millisecond resolution**. The `tool_use` record is written
  when the block streams, so a call's start can lead its real start by a sub-second amount.
- **Exclusive attribution:** each agent's timeline is cut at every call start and end. Concurrent calls split each
  segment equally, so categories sum *exactly* to wall-clock.
- **Gaps with no call in flight:**
  - they count as **model** time, up to the agent's last assistant record;
  - the tail that ends in a coordinator resume or a background-task wake is **dormant**: the agent had ended its turn
    and was not working;
  - a tail that ends at a background-task notification for that agent's own launched job is **bg-wait**.
- **Bash classification:** regex on the command text, first match wins. See `BASH_RULES` in the script. The
  "perf-series" wait class is a heuristic: a wait loop whose command mentions series|chain|perf|pace|soak|gate|fps|trace.

**Reproduce:**
```
python3 scripts/process/agent_time_audit.py \
  ~/.claude/projects/-Users-gentlegen-Desktop-Projects-arrows-game/529758e6-3b29-4422-a19a-51e6c72a0675/subagents \
  artifacts/PROCESS-SPEED/out
# outputs: out/audit.json, out/calls.jsonl (one row per call), stdout table (saved as out/audit-stdout.txt)
python3 scripts/process/calendar_scan.py <main session .jsonl> <subagents dir>      # calendar decomposition
python3 scripts/process/parse_builds.py artifacts                                   # gradle logs -> out/builds.json
python3 scripts/process/latency_vs_context.py <subagents dir>                       # model latency vs context
python3 scripts/process/usage_scan.py <subagents dir>                               # tokens per request
python3 scripts/process/jest_from_transcripts.py <subagents dir>                    # per-suite jest times
```

### Reconciliation (helpers)

| | hours |
|---|---|
| Sum of agent wall-clock (first record to last record) | **158.83** |
| − dormant: ended turn, waiting for a coordinator message or a late background wake | 57.49 (42.16 bg-notification wakes, 15.05 coordinator resumes, 0.22 API cut-off, 0.06 session-ended) |
| = **active agent time** | **101.34** |
| foreground tool time (exclusive) | 66.55 (raw, overlapping sum 66.82) |
| model time (thinking + output + API) | 34.64 |
| idle waits on own background jobs | 0.15 |
| **unexplained remainder** | **0.00 by construction**: everything not covered by a tool call is model time |

**Cross-check of model time [measured]:** 11,626 API requests produced 10.48 M output tokens. That is 84 tokens/s over
the 34.64 h, or about 10.7 s per request. A separate per-request estimate is consistent with it: a median of
10.4–11.4 s per 1k output tokens in every context-size bucket (`latency_vs_context.py`). Model time therefore scales with
**output tokens**, not with context size. Median context per request is 277k tokens (p90 535k).

### Category table (active agent time = 101.3 h)

| Category | Hours | Share | Median call | p90 call | Calls |
|---|---|---|---|---|---|
| Model (thinking, output, API) | 34.6 | 34.2 % | – | – | 11,626 req |
| Perf/gate series waits (A/B soaks, fps chains on emulator) | 23.5 | 23.2 % | 303 s | 603 s | 270 |
| Analysis / driver scripts (python, node, tsx) | 9.6 | 9.5 % | 2 s | 20 s | 2,760 |
| Other waits (3.6 h is RE-CEILING generator search; rest mixed) | 7.8 | 7.7 % | 20 s | 601 s | 154 |
| Jest (+ waits on jest) | 7.1 | 7.0 % | 7 s | 55 s | 1,065 |
| Builds: gradle, build scripts, JS repack, waits on builds | 6.3 | 6.2 % | 2 s | 57 s | 775 |
| Device capture & adb (screen, logcat, gfxinfo, uiautomator, sqlite, harness, boot) | 5.5 | 5.4 % | 3 s | 39 s | 999 |
| APK install | 2.9 | 2.9 % | 37 s | 193 s | 140 |
| Everything else (fs reads, edits, git, browser, misc) | 2.3 | 2.3 % | 0 s | 2 s | 5,377 |
| Image work (sharp, ffmpeg, png) | 1.3 | 1.3 % | 3 s | 13 s | 591 |
| tsc | 0.3 | 0.3 % | 8 s | 14 s | 132 |

**Concentration:** the top 8 agents (W2-04, POLISH-T11, RE-CEILING, PANEL-STUCK, POLISH-T12, POLISH-T10, PERF-DEADTAG,
W3-15/W7-09) hold 39 % of active time. The median agent was active 0.52 h.

Perf/gate waits by task:

| Task | Hours |
|---|---|
| W2-04 | 5.9 |
| POLISH-T11 | 4.2 |
| POLISH-T12 | 2.5 |
| W3-15/W7-09 | 1.7 |
| PANEL-STUCK | 1.7 |
| PERF-DEADTAG | 1.4 |
| POLISH-T10 | 1.2 |
| W5-02/W5-08 | 1.1 |

### The 15 slowest single calls

All 15 are foreground waits that ran into the 10-minute Bash cap (601–644 s).
- 12 wait on perf/gate chains: POLISH-T11 ×5, W2-04 ×4, POLISH-T12 ×3, POLISH-T10 ×1.
- 2 wait on a full jest run under load (W5-17).
- 1 waits on the HALLOWEEN-PLUS build (`for … seq 1 110 … sleep 5`).

Across the window, **142 wait loops hit the cap** and were re-issued; 151 calls in total ran ≥ 590 s. The longest
background jobs were:

| Job | Minutes |
|---|---|
| W2-04 `soak-series.sh` | 344 |
| W2-04 wait | 203 |
| POLISH-T11 `chain-after.sh` | 131 |
| W2-04 wait | 96 |
| PANEL-STUCK acceptance | 71 |

Full list: `out/audit-stdout.txt`.

### Calendar (main session + helpers) [measured, `calendar_scan.py`]

- **Window:** 485.5 h.
- **Activity:**
  - any helper active: 84.1 h;
  - main session active: 20.1 h, of which 10.8 h with no helper running;
  - anything active: 94.9 h;
  - **nothing running: 390.6 h (80 %)**.
- **Owner messages:** 183.
- **Helper concurrency:** 1 helper for 67.1 h, 2 for 16.2 h, 3+ for 0.8 h. The work is effectively serial.

Activity is defined as consecutive records less than 5 min apart for the main session, or less than 11 min apart for
helpers, which bridges a capped tool call.

### Builds [measured, `parse_builds.py`, 222 gradle runs in artifacts logs]

| Build class | n | Total | Median | p90 |
|---|---|---|---|---|
| Incremental (< 400 tasks executed), success | 175 | ~5.0 h | 1.1 min | 3.4 min |
| Clean test APKs (≥ 400 executed) | 31 | 3.56 h | 4.5 min | 8–12 min (max 35.4 min under load) |
| Clean release AABs (ART-SKINS-08) | 6 | 1.03 h | 10.7 min | 14.6 min |
| Failed | 11 | 0.43 h | | |
| **All gradle** | 222 | **9.99 h** | | |

Builds per day: 1–35. The heaviest days were 10-02 (1.68 h), 10-04 (1.58 h) and 10-06 (1.55 h).

- **`prebuild` alone [measured]:** 5–18 s in 5 runs, from file mtimes (env.txt → prebuild.log). Examples:
  - ART-SKINS-08 aab16: 11 s;
  - REWARD-01: 18 s.

  The cost of `prebuild --clean` is downstream of `prebuild` itself. After it, gradle re-executes about 618 of 646
  tasks, compared with about 27 tasks in an incremental build.
- **Incremental builds [measured]:** they still run 15 CMake tasks (configure/build for skia, worklets, reanimated,
  expo-modules-core, gesture-handler and app). With nothing to compile these are mostly no-ops. A typical incremental
  build runs in 47–66 s. W3-21's three upload-signed incremental builds took about 40 s each.
- **ABIs [measured]:**

  | Builds | Clean median |
  |---|---|
  | arm64 only | 3.5 min (n = 17) |
  | arm64 + x86_64 | 7.7 min (n = 7: LOG-GATE, PETAL-ADS-01, REWARD-01, BOOK-01, HALLOWEEN-01/01b, HALLOWEEN-PLUS template) |
  | armeabi-v7a + arm64 (release) | 10.7 min (n = 6) |

  The comparison is confounded by date and host load.
- **AVD ABI [measured]:** both AVDs are `abi.type=arm64-v8a` (`~/.android/avd/*/config.ini`), so **x86_64 is never
  used**.
- **Daemon and caches:** every build script uses `--no-daemon` plus custom `-Dorg.gradle.jvmargs`, which forces a
  single-use daemon fork ("To honour the JVM settings…"). None uses `--build-cache` or `--configuration-cache`.
- **No task-level timing exists.** No log has `--profile` or `--scan` output, so which gradle task dominates a clean
  build is **[unmeasured]**. Experiment E0 measures it.

### Jest and tsc [measured]

- **Configuration:** two projects, `core` (ts-jest, node) and `ui` (jest-expo). `maxWorkers` resolves to 7 on this
  8-core host, and the transform cache is on (`/var/folders/…/jest_dx`).
- **Size:** `jest --listTests` lists 301 files today.
- **Saved full-suite runs:** 81 summaries under `artifacts/*/…jest*.txt`, with a median of **91 s**, a p90 of
  **258 s** and a max of **777 s**. The same suite took 55–70 s on a quiet host and 219 s under load (HALLOWEEN-01
  logs, 2026-10-04).
- **Slowest suites:**

  | Suite | Median when reported |
  |---|---|
  | `GameScreen.panelDepth` | 197 s |
  | `a11yLabels` | 100 s |
  | `adsKillSwitch` | 75 s |
  | `HomeScreen.collection` | 69 s |
  | `GameScreen.heartRefillPop` | 61 s |
  | `levelGenerator` (26 samples) | 42 s |

  These are the times jest printed in tool results, mostly under load.
- **My own timed run was stopped.** I started one timed `--json` run at 00:59. Load average rose from 25 to 34–37 while
  the other helper's gradle build was running, so I killed my run after about 20 minutes to protect that build. No
  per-suite JSON was produced; an E8 baseline must be taken on a quiet host.
- **tsc:** 132 calls, median 8 s; it is already incremental (`node_modules/.cache/tsc.tsbuildinfo` exists).

### Other counters [measured]

- **Timeouts:** 41 tool results mention a timeout, together 0.19 h.
- **Errored tool results:** 265.
- **Build-failure markers in tool results:** 17.
- **Identical non-wait commands repeated in one agent:** 69 extra runs, **0.74 h**. Repeated wait loops add 11.4 h, but
  those are polling, not retries.
- **Big reads:** 92 `Read` results over 20k chars, 3.3 M chars in total. The most frequent were GameScreen.tsx,
  difficulty-probe.ts, ads.tsx and ArrowsBoardView.kt.
- **`docs/engineering-lessons.md`** (85,199 bytes, 960 lines, about 21k tokens):
  - 15 of 92 agents touched it, always with grep or sed and never with Read: 90 calls, 371k chars, 5.1k lines in total;
  - the `Read` tool never loaded it whole.
- **Per-task script authoring:**
  - 384 Write or `cat > … <<` calls created scripts under artifacts, in 42 agents;
  - that is 1.44 M chars, about 0.36 M tokens, or about 1.1 h of pure generation;
  - debugging those scripts is not separable from the data.
  - 489 `.mjs/.sh/.py` files sit in `artifacts/*/scripts*`.
- **Host load:** 42 reports mention host load or contention. POLISH-T11, W2-07 and POLISH-T10 record runs that were
  discarded or flagged for host load ("swap-bound slow mode", load average 5–38 from other sessions).

## (b) Bottlenecks ranked by measured time

| # | Bottleneck | Hours (share of 101.3 h) | Inherent vs waste |
|---|---|---|---|
| 1 | **Model time** | 34.6 (34 %) | Mostly inherent: reasoning at high/xhigh effort, about 11 s per 1k output tokens. Some waste: re-issuing 142 capped wait loops, and re-deriving harness scripts per task (about 1.1 h of generation, more in debugging). |
| 2 | **Perf/gate series on the emulator** | 23.5 (23 %) | Mostly inherent: pre-registered A/B/A protocols at about 23 min per soak run, ×15 in W2-04. Waste: runs discarded for host load (POLISH-T11, W2-07), slow-mode stalls caused by other sessions, and series rerun after superseded builds (POLISH-T12 first 5-strip round, W2-04 `superseded-prefinal`). Only the waste share is attackable without weakening gates. |
| 3 | **Analysis/driver scripts** | 9.6 (9.5 %) | Mixed. Generator/difficulty analysis is inherent. Per-task drivers (`winshot.mjs`, `cap207.mjs`, `cap506.mjs`, `capcam.mjs`, `drive.mjs`, `loopps.mjs`, `w321.mjs`, …) are re-invented per task. |
| 4 | **Other waits** | 7.8 (7.7 %) | Mostly inherent compute (RE-CEILING generator search, 3.6 h). |
| 5 | **Jest** | 7.1 (7.0 %) | Waste under load: the same full suite takes 55 s quiet and 219–777 s loaded, with 7 workers fighting gradle and the emulator. Also full runs where related-test runs would do while iterating. |
| 6 | **Builds** | 6.3 in agent time; 10.0 h of gradle wall overall | Waste: 31 clean test builds (3.6 h, of which about 3.0 h avoidable); x86_64 compiled into 7 of them; 11 failed builds (0.43 h); cold caches after `~/.gradle/caches` vanished twice (memory: shared-host-contention). Inherent: 6 release AABs (1.03 h), which must stay clean. |
| 7 | **Device capture/adb + installs** | 8.4 (8.3 %) | Mostly inherent device evidence. Waste: slow installs under load (p90 193 s against a median of 37 s), and emulator collisions between parallel agents (W2-09). |
| — | **Calendar idle** (not agent time) | 390.6 h of 485.5 h | Owner and session availability. The single biggest determinant of "why it takes long" in calendar terms. |

Already small, so do not prioritise:
- lessons-file reads, about 93k tokens across all agents;
- literal retries, 0.74 h;
- timeouts, 0.19 h;
- tsc, 0.3 h;
- backup/restore by tar or sqlite, 0.26 h.

## (c) Candidate faster paths, specified as phase-2 experiments

Savings are computed from (a) over this 20-day window. Every experiment runs only when the emulator and host are free,
and is serialised behind any other helper.

### E0: Measurement first (prerequisite, about 1 h)

- **Hypothesis:** we do not know which gradle tasks dominate a clean build, or which jest suites dominate on a quiet host.
- **Commands:**
  - Gradle, on a scratch worktree with the current native config:
    ```
    cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --profile --console=plain
    ```
    Run it once after `prebuild --clean` and once immediately after, to get clean and incremental figures. Read
    `android/build/reports/profile/*.html`.
  - Jest, at a 1-min load average under 4:
    ```
    npx jest --silent --json --outputFile=artifacts/PROCESS-SPEED/out/jest-quiet.json
    ```
    Then once more with `--maxWorkers=4`.
- **Expected saving:** none directly; it sizes E1–E3 and E8.
- **Quality guard:** none needed, because nothing ships.
- **Reject:** not applicable.

### E1: Incremental gradle for test APKs when the native fingerprint is unchanged

- **Hypothesis:** `prebuild --clean` makes every test build clean (about 618 tasks, median 4.5 min). An incremental build
  of the same tree (about 27 tasks, median 1.1 min) produces the same native libraries, dex and resources.
- **Commands:**
  1. Record the native fingerprint:
     ```
     npx @expo/fingerprint . > fp.json
     ```
     `@expo/fingerprint` 0.20.11 is in `node_modules` and provides the `fingerprint` binary. Also hash `app.json`/`app.config.*`, `plugins/`,
     `modules/*/android`, `patches/`, `package-lock.json`, and the `EXPO_PUBLIC_*` variables that config plugins read.
  2. If the fingerprint equals the one stored with the last prebuild, skip prebuild and run:
     ```
     ./gradlew :app:createBundleReleaseJsAndAssets --rerun :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
     ```
     Otherwise run the full clean recipe.
  3. The proof build, on one commit: build A with the clean recipe and build B incrementally after a JS-only edit is
     reverted. Then compare:
     ```
     unzip -l; unzip -p <apk> <entry> | shasum
     ```
     Compare every entry except `META-INF/*`, and `apksigner verify --print-certs` for both.
- **Expected saving:** 3.56 h actual clean test-build total − 31 × 1.1 min incremental median ≈ **3.0 h** of serial
  build wait per window. Under load the saving is larger, because clean builds reached 12–35 min. (Corrected
  2026-10-07: the formula was written as 31 × (4.5 − 1.1 min), which is 1.8 h, not 3.0 h. Phase 2 then measured
  −510 s per build × 31 = 4.4 h; see `speed-experiments-2026-10-07.md` E3.)
- **Quality guard:**
  - all `lib/arm64-v8a/*.so`, `classes*.dex` and `resources.arsc` entries are byte-identical between A and B;
  - `assets/index.android.bundle` is byte-identical when the JS is the same;
  - the signing certificate is identical (upload key);
  - the bundle proof (TestIds present, owner ids absent, UTF-16) passes.
- **Risk:** stale native output when the fingerprint misses an input, such as an env var read by a config plugin.
- **Reject if:** any non-META entry differs and the difference cannot be explained by a known non-determinism such as a
  build-id. A difference in `.so` content is a hard reject.

### E2: arm64-v8a only for emulator and phone test APKs

- **Hypothesis:** x86_64 in the October template (`arm64-v8a,x86_64`) doubles native compile and is never executed,
  because both AVDs are arm64-v8a and the owner's phone is arm64.
- **Commands:** in the test-APK template (`scripts/art/halloween-plus/build-test-apk.sh` and its copies), set
  `-PreactNativeArchitectures=arm64-v8a`. Then run:
  ```
  unzip -l test-ads.apk | grep lib/
  ```
  Install on emulator-5556 and the owner's phone.
- **Expected saving:** 7 builds × about 4 min (7.7 against a 3.5 min median) ≈ **0.5 h** per window. This is subsumed by
  E1 when a build is incremental, and still about 4 min per clean build.
- **Quality guard:**
  - the APK launches and the fixed capture script below matches pixel for pixel;
  - **release AABs keep `armeabi-v7a,arm64-v8a`**.
- **Risk:** a tester device that needs x86_64. None exists.
- **Reject if:** any device in use reports an ABI other than arm64-v8a.

### E3: Gradle daemon and build cache (configuration cache only if compatible)

- **Hypothesis:** `--no-daemon` plus per-invocation jvmargs forks a cold JVM and re-configures about 640 tasks on every
  build. A warm daemon and the local build cache cut incremental builds and make post-`--clean` builds partly
  `FROM-CACHE`. Kotlin, Java and dex tasks are cacheable; CMake tasks are not.
- **Commands:**
  - Put `org.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=1g` and `org.gradle.caching=true` in `~/.gradle/gradle.properties`.
    This is user-level and outside the repo. Ask the owner first, because it is persistent config.
  - Build with `./gradlew … --build-cache` (no `--no-daemon`), and run `./gradlew --stop` at the end of each task.
  - Try `--configuration-cache` separately. Expect RN/Expo plugin incompatibilities; record them and drop it if any.
  - Measure 3 incremental builds with E0's `--profile` in each arm, A/B/A.
- **Expected saving:**
  - incremental: about 15–30 s each × 175 ≈ **0.7–1.5 h**;
  - clean: maybe 1–2 min each × 37 ≈ **0.6–1.2 h** [inferred; E0 sizes it].
- **Quality guard:** the same byte-identity check as E1 between a cached build and a `--no-build-cache --rerun-tasks`
  build of the same tree.
- **Risk:**
  - daemon RAM (3 GB) on a host already in swap, which could worsen emulator perf runs;
  - `~/.gradle/caches` has vanished twice, so a cache cannot be assumed.
- **Reject if:** any entry differs, or the emulator null-spread worsens while a daemon is idle. If kept, stop the daemon
  before perf runs.

### E4: Prefer upload-signed incremental gradle over JS repack, and keep repack only as a disk fallback

- **Hypothesis:** the JS repack (`export:embed` + `hermesc` + zip + sign) has accumulated many gotchas:
  - fonts lost through the symlinked `node_modules`;
  - no way to add resources;
  - debug key against upload key (W3-21);
  - asset re-pointing.

  Repack scripts were copied through four generations (`repack.sh` → `repack502` → `repack514` → `repack704`).
  Incremental gradle with the release signing takes about 40 s (W3-21) to 66 s (median) and has none of these risks.
- **Commands:** on one commit and flag set, time both paths 3 times each (A/B/A):
  - `repack704.sh`-style, signed with the upload keystore from the gitignored `credentials/`;
  - E1's incremental gradle.

  Compare the `assets/index.android.bundle` sha256. Both must use `--reset-cache` and the same flags file.
- **Expected saving:** wall time is roughly neutral. The value is removing a class of re-runs: the font fallback and
  missing-resource incidents in P-02, W4-06 and W5-14. Repack calls cost 1.3 h in agent time.
- **Quality guard:** **the bundle sha is byte-identical** between the repack and gradle outputs. Memory notes a known
  HBC source-hash/footer difference; that difference must be exactly the known one, or else the gradle path wins.
- **Reject (repack, not the experiment) if:** incremental gradle is within 30 s of repack. In that case repack is retired
  to a disk-emergency fallback.

### E5: Emulator snapshots for state reset

- **Hypothesis:** quick-boot snapshots of a known state (app installed, seeded save, theme, motion scales) replace the
  pm clear, sqlite seed and restore steps. They may also reset the emulator's swap-bound slow mode.
- **Commands:**
  ```
  adb -s emulator-5556 emu avd snapshot save arrows-base-<sha>
  …
  adb -s emulator-5556 emu avd snapshot load arrows-base-<sha>
  ```
  Time 5 save/load cycles against the current tar/sqlite restore, and record `uptime` and emulator RSS. The current boot
  uses `-no-snapshot-load`.
- **Expected saving:**
  - restore steps measured at 0.26 h, so the direct saving is about **0.2 h**;
  - the real upside is cutting slow-mode reruns and installs (2.9 h, p90 193 s), when a snapshot already holds the base
    APK. That part is [inferred].
- **Quality guard:**
  - a fixed capture script (seed level, theme, screenshot) is pixel-identical after a snapshot load and after a fresh
    install plus seed;
  - the perf A/A null-spread on a snapshot-loaded emulator is not wider than on a cold-booted one, with the same
    protocol and n.
- **Risk:**
  - snapshot images use disk (several GB at 97 % disk use);
  - the snapshot can carry stale app state.
- **Reject if:** pixels differ, the null-spread widens, or free disk drops below 5 GB.

### E6: One reusable capture harness

- **Hypothesis:** one maintained harness removes per-task script authoring and debugging. The harness covers seed level,
  set theme or skin, set motion scales, cold start, wait on a log line, screenshot or record, and restore. Today there
  are 384 script-writing calls in 42 agents, 489 scripts, and about 15 memory files of capture gotchas.
- **Commands:**
  - Extend `scripts/perf/android/capture.mjs`, which already exists and is tested, with `--seed-level`, `--theme`,
    `--skin` and `--restore`, and with state-based waits.
  - Re-shoot 3 historical captures (one W3-08 legibility, one W5 art and one skin capture) through it, and compare with
    the archived PNGs.
- **Expected saving:** about 1.1 h of generation, plus an estimated 2–4 h of script debugging and re-runs per window
  [inferred from the gotcha count].
- **Quality guard:** pixel-diff of the re-shot captures against the archived ones (`pixel-diff.mjs`), with 0 changed
  pixels outside dynamic regions such as the clock. Any difference must be explained by a code change.
- **Risk:** a harness that silently does less than a bespoke script.
- **Reject if:** any of the 3 re-shoots cannot match its archived capture.

### E7: Index or split the lessons file

- **Hypothesis (from the brief):** helpers waste time reading an 85 KB file.
- **Measured:** only 15 of 92 agents read it, always with grep or sed, about 93k tokens in total across all agents
  (< 0.3 h).
- **Recommendation:** **do not split**. Optionally add a 29-line heading index at the top, which is already nearly the
  `##` list.
- **Expected saving:** under 0.3 h.
- **Guard:** none.
- **Reject:** not worth an experiment.

### E8: Jest under load

- **Hypothesis:** 7 workers on an 8-core host shared with gradle, the emulator and other sessions thrash. The full
  suite goes from 55 s quiet to 219–777 s loaded.
- **Commands:**
  - E0 quiet baseline, then `--maxWorkers=3` and `=50%` under a controlled load: a concurrent incremental gradle build.
    Run 3 each, interleaved.
  - Separately, ts-jest with `isolatedModules: true` for the `core` project. Types stay covered by
    `tsc --noEmit --incremental`.
  - During iteration, `jest --findRelatedTests <files>`; one full suite at handoff. CLAUDE.md §9 already says this.
- **Expected saving:** if loaded full runs drop from a median of about 258 s to about 120 s, the saving is about
  **1.5–3 h** of 7.1 h [inferred; E0 sizes it].
- **Quality guard:** an identical list of executed test files and an identical pass/fail set (test count equal, e.g.
  2269/2269), and `tsc --noEmit` still green.
- **Risk:** isolatedModules hides a type error that only ts-jest caught. tsc covers the same `src/**`.
- **Reject if:** the counts differ, or tsc misses an error that ts-jest flagged (seed one deliberate type error as a
  positive control).

### E9: Load gate, serialising heavy work against other sessions

- **Hypothesis:** perf runs and installs fail or get discarded when other sessions load the host (load 5–38). A gate
  before each series, build or perf run avoids discarded runs. The gate waits, in the background, until the 1-min load
  is below a threshold and no other gradle or emulator-heavy job is running, then records the load in the run log as
  W2-04 already does.
- **Commands:** `scripts/perf/android/load-gate.sh <maxLoad> <timeout>`, using `sysctl vm.loadavg`, a `pgrep` for
  GradleWrapperMain and qemu jobs that excludes our own PID, and a sentinel file. Replay it over the logged load
  averages of past series to pick the threshold.
- **Expected saving:** the discarded or rerun share of the 23.5 h perf waits. The reports document at least POLISH-T11's
  discarded arm and W2-07's 2 re-runs; a plausible 10–20 % is **2–5 h** [inferred].
- **Quality guard:** the perf protocol is unchanged, and the null-spread with the gate is not wider than without it.
- **Risk:** waiting forever when another session never quiets.
- **Reject if:** gate waits exceed the reruns they save over 2 weeks. The timeout must then report, not block.

### E10: Perf series with a pre-registered early-stop rule (offline replay first)

- **Hypothesis:** a sequential rule decides most A/B/A series before all blocks run. Example: after k ≥ 3 blocks, stop if
  the permutation-test p for the A–B shift falls below 0.01, or if the B–A difference CI is inside ±δ with δ =
  null-spread. The rule must reach the same accept/reject verdict as the full series.
- **Commands:** no device needed.
  1. Collect every archived series (W2-04 `perf/soak-*.json`; POLISH-T11, T12 and T10 pace/chain outputs; W4-09
     `perf-abab`).
  2. Write `scripts/process/replay_sequential.py`, which replays blocks in recorded order and applies the rule.
  3. Report agreement and blocks saved. Add a simulation over the measured null distributions for the false
     accept/reject rate.
- **Expected saving:** if the median stop is at 3 of 5 blocks, **about 30–40 % of 23.5 h ≈ 7–9 h** per window. This is
  the largest attackable item [inferred until replayed].
- **Quality guard:**
  - 100 % verdict agreement with the full series on every archived series;
  - a simulated false-decision rate ≤ the full protocol's;
  - the rule pre-registered in the task brief before data.
- **Risk:** optional stopping inflates error unless the rule is designed for it. Memory already records that a
  range-inside-range gate was invalid.
- **Reject if:** any archived series flips verdict, or the simulation shows a higher error rate.

### E11: Cache one test-ads base APK per (commit, flag set, native fingerprint)

- **Hypothesis:** tasks often rebuild an APK identical to one that already exists. W3-21 found a gradle output
  byte-identical to `arrows-testads-T12.apk`.
- **Commands:**
  - Store under `artifacts/apk-cache/<sha>-<flagsHash>-<fp>.apk` with the env and proof files.
  - The build script checks the key first.
  - Measure the hit rate over the next 2 weeks by logging misses and hits.
- **Expected saving:** hit rate × (1.1–4.5 min) per build [unmeasured].
- **Quality guard:** the key includes every `EXPO_PUBLIC_*` value and the fingerprint; the bundle proof runs on every
  reuse; the installed `base.apk` sha is checked against the cache file (W3-21's `install.sh` already does this).
- **Risk:** disk at 97 % (43 MB per APK).
- **Reject if:** a hit is ever served for a key whose inputs differ, which a teeth test with one flag flipped must catch.

### E12: Parallel helpers in worktrees for device-free work

- **Hypothesis:** helpers ran serially: 67 h with one helper and 16 h with two. Device-free work can run alongside the
  single device-owning helper. That includes JS/unit work, analysis, docs and art generation; RE-CEILING alone was 5.4 h
  of mostly CPU work.
- **Commands:** the coordinator assigns the emulator token to one helper. Other helpers use `isolation: worktree`, may
  not touch adb, and run jest with `--maxWorkers=2` (E8).
- **Expected saving:** calendar, not agent-hours. Up to the device-free share of active time, which is roughly 101 h −
  (23.5 + 8.4 + 6.3) ≈ 63 h of overlappable work [inferred].
- **Quality guard:** each worktree's result passes the same review, full suite and device evidence before merge. Only one
  agent owns emulator-5556; W2-09's collision shows why.
- **Risk:** CPU contention raises perf noise. Combine with E9, so perf series run only when no worktree is running jest
  or builds.
- **Reject if:** the null-spread or install times worsen measurably while parallel helpers run.

### E13: Background waits instead of capped foreground loops

- **Hypothesis:** 605 foreground wait loops, 142 of them capped, each re-issue costing a turn at about 280k context.
  Background waits on a PID or sentinel save turns and tokens. They do not save wall-clock: the wait is the same.
- **Commands:** brief rule: `run_in_background` with
  ```
  until [ -f DONE ] || [ -f FAILED ] || ! kill -0 $PID; do sleep 5; done
  ```
  Never `pgrep -f name`; on 09-29, 7 orphaned loops ran for about 42 h because of it.
- **Expected saving:** about 142 × 10.7 s ≈ **0.4 h** of model time, plus fewer orphan loops loading the host.
- **Guard:** none on quality.
- **Reject:** not applicable; this is hygiene.

### Considered and not proposed

Lowering helper effort or model for mechanical steps would reduce the largest bucket, model time at 34 %. It is not
proposed, because review quality is the product, and no cheap test shows that a lower effort keeps verdicts unchanged.
If it is ever tried, the guard is a blind re-review of 10 past tasks with identical verdicts.

## (d) What not to change, because it protects quality

- **Release and Play AABs keep the full clean recipe:** `prebuild --clean`, `armeabi-v7a,arm64-v8a`, upload signing, and
  the version-code and sha checks (ART-SKINS-08 `build-aab*.sh`). That is 1.03 h for 6 builds.
- **Bundle proofs stay on every installed build:** TestIds present and owner ids absent, in UTF-8 and UTF-16LE; Hermes;
  not profileable; no diagnostic classes.
- **The perf protocol stays as is**, unless E10 passes its replay. That covers the A/B/A order, the null (A/A) arm,
  pre-registration and the soak length. The null arm is what makes the gate honest (memory: range-inside-range invalid).
- **Pixel, contrast and fit gates stay**, with skin fit, centreline and one-cell checks (`docs/skins/README.md`).
  Positive controls stay for every detector (memory: W6-07 blind detector).
- **Owner screenshot or recording acceptance stays** for every visual or feel change. This accounts for much of the
  calendar idle time, and it is inherent.
- **Device evidence stays** for layout, measurement and event-path edits (CLAUDE.md §6, geoguesser lesson).
- **The full jest suite and tsc run once at handoff**, even if E8 trims runs during iteration.
- **The disk gate (≥ 5 GB, ideally 7 GB) and the one-gradle-at-a-time guard stay** in the build scripts.

## (e) Proposed phase-2 order (saving per hour of effort)

| Rank | Experiment | Effort | Expected saving per 20-day window | Device needed |
|---|---|---|---|---|
| 1 | **E2** arm64-only test APKs | 0.25 h | 0.5 h (about 4 min per clean build) | 1 install check |
| 2 | **E10** offline replay of an early-stop rule | 3 h | 7–9 h if it passes (largest) | no |
| 3 | **E1** fingerprint-gated incremental test builds | 2–3 h (one clean and one incremental build, plus a diff script) | 3.0 h, more under load | 1 build pair |
| 4 | **E13** background waits as a brief rule | 0.25 h | 0.4 h model time, plus no orphan loops | no |
| 5 | **E9** load gate | 1.5 h | 2–5 h of avoided reruns | no (replay on logged load) |
| 6 | **E8** jest workers and isolatedModules (after E0) | 1.5 h | 1.5–3 h | no |
| 7 | **E0** gradle `--profile` and quiet jest JSON | 1 h | enables E1, E3, E8 sizing | 1 build pair |
| 8 | **E3** daemon and build cache | 2 h | 1.3–2.7 h | builds only |
| 9 | **E12** parallel device-free helpers | 1 h of coordinator rules | calendar time, large | no |
| 10 | **E6** shared capture harness | 6–8 h | 3–5 h, plus fewer gotchas | yes (3 re-shoots) |
| 11 | **E4** repack against incremental gradle | 1.5 h | about 0 h wall, removes a risk class | 1 build pair |
| 12 | **E11** APK cache | 2 h | unknown until the hit rate is logged | no |
| 13 | **E5** emulator snapshots | 2 h | 0.2 h, more if it cures slow mode | yes |
| — | **E7** split lessons file | — | under 0.3 h, so skip | — |

E0 is listed 7th by its own value, but it should run **first** whenever a build slot is free, because it sizes E1, E3
and E8.

The calendar finding (80 % of the window with nothing running) is outside these experiments. Owner-independent tasks
queued ahead of owner reviews (E12) are the only lever on it that this audit found.

## Surprises in the data

- The brief's main hypotheses about builds were mostly already handled in September. Test builds were incremental and
  arm64-only, at 1.1 min median.
- **The October test-APK template regressed** to `prebuild --clean` plus `arm64-v8a,x86_64`. That covers LOG-GATE,
  PETAL-ADS-01, REWARD-01, BOOK-01, HALLOWEEN-01/01b and the HALLOWEEN-PLUS template. These builds took 5.7–35 min
  against about 1 min, and x86_64 never runs on our arm64 AVDs.
- The 57 h of "dormant" agent time is agents parked between turns, waiting for the coordinator or for late
  background-task wakes. One agent, PANEL-STUCK, was woken 41 h later. This is not work, but it inflates naive per-agent
  wall-clock by 57 %.
- Model latency tracks output tokens (about 11 s per 1k) and not context size. Long contexts are therefore not what
  makes turns slow.

## Process-metrics ledger (owner rule 2026-10-07)

`agent_time_audit.py` also appends one JSON line per helper to `~/.claude/process-metrics/arrows-game.jsonl`. Each line
has these fields:
- `task_id`, `date`, `purpose`;
- `wall_min`, `active_min`, `tool_calls`;
- `tokens` (output tokens) and `tokens_detail`;
- `cat_min`, with the keys builds, prebuild, jest, tsc, adb_capture, adb_install, emulator_boot, waits,
  analysis_scripts, image_work, git, other, model and dormant. They sum to `wall_min`;
- `builds_n`, `timeouts_n`, `retries_n` (identical non-wait commands repeated), `big_reads_n`;
- `outcome`: set only when the coordinator's follow-up text makes it obvious.

The run of 2026-10-07 appended 89 agents. 4 still-running or very recent agents were skipped. A second run appended
0 lines, which verifies that it is idempotent.

**To append new agents later** (any session), run:
```
python3 scripts/process/agent_time_audit.py \
  ~/.claude/projects/-Users-gentlegen-Desktop-Projects-arrows-game/<session-id>/subagents artifacts/PROCESS-SPEED/out
```
Options:
- `--metrics <path>` sets the ledger path;
- `--min-idle-min 30` sets how long an agent must be idle before it counts as finished;
- `--no-metrics` skips the ledger.

Existing task_ids are skipped, and existing lines are never rewritten.

## Proposed lesson (not written to `docs/engineering-lessons.md` in this phase-1 task)

> **A test-APK template must not silently become the release recipe.** In October, `prebuild --clean` and an x86_64 ABI
> were copied from template to template. Our AVDs are arm64-v8a, so every test build paid 5.7–35 min instead of about
> 1 min. Build scripts should state why each flag is there, and test templates should fingerprint native inputs before
> cleaning. Evidence: this report, §(a) Builds.
