# FLAKY-TEST: `adsRewardedNativeEvent.test.ts` vs. Jest's fixed 5 s per-test watchdog

- **Base:** `e262be1` (RE-CEILING), branch `next-level`. HEAD did not move during the task.
- **Status:** DONE_WITH_CONCERNS. One concretely evidenced load-sensitive test is root-caused and fixed;
  the OTHER historical incident named in the brief (1 test failing in a full run at load ~23) could not be
  identified — no log from that run survived, and I did not reproduce it (the controller's binding
  correction below forbids generating artificial host load). That gap is disclosed, not papered over.
- **Controller correction received mid-task (binding):** do NOT generate artificial CPU load (no `yes`, no
  busy loops) — another agent was measuring frame times on the emulator at the time and extra host load
  would have corrupted its numbers. Instead: find load-sensitive tests by reading them (real timers,
  `await new Promise(r => setTimeout(r, N))`, `Date.now()`/`performance.now()` elapsed assertions,
  `waitFor` default timeouts, jest per-test timeouts), and by running the suites that use real timers
  repeatedly with `--maxWorkers=1` at normal load. This report follows that method throughout; nothing
  here used synthetic load.
- **No emulator, no native build, no git state change.** Node only.

## The two incidents in the brief

1. **2026-09-26, a full `npx jest` run failed exactly 1 test at host load average ~23; 4 later full runs
   passed** (`.superpowers/sdd/TASKS/progress.md` line 406: "full jest 1 failure once at load avg ~23, then
   4/4 full passes (1535)"). **Which test failed is not recorded** — I searched `artifacts/W5-03`,
   `artifacts/W2-07`, `artifacts/W5-06` (the tasks in flight at the time) for a preserved jest log; the only
   jest artifact from that window (`artifacts/W5-06/gates/jest-worktree-all.txt`) is one of the 4 *passing*
   re-runs (`1535 passed, 1535 total`), not the failing one. I could not name this test. See Concerns.
2. **RE-CEILING (2026-09-26), full run at host load average 45-97 (other sessions' emulators/builds):
   `adsRewardedNativeEvent.test.ts` had 2 of its 8 tests hit "Exceeded timeout of 5000 ms"; run alone right
   after, 8/8 passed** (`docs/next-level/reports/RE-CEILING.md` line 309, quoted verbatim: "`adsRewardedNativeEvent.test.ts`: 2 tests hit \"Exceeded timeout of 5000 ms\" at load average 97. Run
   alone right after: 8 / 8 passed. The file is unchanged since `c7e2d55`."). This one is fully named and is
   this report's fix.

## Reading pass: which tests are load-sensitive, and why this one is the named target

Searched every `.test.ts`/`.test.tsx` for the four risk patterns named in the brief:

| pattern | search | result |
|---|---|---|
| real-timer waits (`await new Promise(r => setTimeout(...))`) | `grep` across `src` | none found anywhere in the repo |
| elapsed-wall-time assertions (`Date.now()`/`performance.now()` diffed against a threshold) | `grep` across all test files | none — the few `Date.now()`/`performance.now()` hits are mock `now()` implementations for injected clocks (fake-timer-driven), not real elapsed-time assertions |
| `waitFor(` (testing-library default-timeout pattern) | `grep` across `src` | none — this repo does not use `@testing-library/react-native`'s `waitFor` |
| `jest.setTimeout(...)` / custom low per-test timeout | `grep` across `src` and jest config | none pre-existing; jest's global default (5000 ms) applies everywhere |
| real macrotask waits (`setImmediate`/`doNotFake`) with no fake-time assertions to weaken | `grep` for `doNotFake`/`setImmediate` | **7 files**, all `src/ui/__tests__/ads*.test.ts` (`adInit`, `adsBannerAndPrivacy`, `adsConsentWithdrawal`, `adsKillSwitch`, `adsRewardedNativeEvent`, `adsRewardedReadiness`, `adsTwoRewardedUnits`) |

All 7 "ads" suites share the same shape: `jest.useFakeTimers({ doNotFake: ['setImmediate'] })` (or an
equivalent real-`setImmediate` `flush()` helper) so that a mocked native module's real Promise chain can
resolve, while timed logic (retries, reload delays) stays on the fake clock via
`jest.advanceTimersByTime`. That's already the right pattern for *those* tests' own timing assertions
(nothing there reads real elapsed time). The differentiator for *this incident* is the module-load cost
underneath it, checked file by file:

- `adInit.test.ts` never touches `ads.tsx` or the real/fake SDK package at all — its subject
  (`createAdInitController`) takes an injected, fully synthetic fake-timer object; its own `flush()` wraps a
  tiny in-memory state machine. Excluded: no expensive `require`, low risk.
- `adsBannerAndPrivacy`, `adsConsentWithdrawal`, `adsKillSwitch`, `adsRewardedReadiness`,
  `adsTwoRewardedUnits` all `jest.mock('react-native-google-mobile-ads', () => mockGma.module())` — a
  **lightweight in-repo fake** (`./helpers/fakeGoogleMobileAds`). Their `require('../ads')` (fresh per test
  in some, isolated-per-boot in others) never pulls in the real vendor package, so it stays cheap.
- **`adsRewardedNativeEvent.test.ts` is the one exception, by design** (its own file doc, unchanged since
  before this task): "this suite keeps the package's real JS and replaces only what sits below JS on a
  device" — it mocks only the TurboModules and the native event bus, and requires the REAL
  `react-native-google-mobile-ads` package. `loadAds()` calls `jest.resetModules()` then
  `require('../ads')` fresh in every one of its 8 tests (needed for correctness: the file's own comment
  says the package's request ids and bus subscriptions would otherwise leak across tests).

This is why the timeout landed on this file specifically and not its siblings: it is the only ad suite
whose fresh `require` drags in the real vendor package's full module graph, an expensive, CPU-bound,
synchronous cost that no amount of fake-timer cleverness can shrink (V8 has to parse/compile/execute that
code regardless of the clock).

**Repeated runs at normal load, `--maxWorkers=1`, this file in isolation** (EXECUTED, 5 consecutive runs,
after the fix below was in place — see Fix; the per-test timings are unaffected by the fix since it only
raises the ceiling, so these numbers hold before and after):

| run | 1st async test (`stays not ready after init...`) | every later async test in the file |
|---|---|---|
| 1 | 148 ms | 21-42 ms |
| 2 | 132 ms | 21-35 ms |
| 3 | 130 ms | 24-44 ms |
| 4 | 126 ms | 23-49 ms |
| 5 | 129 ms | 21-37 ms |

All 8/8 passed every run (`Test Suites: 1 passed`, `Tests: 8 passed, 8 total`, each run). The **first**
async test pays the real one-time module-compile cost (V8 caches compiled bytecode across
`jest.resetModules()`, which only resets the module *registry*, not the compiled-code cache, so only the
first `require('../ads')` in a given worker process is expensive); every later test in the file reuses that
cache and is cheap. At normal load this leaves ~4.85 s of headroom under Jest's 5000 ms default even for
the expensive first test. RE-CEILING's host was at load average 45-97 — 6-12x this machine's `nproc` of 8 —
which is consistent with that headroom disappearing: OS scheduling delay for a CPU-bound synchronous
operation (module compilation) scales with how oversubscribed the run queue is, not with anything the test
itself controls.

## Root cause and why raising the timeout (not switching timer strategy) is the fix

The brief calls out three usual root causes — a real-timer wait, a too-small timeout, or an assertion on
elapsed wall time — and says to use fake timers or event-based waits, but allows raising a timeout when
it's explained why the new value is safe. This is squarely the **too-small-timeout** case, not the
real-timer-wait case that fake timers would fix:

- The file's async waiting is already event-based (`await new Promise(r => setImmediate(r))`, five times,
  waiting for actual promise/microtask settlement, not a fixed wall-clock duration) and its one genuinely
  timed behavior (the 15 s reload) is driven entirely by `jest.advanceTimersByTime` against Jest's fake
  clock, not real time. Converting the `setImmediate` flush to Jest's modern `advanceTimersByTimeAsync`
  would remove real macrotask scheduling from the picture, but would **not** remove the dominant real cost
  here, which is synchronous, CPU-bound module compilation on the very first `require('../ads')` — that
  work happens whether or not the surrounding waits are faked, so a fake-timer rewrite would not have
  prevented RE-CEILING's timeout and would touch 8 tests' timer setup for no gain.
- Jest's own per-test watchdog (`Exceeded timeout of 5000 ms`) is a real-wall-clock budget applied
  externally by the test runner, independent of how the test itself waits. Under a load-97 host, actual
  CPU time slices for this process were delayed enough to blow that budget even though the underlying work
  (module compile + 5 event-loop ticks) is bounded and small.
- **Raising the timeout cannot weaken any assertion**, because none of this file's 8 tests assert on
  elapsed time at all — every assertion is on a final logical value (`Ads.rewardedReady`, an array of
  request ids, a listener callback's recorded booleans). A real regression in `ads.tsx`'s logic would still
  produce a wrong final value and fail immediately, well inside any timeout value. The only thing a longer
  timeout buys is patience for legitimate host contention; it does not and cannot mask a functional bug.

## Fix (EXECUTED)

`src/ui/__tests__/adsRewardedNativeEvent.test.ts`: added `jest.setTimeout(20000);` near the top of the
file (applies to every test in it), with an in-file comment recording the measured normal-load costs above,
the RE-CEILING citation, and the reasoning that no assertion here depends on wall time. 20 s is roughly
100x this file's normal per-test cost (never observed over 148 ms at normal load) and comfortably above the
demonstrated load-97 shortfall (5000 ms was insufficient there), while staying bounded: a genuine hang in
`ads.tsx` still fails, just with headroom for host contention instead of Jest's un-contended-host default.

`ads.tsx` itself (forbidden file — another agent owns it) was not touched, and did not need to be: this is
purely a test-harness timing budget, not a behavior change.

## TDD

This is a timing/robustness fix, not new logic — there is no new assertion whose RED state to show (the
file's 8 tests were already correct and already passing at normal load before this change; the bug only
manifests under host contention this environment cannot safely reproduce per the controller's correction).
Per the brief and GLOBAL.md, the applicable evidence standard here is repeated-pass stability, not a
RED/GREEN pair:

- **Before the fix, at normal load:** 8/8 passed reliably (not flaky here — the failure needs host
  contention this session was told not to create). No RED to show at normal load, honestly, because the
  defect only manifests under conditions I'm not permitted to reproduce directly.
- **After the fix:** verified the change doesn't alter behavior (`jest.setTimeout` only raises a ceiling)
  and re-confirmed stability.

## Evidence

- **File-level, 5 consecutive runs, `--maxWorkers=1`, normal load** (EXECUTED): `npx jest src/ui/__tests__/adsRewardedNativeEvent.test.ts --maxWorkers=1 --verbose`, run 5 times back to back. Every run: `Test Suites: 1
  passed, 1 total`, `Tests: 8 passed, 8 total`. Per-test timings tabulated above.
- **Full-repo, 5 consecutive runs, normal load** (EXECUTED, background job, sequential `npx jest` x5 with
  `uptime` printed before each):

  | run | load average (1 min) | suites | tests | wall time |
  |---|---|---|---|---|
  | 1 | 3.53 | 107 passed / 107 | 1775 passed / 1775 | 44.1 s |
  | 2 | 8.74 | 107 passed / 107 | 1775 passed / 1775 | 41.4 s |
  | 3 | 10.64 | 107 passed / 107 | 1775 passed / 1775 | 47.4 s |
  | 4 | 12.88 | 107 passed / 107 | 1775 passed / 1775 | 41.9 s |
  | 5 | 12.30 | 107 passed / 107 | 1775 passed / 1775 | 49.6 s |

  This is the load range actually available in this session (normal, not synthetic — it drifted up on its
  own from other concurrent sessions/processes on the shared Mac, consistent with the project memory note
  on shared-host contention). It is far below RE-CEILING's 45-97, so it does not reproduce the original
  failure; it demonstrates the required ≥5 consecutive full passes post-fix without introducing artificial
  load, per the controller's correction.
- **Gates** (EXECUTED, after both this fix and V2-WIRE were in place): `npx tsc --noEmit` — exit 0. `npx
  jest` (full repo, one more run beyond the 5 above) — `107 suites / 1775 tests`, all passed.

## Concerns

1. **The 2026-09-26 "1 failure at load ~23" incident is not identified.** No surviving log names the
   failing test, and I did not attempt to reproduce it (forbidden: no artificial CPU load). It may or may
   not be `adsRewardedNativeEvent.test.ts` — that suite's own documented failure needed load ~97, four to
   five times higher, so a *different*, lighter-weight test is at least as plausible. I'm flagging this
   as an open gap rather than guessing at a second file to modify without evidence.
2. **The fix is scoped to the one file with named, reproducible evidence.** The other 6 ad suites share the
   `doNotFake: ['setImmediate']` pattern but use a lightweight in-repo SDK fake (cheap `require`), so their
   exposure to the same failure mode is much smaller (reasoned above, not independently load-tested, since
   that would need the forbidden artificial load). If a future full run times out in one of them, the same
   diagnostic method (compare "requires the real vendor package?" and "what's the real per-test cost at
   normal load?") applies directly.
3. **The fix could not be verified against the exact failure it targets** (host load ~45-97) without
   violating the controller's correction. The ≥5-consecutive-passes evidence above is at normal load only;
   it shows the fix is inert (no behavior change, no new flakiness introduced) but does not re-create the
   original timeout to prove the specific fix removes it. The reasoning for why it should (a real, fixed,
   external per-test budget vs. no wall-clock assertions to violate) is laid out above for the owner/
   reviewer to weigh; recommend a follow-up confirms this the next time the host is genuinely under heavy
   load from other legitimate work (not synthetic), by watching for the same "Exceeded timeout" message.
