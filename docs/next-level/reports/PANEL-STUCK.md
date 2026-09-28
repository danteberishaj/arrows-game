# PANEL-STUCK report: the win / lose panel always ends exactly at rest

- **Status:** DONE_WITH_CONCERNS (concerns at the end).
- **Branch / base:** `next-level`, BASE = `c670f1b`. No commits: the controller owns git. Patch series (applies in order
  to `c670f1b`, reproduces the working tree byte for byte): `artifacts/PANEL-STUCK/snapshot/000{1,2,3}-*.patch`
  (1 = this task, 2 = A11Y-LABELS, 3 = FINAL-FIX device checks).
- **Device:** `emulator-5556` (`fleet_floor_api31`, API 31, 1440x3120 @560), scales 1/1/1 unless stated. JS repack builds
  only (`artifacts/PANEL-STUCK/scripts/repackps.sh` = W5-19's `repack519.sh` + a `REV` switch; host
  `artifacts/W2-06/apk/w206-on.apk`, no gradle). Every APK's bundle proof: TestIds present, the owner's units absent in
  ASCII and UTF-16LE (`artifacts/PANEL-STUCK/apk/*.proof.txt`). No ad was tapped (`aclk` 0 in every manifest).
- **Evidence root:** `artifacts/PANEL-STUCK/` (gitignored).

## The anomaly (W5-19)

One lose panel of 17 captures was frozen at 277.7 x 243.4 dp (rest 280 x 245.7) with the scrim and the panel
translucent, at least 13.7 s after the loss (`artifacts/W5-19/gates/anomaly-lose-panel-not-at-rest.txt`). W2-05's latch
promises a deterministic settle (animation callback OR a JS backstop timer at ms + 70 OR AppState 'active'), after which
the overlay swaps to static rest styles.

## Root cause (proven on the device)

Reanimated 4.5.1 is built with `FORCE_REACT_RENDER_FOR_SETTLED_ANIMATIONS: true`
(`node_modules/react-native-reanimated/src/featureFlags/staticFlags.json`). Then:

1. Every UI-thread prop write for a view is kept in the C++ `AnimatedPropsRegistry` with a timestamp
   (`Common/cpp/reanimated/Fabric/updates/AnimatedPropsRegistry.cpp`).
2. Every 500 ms (a JS `setInterval`), `PropsRegistryGarbageCollector.syncPropsBackToReact` takes the entries 1-2 s old
   and calls the view's `AnimatedComponent._syncStylePropsBackToReact`, which **stores them in React state
   (`settledProps`)** (`src/PropsRegistryGarbageCollector.ts`, `src/createAnimatedComponent/AnimatedComponent.tsx:217-224`;
   the source says "TODO(future): revert changes when animated styles are detached"). Entries older than 2 s are
   **erased before** the 1-2 s ones are returned (`getUpdatesOlderThanTimestamp` → `removeUpdatesOlderThanTimestamp`).
3. `AnimatedComponent.render()` renders `style: [...yourStyles, this.state.settledProps]` (`AnimatedComponent.tsx:538-545`):
   **the synced-back props come after, and beat, any static style we pass.**
4. W2-05's `PanelOverlayFrame` rendered `animating ? panelAnimated : PANEL_REST` (same for the scrim). When the
   **backstop timer** or **AppState** settles a leg while the animation is still mid-way, `settle()` snaps the value to 1
   (queued for the UI thread) and publishes `shown`; React commits the static style and `componentDidUpdate` detaches the
   animated style **before the snap's write reaches the view**. The registry keeps the last mid-leg frame, the collector
   copies it into `settledProps`, and it overrides `PANEL_REST` for as long as the panel stays mounted (the shared value
   itself is 1).

W5-19's 277.7 dp is scale 0.9918 → presence 0.86 (ease-out cubic ≈ 126 ms into the 260 ms leg): the 330 ms backstop fired
while the UI thread had drawn only about half the leg (host load ~10 on 8 cores then, from the capture manifest).

### Reproduction and trace (EXECUTED)

Diagnostic builds (overlays in `artifacts/PANEL-STUCK/overlay-diag*/`, never committed): `EXPO_PUBLIC_PANEL_PROBE_MARGIN_MS=-150`
moves the backstop to mid-leg (loss 110 ms, win 30 ms) so the timer always settles first; `[panel-stuck]` logs trace the
settle source, every UI value change, the snap, the frame's state, every collector sync-back for the panel / scrim view
tags, AppState changes, and 3 s after `shown` (and after every return to the foreground) the JS value and the views'
React `settledProps` (read from `PropsRegistryGarbageCollector.viewsMap`). Harness `scripts/loopps.mjs`: the W5-02 plan-L52
board (LEVEL 53, 66 arrows, seeded as in W5-19); lost = three blocked taps → lose panel → rest check ≥ 3.5 s later →
Retry; won = seed + cold start + full solve → win panel → rest check. **Rest check:** the panel container (parent of the
title) exactly 980 px wide (280 dp) AND four fill pixels inside it exactly the opaque rest fill `#EFEDF8` (239,237,248)
on the screencap PNG; a win whose panel never becomes visible within 25 s counts as NOT at rest.

One BASE trace (`repro/forced-lost-records.jsonl` #1, ms from the leg start):

```
+2    leg entering ms=260 backstop=110
+30   frame-render state=entering scrimTag=292 panelTag=330
+66 .. +131  ui-value 0.3943, 0.6300, 0.7205, 0.7949, 0.8548
+131  settle via=timer from=entering
+132  snap 1
+134  frame-render state=shown            <- static rest style committed, animated style detached
+135  withTiming done finished=false      <- the snap's cancel reached the UI thread
+149  ui-value 1.0000                     <- the value IS 1 ...
+1218 gc-sync panel tag=330 {"transform":[{"scale":0.99129}],"opacity":0.85480}   <- ... the view's last write was 0.8548
+3148 rest-check presenceJS=1 panelSettled={"transform":[{"scale":0.99129}],"opacity":0.85480}
```

What did **not** cause it (same traces): the value was not left mid-way (`presenceJS=1` in every BASE run); no late
frame overwrote it (`finished=false` precedes the value 1); the FINAL-FIX 04 screen wrapper is not involved (the game
screen stays mounted); the review-prompt / post-clear timers do not touch the panel's views.

### A second failure, found by the loop, in my first fix (EXECUTED)

Round 1 kept the animated styles attached for good once the frame had animated. It passed the forced runs and 30 + 30
natural panels, then a **win panel came back invisible after the app was backgrounded ~1.2-1.8 s after the clear**
(`loops-round1/final-won-bg5-3-abort.png`: 0 left, no panel, uiautomator "Skipping invisible child" 980 x 1247; still
invisible minutes later). Diag trace (`repro2/diag-won-bg.console.txt`, 2 of 8 runs): the leg settled normally
(`via=callback`, value 1), the app went to the background **before the collector had synced** the final props, and on
return `settledProps` was `{}` and the panel was invisible. With the animated style attached, React's own props for the
view are the animated style's **first-render values** (opacity 0, scale 0.94, `PropsFilter._initialPropsMap`), and the
registry entry, 2 s old by the time the collector's JS interval ran again, was erased unsynced (point 2 above); the
panel showed those React props. Which native step re-applied React's props on the return was not identified (INFERRED
from the invisible panel + `settledProps {}`; the fix below does not depend on it). In the 6 visible runs the background came after the collector's sync (`settledProps` =
`{opacity: 1, scale: 1}`). BASE is not exposed to this (its React props at rest are the static rest style): INFERRED
from the model test below (BASE passes those cases); not run on the device.

So a panel at rest needs **both** the React props and the last UI write to be the rest values.

## Fix (`src/ui/PanelPresence.tsx`)

- While a leg runs, **and after it settles until the UI thread has drawn two frames past the settle**, the animated
  styles stay attached, so the latch's snap is written to the views and the last write (and any `settledProps`) is the
  rest value, whichever path settled the leg.
- Then the static rest styles replace them, so React's own props are the rest values too.
- The confirmation is a worklet (`scheduleOnUI` → two UI `requestAnimationFrame`s → `scheduleOnRN`), not a JS timer, so
  it cannot overtake the snap under load; in the background it arrives on return. It is per leg (a turned-around exit
  starts a new one).
- A frame that never animated (reduce motion = 0 ms, or a leg that settled before the overlay mounted) has the static
  rest styles from its first frame. The element tree never changes, so the panel subtree (stars, buttons) never remounts.
- `src/ui/overlayPresence.ts`: header comment corrected (no logic change). No flag change (still `META_PANEL_MOTION`).

"Swap the animated wrapper for a plain view" was not used: it changes the element type and remounts the panel subtree
(stars mid-spring). A grep of every `useAnimatedStyle` user in `src/ui` (EXECUTED) found no other view that swaps an
animated style for a static one.

## TDD (EXECUTED)

`src/ui/__tests__/PanelPresence.settle.test.tsx` replaces Reanimated with a model of the 4.5.1 rules above (each cited in
the file): attach / detach at commit, forced write on attach, first-render initial props, JS writes and worklets queued
for the UI thread, UI `requestAnimationFrame`, mappers write only to attached views, the collector copies the registry
into `settledProps`, render puts `settledProps` last. The commit-before-UI ordering is the device trace's. 9 cases.

- **RED vs BASE** (`tdd/red.txt`): 5 failed / 4 passed: the backstop (lose, win), AppState and exit-turnaround cases end
  at panel scale 0.991288 (= 0.94 + 0.06 × 0.8548, the device value); "attached until the UI confirms" fails.
- **RED vs the round-1 fix** (`tdd/red.txt`, `tdd/PanelPresence.round1-fix.tsx.txt`): 2 failed / 7 passed: "settled, then
  backgrounded before the collector syncs" (lose, win) — the React props are opacity 0 / scale 0.94.
- **GREEN** (`tdd/green.txt`): 9 / 9. **Mutant** (confirm synchronously, no UI frames): 5 failed — the confirmation must
  wait for the UI thread. (Round 1's own RED / GREEN: `tdd/*-round1.txt`.)
- `overlayPresence.test.ts` and `GameScreen.panelMotion.test.tsx` pass unchanged.

## Device results (EXECUTED)

Forced mid-leg backstop (diag builds, every leg below logged `settle via=timer`):

| build | lose at rest | win at rest | settledProps after the settle |
|---|---|---|---|
| BASE `c670f1b` diag (`b454bff1…`) | **0 / 10** (968-972 px) | **0 / 2** (946-954 px) | opacity 0.79-0.86 (lose), 0.41-0.55 (win) |
| round-1 fix diag (`f217ac55…`) | 10 / 10 | 3 / 3 | `{opacity 1, scale 1}` |
| final fix diag (`2dd0acb4…`) | **10 / 10** | **3 / 3** | `{opacity 1, scale 1}` |

Background shortly after a win's settle (`--vary bg`, HOME 1.2-2.0 s after the last tap, relaunch 1.5 s later):

| build | win panels at rest | runs where the collector had not synced before the background (`settledProps {}`) |
|---|---|---|
| round-1 fix diag (`e2829bcf…`) | **6 / 8** | 2 — both invisible |
| final fix diag (`9b6d5857…`) | **10 / 10** | 1 (#2) — at rest (static React props) |

Kept frames: `repro/forced-lost-1.png`, `repro/forced-base-won-1.png` (stuck), `repro2/diag-won-bg-1.png`, `repro2/diag-won-bg-6-nopanel.png`
(invisible). The diag APKs were deleted after use (≤ 2 APKs); their `.env` / `.proof` files are kept.

**Acceptance on the final build** `artifacts/PANEL-STUCK/apk/ps-final-on.apk` `7dbcf06a…` (bundle `e470ea37…`) = the working
tree (this task + A11Y-LABELS) with W5-19's ON flag set (`artifacts/W5-19/scripts/flags-on.txt`) and W5-19's overlay-A `theme.ts` (the panel
fill the anomaly was captured with). No diagnostics in this build: pixels and bounds only.

| run (`artifacts/PANEL-STUCK/loops/`) | panels | at rest |
|---|---|---|
| `final-lost30` — 30 consecutive losses, one cold start, Retry between | 30 | **30 / 30** |
| `final-won30` — 30 consecutive wins, each a cold start + full solve | 30 | **30 / 30** |
| `final-won-bg10` — HOME 1.2-1.8 s after the last tap (right after the win settle), back 1.5 s later | 10 | **10 / 10** |
| `final-lost-bg10` — HOME 0.44-0.83 s after the third blocked tap (around the 690 ms panel delay + 260 ms leg) | 10 | **10 / 10** |
| `final-lost-jitter10` — 0-900 ms random pause before the third blocked tap | 10 | **10 / 10** |
| `final-lost-rm5` — animation scales 0 (the app read reduce motion: `perf-reduced-motion-1`) | 5 | **5 / 5** |
| `final-lost-noad5` — wifi and data off (read back 0/0, restored 1/1): no rewarded ad, "No ad available right now — Retry is free" | 5 | **5 / 5** (see note) |

Note on `noad5`: the harness printed NOT-AT-REST because its width rule is 980 px; with the no-ad subtitle the panel's
layout is wider (`minWidth: 280`): 1124 x 860 px in all 5, and all 4 fill probes exactly the opaque rest fill in all 5;
the screencap (`loops/final-lost-noad5-1.png`) shows an opaque panel over an opaque scrim. I count them at rest on that
evidence (the width rule is a proxy for scale 1 on the 980-px layout, not a property of this one).

**115 / 115 panels at rest on the final build** (the 30 + 30 in a row included). The APK was deleted for the FINAL-FIX
builds (≤ 2 APKs) and rebuilt from the same tree: `d8277df3…`, **same bundle `e470ea37…`** (only the zip / signature
differ), installed, and smoke-checked: 3 / 3 lose panels at rest (`loops/installed-smoke-*`).

Panel sizes at rest: every lose panel 980 x 860 px (280 x 245.7 dp), every win panel 980 x 1247 px (280 x 356.3 dp), as
in W5-19's rest captures. The round-1 build's runs (superseded) are in `loops-round1/`.

## Evidence labels

- EXECUTED: everything in the two sections above, RED / GREEN / mutants, `npx jest` and `npx tsc --noEmit` (counts in the
  A11Y-LABELS gate section; same tree).
- INFERRED: that the W5-19 capture took the backstop path (no trace in that build; the value, the host load and the
  1-in-17 rate fit, and the forced runs produce exactly that state). That BASE is not exposed to the background case.
  Which settle path each non-diag acceptance run took (not logged in the final build).
- UNVERIFIED-DEVICE: iOS (same JS; not run).

## Decisions

1. The rest is reached by a value write while the animated style is attached, confirmed by the UI thread, and then held
   by React's static props. A React-only rest (static style only) cannot beat `settledProps` once the view animated, and
   an animated-only rest leaves React at the first-render values; both halves are needed.
2. The model test encodes Reanimated internals read from source; its ordering assumption is the device trace's. The
   device runs are the proof; the test guards the React side.
3. Diagnostics stayed in overlays under `artifacts/`; nothing diagnostic is in the patch.

## Concerns

1. **The review rule's prescribed remedy is not available as written.** "Swap to a plain view / static style at rest"
   is defeated by Reanimated's `settledProps` once the view has animated, and "keep it animated" loses React's props.
   Suggested memory line: *Reanimated 4.5 FORCE_REACT_RENDER_FOR_SETTLED_ANIMATIONS: the last UI write comes back into
   React state after your styles, and is dropped unsynced if the app is backgrounded in its 1-2 s window → a rest state
   must be both written on the UI thread while attached AND in React props → review with a forced mid-leg settle
   (probe build) AND a background right after the settle, on the device, never on web (W2-05 proved its backstop on
   web, where the collector does not run).* The same holds for any other visibility-critical `Animated.View`.
2. My first fix passed forced runs and 60 natural panels before the background variation caught it: the acceptance
   must include backgrounding around and right after the settle, not only during the leg.
3. Rare-timing rates below the sample sizes above are unmeasured; the forced runs are the proof for each mechanism.
