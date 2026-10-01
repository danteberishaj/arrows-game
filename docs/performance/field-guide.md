<!-- Converted from field-guide.html (the original page, kept beside this file). Source: the owner's
"Arrows Performance Field Guide", 2026-09-01. Edit facts here and in engineering-lessons.md, not in the HTML. -->

Arrows Performance Field Guide    [Skip to content]

01 · Final engineering verdict

# The bottleneck was *ownership*, not React Native.

Dense missions were slow because hundreds of mostly-static arrows were represented and updated at the wrong layer. The winning design keeps game rules in TypeScript, gestures on the UI runtime, and gives the dense static field to one retained native view.

 **250** arrows tested **2,247** removals in final soak **20** missions, one process **Android API 31** · 60 Hz **Release** build

✓

 **Stay with the hybrid React Native architecture.**

The final native board renderer cleared every defined frame and memory gate. A Godot rewrite would replace the whole product stack to solve a hotspot that now sits only 1.66 ms above the measured empty-scene floor.

 Rules **TypeScript core**

Generation, collision, hints, saves, hearts, and mission state stay deterministic and testable.

 Interaction **UI runtime**

Pan and pinch transforms stay off the JS thread through Gesture Handler and Reanimated.

 Static field **Native board view**

One bounded view retains arrow geometry and draws two compound paths per frame.

 Transient art **Small Skia layer**

Only shake, hint, and at most two short exit animations remain dynamic.

 Feedback **Native pool**

Audio and haptic resources are loaded once, reused, and fired without Promise traffic.

02 · Comparable production evidence

## A measured breakthrough, not a hunch.

These three results share the same release protocol, API 31 host-GPU emulator, 60 Hz target, 20-level sequence, 2,247 arrow removals, enabled feedback, and single process.

 Active frame p95 11.45 ms ↓ 39.0% vs Skia

Gate: ≤ 20 ms

 Active frame p99 13.45 ms ↓ 38.0% vs Skia

Gate: ≤ 34 ms

 Janky frames 0.19% ↓ 97.5% vs Skia

Gate: ≤ 10%

 Tail memory growth 5.62 MB ↓ 46.2% vs Skia

Memory gate passed

RendererRelative p95Measured p95

**Skia survivor paths**Production source baseline · memory fail

18.781 ms

**Cached native paths**Parsing/retention experiment · memory pass

18.782 ms

**Retained native board**Accepted production architecture · all gates pass

11.448 ms

**Empty static scene**Diagnostic floor · not shippable

9.793 ms

The final board is only 1.66 ms above the empty-scene p95 floor. That does not mean the app “runs at 87 FPS”; p95 is a frame-duration percentile during active input. Surface-presented FPS is intentionally diluted by idle probe gaps and must not be reported as gameplay FPS.

### Core algorithms were not the final bottleneck

A fresh 3,000-sample Node 24 run across five 224–250-arrow fixtures measured generation p95 around 4.8–5.0 ms, geometry around 0.23 ms, key serialization around 0.03 ms, and hint solving around 0.05 ms.

- Typed row and column boundaries made exit-lane lookup O(1).
- A live-cell linked structure removed repeated board scans.
- RNG order and fixture fingerprints stayed unchanged.

### Memory needed a lifecycle test

A pre-native 50-level soak passed its frame gate but grew 26.57 MB in the leak-sensitive window. That exposed retention which a single-mission microbenchmark could never see.

- The final native result passed a complete 20-level soak.
- The final 50-level native memory run is incomplete.
- Never claim a passed 50-level final soak until it exists.

 **Evidence boundary:** early SVG and Skia experiments used a different GPU/runtime phase. They explain the journey, but they are not a clean A/B comparison with the final build. The three production rows above are the defensible same-protocol comparison.

### 58 tests passed

39 Jest tests across six suites plus 19 Android harness parser/utility tests.

### Types and patch shape passed

`tsc --noEmit` and `git diff --check` completed cleanly in the final audit.

### Generation stayed equivalent

Fixed-level fingerprints and solve validity remained unchanged while generator internals improved.

03 · Final architecture

## Move stable work to the layer that can retain it.

The useful boundary is not “JavaScript versus native.” It is mutable versus stable work, and how often data must cross ownership boundaries.

 Once per mission **TypeScript model**

Build deterministic arrows and immutable geometry.

 Compact protocol **Geometry + mask**

Full geometry once; visibility updates after exits.

 Retained state **Native board view**

Parse once, keep paths, rebuild only when visibility changes.

 Two draw calls **Platform canvas**

Stroke every shaft, then fill every arrow head.

 Rare event **Tap to JS**

One coordinate crosses back for authoritative game rules.

### JavaScript owns meaning

The board model, collision rules, level generator, hints, hearts, saves, ads, and navigation remain easy to test and change.

### Native owns the dense pixels

Android Canvas and iOS Core Graphics keep immutable paths close to the drawing API instead of rebuilding a host-component tree.

### Skia owns short motion

A transparent persistent surface draws only a hint, one shake, and at most two exit effects—not the hundreds of static arrows.

 **The governing rule:** cross runtime boundaries with facts, not frames. Send geometry once per mission, send a bounded visibility change when an arrow exits, and return one tap coordinate. Never stream every arrow’s transformed position through JavaScript on every frame.

04 · Assumptions corrected

## What we believed, and what the traces taught us.

Performance work becomes reusable when failed mental models are recorded—not just the final code.

#### Original: each arrow is a small component.

One group and two paths felt harmless in isolation.
 →

#### Learned: multiplicity changes the architecture.

At 250 arrows that became roughly 750 SVG host nodes, reconciliation work, native objects, and draw traversal.

#### Original: logical board size equals rendering cost.

A 1560×1560 logical scene did not sound extreme.
 →

#### Learned: density decides backing memory.

At 560 dpi it could become a 5460×5460 bitmap—about 119 MB before normal app memory.

#### Original: fewer React renders means smooth frames.

Memoization looked like the first-line cure.
 →

#### Learned: render ownership can dominate React work.

The largest cost remained in native host nodes, path composition, surfaces, and recurring draw work after React churn was reduced.

#### Original: batching into two paths solves the board.

It removed hundreds of nodes and saved memory.
 →

#### Learned: batching is necessary, not sufficient.

Compound SVG still parsed and rendered through a costly stack; early p95 improved from about 124.7 to 110.6 ms but remained unusable.

#### Original: “native” automatically means fast.

A first native display-list experiment sounded decisive.
 →

#### Learned: a bad native boundary stays bad.

The oversized transformed native child regressed to about 125.6 ms p95. The final win came from a bounded local retained view with a tiny protocol.

#### Original: a fast microbenchmark is enough.

Some hybrid effects won short interactions.
 →

#### Learned: realistic sequences change the winner.

A static-Skia plus SVG-feedback hybrid failed a multi-exit soak at about 50.7 ms p95. Interaction mix and lifecycle matter.

#### Original: memory after one mission is representative.

Snapshots looked stable enough.
 →

#### Learned: retention is a trend, not a point.

Only same-process 20–50 mission soaks exposed monotonic growth, animation retention, and cleanup failures.

#### Original: disabling visual feedback is an optimization.

No trails reduced allocation and memory.
 →

#### Learned: diagnostics are not product decisions.

The no-trail run isolated a cause. The shipping design kept feedback but bounded it to two slots, 180 ms, and dense-board degradation.

#### Original: a game engine is the next performance step.

Godot promises centralized scene rendering.
 →

#### Learned: migrate only when the remaining system demands it.

The narrow native renderer reached the empty-scene floor while preserving store, ads, persistence, navigation, and TypeScript game logic.

05 · Optimization journey

## The path was a sequence of falsifiable questions.

Each stage either removed a class of work, isolated a subsystem, or taught us which boundary not to use.

 1 · Reproduce the worst density

### Make the problem deterministic.

Fixed large missions—especially a 39×39, 250-arrow fixture—turned “sometimes laggy” into a repeatable workload with checksums.
 Outcome: stable inputs, no correctness drift

 2 · Bound the viewport

### Stop allocating the whole logical world.

The first emergency fix constrained the SVG backing surface to the visible viewport while transforms handled navigation.
 Outcome: prevented ≈119 MB backing-bitmap crash

 3 · Collapse host objects

### Replace 750 nodes with two compound paths.

All shafts became one stroked path and all heads one filled path. It saved memory and some frame time, but established that host-node count was only one layer of cost.
 Early p95: ≈124.7 → ≈110.6 ms · still rejected

 4 · Move pixels to Skia

### Separate React reconciliation from canvas drawing.

Static Skia delivered the first major rendering reduction. Feedback was moved onto the same surface and geometry was cached.
 Early p95 reached ≈71–75 ms in that phase

 5 · Learn from a native regression

### Reject “native” as a strategy by itself.

An oversized transformed display-list implementation was slower than Skia. Its boundary retained the wrong object and still made composition expensive.
 Early native p95 ≈125.6 ms · reverted

 6 · Isolate dynamic work

### Use empty, no-trail, opaque, and feedback-off diagnostics.

Ablations showed static drawing, transparent composition, exit effects, and first-use feedback had distinct costs. Each needed a targeted owner.
 Outcome: causal evidence, not shipping variants

 7 · Bound every transient resource

### Turn animations and feedback into fixed-size pools.

Two trail slots, one active shake, one hint, 180 ms cleanup, reusable audio players, and reusable haptic generators replaced open-ended allocation.
 Outcome: lower tails with behavior preserved

 8 · Fix lifecycle, not just draw calls

### Make mission transitions boring.

The board stopped remounting, duplicate generation disappeared, stale timers and taps were invalidated, storage writes were coalesced, and native resources were cleared.
 Outcome: stable same-process soak behavior

 9 · Build the narrow retained view

### Give static geometry one long-lived native owner.

Geometry crosses once per mission; a compact mask describes survivors; Android and iOS draw shafts and heads in two passes; transforms remain outside the view.
 Final p95 11.45 ms · jank 0.19% · accepted

 10 · Freeze only proven work

### Keep the experiment ledger beside the implementation.

Several plausible refactors, caches, chunk sizes, GC calls, and overlays were removed after regressions. Optimization is complete only when rejected complexity is also cleaned up.
 Outcome: smaller maintenance surface and honest evidence

06 · Searchable experiment ledger

## Keep the lessons, not just the winners.

“Rejected” means the idea failed this workload or boundary—not that the technique is universally bad. Re-run it if the product shape changes.

        ****

| Approach | Why we tried it | Observed result | Decision | Reusable lesson |
|---|---|---|---|---|
| Bound SVG to viewport | Prevent density-scaled allocation of the entire logical board. | Avoided a possible 119,246,400-byte backing bitmap and stopped the crash. | Retained | Rendering bounds and world coordinates are different concepts. Clip first, transform inside. |
| Two compound SVG paths | Collapse roughly 750 host nodes into one shaft path and one head path. | Early p95 ≈124.7 → 110.6 ms; median PSS ≈301.7 → 268.9 MB. Still 100% jank. | Superseded | Object batching can be a major win even when the underlying renderer remains the bottleneck. |
| Static Skia board | Use one drawing surface and avoid a large SVG host tree. | First major frame-time reduction; later production source reached 18.78 ms p95. | Narrowed | Canvas rendering was the right direction, but stable geometry still deserved a retained native owner. |
| Small persistent Skia overlay | Keep transient motion off React and avoid canvas remount churn. | Useful for one hint, one shake, and two exit slots; not enough as the static renderer. | Retained | Use a specialized renderer for the part it is best at, not by default for the whole scene. |
| Early native display list | Assume moving the existing structure native would remove overhead. | About 125.6 ms p95—77.6% slower than the then-current Skia phase. | Rejected | Native code with an oversized transformed child and poor invalidation can be slower than a focused cross-platform renderer. |
| Per-board geometry cache | Stop constructing and serializing identical arrow art on feedback frames. | Historical rebuild p95 ≈26.24 → 2.96 ms. | Retained | Cache at the lifetime of the thing: per mission, not forever. Global caches create stale data and retention risk. |
| Forced compositor layer | Try to isolate transformed board composition. | Regressed the SVG path and added texture/compositor cost. | Rejected | A hardware layer is not free; it trades repeated draw work for texture memory and composition. |
| Persistent canvas only | Remove repeated surface creation while retaining the Skia architecture. | About 19.15 ms p95; passed one short frame gate but kept memory slope. | Diagnostic | Lifecycle stability helps, but cannot erase recurring work inside the surface. |
| Shared survivor compounds | Reduce per-removal path rebuilding through shared/chunked paths. | 20.57 ms p95 and 20.94% jank; frame gate failed. | Rejected | Lower allocation is not automatically lower frame latency. Measure both. |
| 32 / 128-arrow chunks | Limit the amount of geometry rebuilt after each exit. | Some memory improvement, but p95 moved to about 21.8 / 17.39 ms in different variants. | Rejected | Chunk size is a workload-specific balance between invalidation and draw-call count. |
| Cached native SkPath | Eliminate repeated native string parsing and path creation. | Frame p95 stayed at 18.78 ms, but tail growth fell 10.43 → 8.25 MB and passed memory. | Evidence | Caching solved retention/parsing, not frame ownership. A flat p95 is a useful negative result. |
| Retained native board view | Own static paths locally and draw them in two platform-canvas passes. | 11.45 ms p95, 13.45 ms p99, 0.19% jank, 5.62 MB tail growth. | Accepted | The winning boundary was bounded, retained, local, and event-driven—not broadly native. |
| Native feedback pool | Avoid first-use decoding, Promise churn, and repeatedly allocated haptic/audio objects. | Blocked-action p95 improved ≈41%; exit p95 ≈26%; APK shrank ≈1.66 MB after excluding replaced modules. | Retained | Latency-sensitive, tiny, fire-and-forget APIs are excellent native-module candidates. |
| Native exit overlay | Move transient feedback from Skia into an Android view. | Redrew the root; about 20.4 ms p95 and 27.5% jank. | Rejected | A native overlay can expand invalidation. Inspect which ancestor gets redrawn. |
| Two reusable trail slots | Bound simultaneous animation state without losing visible exits. | Stable and sufficient for real input cadence; cleanup at 180 ms. | Retained | Size pools from believable concurrency, then define replacement behavior explicitly. |
| One shared animation lane | Minimize state even further. | Crashed Hermes/Worklets under reuse. | Rejected | Aggressive reuse can create invalid cross-runtime lifetimes. “Fewer objects” is not a safety proof. |
| Trail threshold 16 | Disable expensive slither effects earlier on dense boards. | Worsened p95 19.05 → 20.08 ms and jank 9.22% → 15.34%. | Rejected | Simpler-looking behavior can create a worse workload mix. Thresholds must be benchmarked. |
| No exit trails | Measure how much long-session growth came from transient animation. | Ten-level growth dropped roughly 10.8 → 4.5 MB. | Diagnostic | Ablation identifies causality. It does not grant permission to remove a product feature. |
| Explicit Hermes GC | Force reclamation at mission boundaries. | Memory slope worsened roughly 936 → 989 KB per level. | Rejected | Manual GC can move pauses and distort ownership symptoms without fixing retained references. |
| Runtime upgrades | Take lifecycle and memory fixes from Expo/RN/Worklets. | One comparable PSS p95 fell ≈310.7 → 181.0 MB while frame p95 stayed near 19 ms. | Retained | Upgrade for platform health, but do not mistake a memory win for a rendering cure. |
| Recorded SkPicture | Replay pre-recorded static draw commands. | Increased first-level PSS by about 13.1 MB and did not solve the soak. | Rejected | Recorded commands duplicate representation. Confirm whether replay savings exceed retained memory. |
| Persistent board lifecycle | Avoid remounting the whole board and regenerating levels twice. | Reduced churn; enabled clean mission-to-mission ownership and stale-event guards. | Retained | Component keys are performance and lifecycle decisions, not merely rendering conveniences. |
| Coalesced storage writes | Stop unrelated persistence traffic from competing during transitions. | One startup multiGet, microtask batches, ordered multiSet/multiRemove, immediate memory reads. | Retained | I/O batching reduces runtime-boundary calls and gives writes a clear ordering invariant. |
| Indexed level generation | Remove repeated ray walks and live-cell scans inside dense generation. | Typed row/column boundaries, live-cell links, and capped backward scans; a historical same-phase run cut p95 roughly 73% with fingerprints unchanged. | Retained | Optimize the repeated query, preserve traversal and RNG order, and compare only within the same benchmark protocol. |
| Shape allocation cleanup | Remove closures and temporary polygon objects created inside sampling loops. | Static polygon data and direct arithmetic reduced core churn without changing silhouettes. | Retained | Hot-loop allocation matters after the algorithm is right; do not start here while a repeated scan dominates. |
| Tuple cache in geometry | Avoid reconstructing small coordinate pairs. | Stayed inside noise and made geometry performance worse. | Rejected | Caching tiny values can cost more lookup, lifetime, and indirection than recomputation. |
| Gesture write coalescing | Reduce UI-runtime transform updates during pan. | Reduced vertical-pan frame delivery and changed input quality. | Rejected | An optimization that drops meaningful input is a behavior regression, even if one counter improves. |
| Density-at-draw boundary | Fix the first native screenshot where Android arrows rendered too small. | React Native logical units convert once to Android Canvas physical pixels; iOS stays in UIKit points. | Retained | Platform units are part of the protocol. Visual screenshot checks catch mistakes timing data cannot. |
| Skia lifecycle patch | Close native-window, registry, picture handoff, and mapper lifetime holes. | RAII release, side-effect-free lookups, mutex handoff, and unmount cleanup were kept. | Retained | Correct native ownership can prevent retention and races even when it is not the main frame-time win. |
| Real ad initialization gate | Stop treating SDK call dispatch as successful initialization. | Waits for the actual success callback, preloads with typed listeners/backoff, and stays isolated in benchmarks. | Retained | Third-party SDK promises may acknowledge dispatch, not readiness. Model the documented lifecycle. |
| Fresh benchmark bundle enforcement | Prevent Expo public environment flags from reusing stale Gradle outputs. | The harness deletes generated bundle/APK outputs and records provenance before runs. | Retained | A benchmark of stale code is worse than no benchmark because it creates confident false causality. |
| Empty board floor | Measure everything except static arrow drawing. | 9.79 ms p95, 0.08% jank; final native view is 1.66 ms above it. | Diagnostic | A floor tells you when further renderer work has diminishing returns. |
| Final 50-level native soak | Validate long-session memory beyond the accepted 20-level result. | Existing artifact is incomplete: status running, summary null. | Still needed | Never turn an interrupted benchmark into a conclusion. |

07 · Optimization atlas

## Every subsystem we audited.

A rendering symptom can be amplified by generation, state, timers, storage, feedback, ads, lifecycle, or the benchmark itself. Audit the whole interaction path.

       **** **** **** **** **** **** **** **** **** **** **** **** **** **** **** **** **** **** **** ****

| Area | Question to ask | Arrows change | Invariant / warning |
|---|---|---|---|
| Host-node count | How many native objects does one logical item create? | ≈750 SVG nodes → one native board + small overlay. | Count after library expansion, not JSX elements alone. |
| Backing surfaces | What physical-pixel texture or bitmap gets allocated? | Bound drawing to viewport. | Logical size × density × bytes per pixel can dominate RAM. |
| Draw-call shape | Can visually identical items share one stroke/fill? | All shafts stroked once; all heads filled once. | Batch by paint state; avoid state changes inside the hot loop. |
| Static vs dynamic | Which pixels truly change each frame? | Static board native; only short feedback on Skia. | Do not animate the data model when a transform will do. |
| Geometry lifetime | How often is shape data built, parsed, and serialized? | Per-board cache and parse once per mission. | Cache at the narrowest correct lifetime. |
| Runtime-boundary traffic | Are facts crossing JS/native once, or are frames crossing repeatedly? | Geometry once, mask on removal, tap once. | Prefer bounded event protocols over continuous object graphs. |
| Input runtime | Does pan/pinch wait for JavaScript? | Transforms stay on UI runtime. | Never degrade input semantics for an unproven coalescing win. |
| Animation pools | Can transient objects grow with interaction count? | Two trail slots, one shake, one hint. | Bound concurrency, cancellation, replacement, and cleanup. |
| Adaptive fidelity | Can effects become cheaper when the scene is dense? | Full slither only at ≤64 arrows; short trail above. | Preserve feedback meaning even when detail drops. |
| Game-state updates | Does a state updater perform generation or other heavy work? | Generate outside updater; one session per level. | React may invoke updater logic in ways that make side effects unsafe. |
| Component lifecycle | What remounts on every mission? | Persistent BoardView; explicit reset. | Unmount must clear timers, mappers, native handles, and callbacks. |
| Race conditions | Can stale input or timers mutate a new mission? | Board reference checks and terminal transition guard. | Correctness bugs often masquerade as unexplained churn. |
| Text churn | Does one changing number rebuild a large paragraph? | Static mission label split from remaining count. | Text layout and paragraph caches have measurable lifetimes. |
| Storage | Are writes serialized, batched, and scoped to owned keys? | Hydrated memory cache + coalesced multi operations. | Define ordering across batches or lose newer data. |
| Audio/haptics | Does the first interaction load or decode resources? | Native preload and reuse. | Handle background, media-service reset, and stale callbacks. |
| Ads/network | Is external SDK noise mixed into renderer evidence? | Isolated benchmark mode; real init success gate. | Isolation is for measurement, not production behavior. |
| Native ownership | Who releases windows, paths, players, observers, and mappers? | Explicit destroy/foreground/background cleanup. | RAII and lifecycle guards matter more than syntax language. |
| Generator complexity | Is a repeated scan hiding inside a nested loop? | Typed boundaries and live-cell links. | Preserve traversal/RNG order and validate fingerprints. |
| Release size | Did a specialized dependency earn its binary cost? | R8/resource shrink, two font weights, replaced feedback modules excluded. | AAB upload size is not per-device installed size. |
| Measurement effects | Does the profiler perturb memory or timing? | Separate frame-instrumented and memory-only soak modes. | Instrumentation is part of the experiment. |

08 · Native modules

## Use native code as a scalpel.

Native modules worked when the interface was small, the owner was clear, and the operation mapped directly to platform primitives.

### Module 1 · Retained board view

**Interface:** immutable geometry, visibility mask, colors, dimensions, and one tap callback.

- Android retains per-arrow `Path` objects and two visible compound paths.
- iOS retains immutable `CGPath` geometry and combines visible paths during draw.
- Density conversion happens exactly once at Android’s drawing boundary.
- Malformed, non-finite, oversized, or inconsistent geometry fails closed.
- Destroy clears retained paths and callbacks.

### Module 2 · Feedback pool

**Interface:** tiny fire-and-forget methods for tap, blocked, exit, win, and loss beats.

- Android uses one `SoundPool`, at most four streams, preloaded samples, and view haptics.
- iOS reuses one decoded player per effect and reusable haptic generators.
- Foreground/background, destruction, media-service reset, and stale load callbacks are guarded.
- Expo Go and web lazily fall back to Expo feedback without breaking the app.
- The release build excludes redundant Expo audio/haptic native modules.

 **Expo SDK 57 nuance:** Expo Modules support React Native’s New Architecture and use JSI rather than the legacy JSON message queue. The official guidance says individual call overhead is unlikely to be the bottleneck. That matches our evidence: the breakthrough came from retaining and executing dense drawing in the right owner, not merely from making fewer module calls. See the [Expo Modules API overview](https://docs.expo.dev/modules/overview/).

### Why the final native board was fast when the first native attempt was slow

      **** **** **** **** **** ****

| Boundary property | Early display-list attempt | Final retained view | Why it matters |
|---|---|---|---|
| Bounds | Large transformed child | Local viewport-sized view | Composition and invalidation stay bounded. |
| Data lifetime | Representation followed old renderer shape | Immutable geometry retained per mission | Parsing and allocation leave the active frame. |
| Draw shape | Native version of a complex display structure | One shaft stroke + one head fill | The API matches the visual structure directly. |
| Updates | Broad display invalidation | Visibility event only | One removed arrow does not rebuild the app tree. |
| Transforms | Entangled with rendered child | Handled by UI runtime container | Pan/pinch does not require JS or geometry work. |
| Feedback | Not separated by volatility | Transient layer kept independent | Static and dynamic pixels get different owners. |

### Good native candidate

High-frequency or latency-sensitive work, stable data, direct platform primitive, tiny API, measurable cost, and clear lifecycle.

### Bad native candidate

Business rules that change often, large mutable object graphs, unmeasured work, platform behavior that must remain identical, or unclear ownership.

### Price of admission

Two platform implementations, dev/release builds instead of Expo Go, lifecycle testing, bridge validation, upgrade maintenance, and a web fallback.

 **Current protocol limit:** native geometry still arrives as text once per mission, and the visibility mask is O(n). For 250 arrows this is bounded and fast. A typed buffer, JSI shared object, bitset, or `hideArrow(index)` command is justified only if a future trace shows that one-time parse or mask update has become significant.

09 · Benchmark method

## A benchmark is a controlled argument.

Every number needs a workload, build, device, warmup, collection window, validity check, and decision gate. Otherwise it is decoration.

### Layer A · Pure core benchmark

Five deterministic high-density fixtures measure generation, geometry, key creation, and hint solve without rendering noise.

- Warm up before collecting.
- Batch enough iterations to reduce timer noise.
- Check fingerprints, blocked/free validity, and solved output.
- Use it to reject algorithm regressions—not to predict UI smoothness.

### Layer B · Release Android soak

A native input driver solves immediately preceding warmup missions and then 20–50 measured missions in one PID.

- Release APK, debuggable false, benchmark-only profileable true.
- API 31 AVD, 60 Hz, animations off, fixed-performance mode.
- Validate package/hash, PID continuity, tap acceptance, checksums, crash/ANR, and thermal state.
- Record source/runtime/config provenance in each artifact.

### Frame and lifecycle gates

      **** **** **** **** **** ****

| Signal | Gate | Why this signal | What can fool it |
|---|---|---|---|
| Active frame p95 | ≤ 20 ms | Captures the slow edge of ordinary interaction. | A different GPU, sample window, or too few active frames. |
| Active frame p99 | ≤ 34 ms | Protects against severe tails that averages hide. | One-off setup frames mixed into the wrong window. |
| Janky frames | ≤ 10% | Measures missed 60 Hz budget directly. | Idle/present gaps and incomplete gfxinfo buffers. |
| Worst-level p95 | ≤ 34 ms | Stops one difficult mission from hiding inside an aggregate. | Non-deterministic level sequences. |
| Process health | No crash, ANR, or PID change | A fast restart is not a successful soak. | Harness reconnects that silently follow a new process. |
| Memory trend | No monotonic steady-state leak signal | Distinguishes growth from normal GC noise. | Warmup, profiler calls, system pressure, and too-short runs. |

### Use percentiles

A mean can improve while users still feel periodic 40 ms frames. Report p50 for center, p95 for ordinary tail, p99 for severe tail, and the worst level separately.

### Model memory as a trend

Ignore warmup, compare first/last window medians, compute endpoint growth, Theil–Sen slope, and Spearman correlation. Flag only when size, slope, and monotonicity agree.

### Split intrusive probes

Frame-instrumented runs call many diagnostics. A memory-only mode takes one PSS sample per mission so the observer is less likely to become the leak.
    Reproduce the two benchmark layers

Run the algorithm suite first. Then use the Android harness with a controlled emulator and release benchmark build. Do not compare an unverified `--skip-build` artifact with a freshly built source result.

```
npm run perf:core -- --pretty

# The Android harness owns build metadata, AVD setup,
# deterministic gestures, frame capture, and soak validation.
npm run perf:android -- --feedback --soak-levels 20

# Run separately when profiler activity may distort memory.
npm run perf:android -- --feedback --soak-levels 50 --memory-only
```

 **Discard or quarantine invalid evidence:** partial JSON with `status: running` or `summary: null`, a changed runtime/GPU/workload presented as direct A/B, stale Expo public flags inside a reused Gradle bundle, thermal throttling, PID restart, failed input acceptance, or a benchmark build accidentally shipped as production.

10 · React Native versus Godot

## Choose an engine for the remaining product, not the old bottleneck.

We did not produce a Godot benchmark artifact. The conclusion is that migration is not justified after the hybrid app clears its gates—not that Godot was proven slower.

      **** **** **** **** **** **** **** ****

| Decision factor | Hybrid React Native now | Godot rewrite | Current call |
|---|---|---|---|
| Dense static board | 11.45 ms p95; 0.19% jank with retained native view. | Likely strong scene rendering, but not measured here. | RN clears gate |
| Distance to floor | Only 1.66 ms above empty static scene p95. | Little remaining static-render headroom proven. | Diminishing return |
| Game rules | Mature deterministic TypeScript core and tests remain intact. | Port and revalidate every rule and fingerprint. | Keep |
| Mobile product stack | Navigation, storage, ads, app lifecycle, accessibility, and store pipeline exist. | Rebuild or bridge this infrastructure. | Keep |
| Native access | Expo Modules solve focused hotspots with web fallbacks. | Engine extensions/plugins can solve platform work. | Sufficient |
| Advanced game systems | Manual if future game needs physics, particles, shaders, large scene graphs, or editor tooling. | Engine-native strength. | Watch roadmap |
| Migration cost | Incremental, already implemented. | Parallel rewrite, QA parity, new build/release expertise, longer feature freeze. | Avoid now |
| Team cognition | One product codebase plus two small native surfaces. | New language, editor, runtime, plugins, debugging, and architecture. | Preserve |

### Re-open the Godot decision only when evidence crosses a trigger

### Scene complexity

Gameplay becomes many independently moving, colliding, or shader-driven objects—not a stable board with sparse feedback.

### Native surface sprawl

Several core screens need large custom renderers and the React Native shell stops owning most product behavior.

### Frame gate failure

Representative low-end physical devices fail defined budgets after the narrow native path is profiled and tuned.

### Tooling need

Designers need an engine editor, animation state machines, particle authoring, tilemaps, or physics visualization every day.

### Cross-platform parity cost

Duplicated Android/iOS renderer work becomes larger than an engine-based shared scene implementation.

### Prototype wins

A small, equivalent Godot vertical slice beats the physical-device gates by enough to repay a measured rewrite budget.

RN

 **Current choice: keep React Native + two narrow native modules.**

Do not migrate because “engines are faster.” Migrate when an equivalent prototype, real-device measurements, future feature needs, and full product migration cost form a stronger case than the current system.

11 · Reusable optimization playbook

## A straight path for the next app.

Follow this order. It reduces the chance of polishing the wrong layer or accepting a benchmark that does not represent the product.

The copy button creates a portable checklist for an issue, PR, or future optimization skill.

### Name the user-visible failure.

Write “dense level pan misses frames” or “memory rises after twenty missions,” not “make it faster.” Attach a threshold and a representative device class.

### Freeze a deterministic worst case.

Choose levels, data, gestures, and feedback that reliably reproduce the complaint. Add fingerprints so an optimization cannot silently change output.

### Map work by runtime and lifetime.

For every expensive object, record who creates it, who updates it, how often it crosses a boundary, and who releases it.

### Count expanded objects and pixels.

Multiply logical items by host nodes. Multiply logical dimensions by density and bytes per pixel. Estimate the real cost before changing code.

### Build the smallest trustworthy harness.

Use release builds, deterministic input, warmup, validity checks, p95/p99/jank, process health, and artifact provenance. Define gates before seeing results.

### Ablate one subsystem at a time.

Empty the scene, disable one effect, bypass storage, or replace real feedback with a stub. Label these as diagnostics, never product candidates.

### Remove multiplicity first.

Batch identical paint, virtualize offscreen content, bound surfaces, hoist stable data, and prevent remounts before introducing a new language or renderer.

### Separate static from dynamic work.

Stable data should be built once and retained. Dynamic transforms should run on the animation/UI runtime. Rare semantic events can return to JS.

### Bound transient resources.

Set explicit pool sizes, durations, cancellation, cleanup, and dense-scene degradation. A transient object without a bound is a future soak failure.

### Design a narrow native interface.

Move the measured platform-shaped hotspot only. Prefer immutable setup plus tiny event updates; keep changing business rules in shared code.

### Benchmark every candidate in context.

A microbenchmark may identify a mechanism, but only the full interaction mix chooses a shipping winner. Compare like with like.

### Soak the lifecycle.

Repeat screens, levels, animations, backgrounding, and cleanup in one process. Use robust memory trends, not one snapshot or forced GC.

### Audit correctness and release hygiene.

Validate density, stale callbacks, malformed native input, resource destruction, fallback behavior, accessibility, production flags, and AAB contents.

### Freeze evidence and delete losers.

Archive accepted JSON and protocol details. Record caveats. Revert speculative complexity. Define the next trigger instead of optimizing forever.

### Concrete recipes
  Recipe A · Estimate a backing surface before it crashes

Convert logical size into physical pixels, then multiply by bytes per pixel. This is an upper-bound warning, not a complete GPU-memory model.

```
physicalWidth  = logicalWidth  × deviceDensity
physicalHeight = logicalHeight × deviceDensity
RGBA bytes     = physicalWidth × physicalHeight × 4

Example:
1560 × 3.5 = 5460 physical pixels
5460 × 5460 × 4 = 119,246,400 bytes ≈ 113.7 MiB
```
    Recipe B · Split static geometry from transient feedback

Keep one stable surface for the board and one small surface for the few things that animate. Transform their common parent so they remain aligned.

```
<AnimatedBoardTransform>
  <NativeStaticBoard
    geometry={missionGeometry}
    visibility={survivorMask}
    onTap={handleBoardTap}
  />
  <TransientFeedbackOverlay
    hint={hint}
    shake={shake}
    exits={twoReusableExitSlots}
  />
</AnimatedBoardTransform>
```
    Recipe C · Define the native protocol before the native code

A good protocol states frequency, ownership, validation, and cleanup. If it needs a mutable object graph every frame, narrow it again.

```
Mission setup, once:
  setGeometry(serializedImmutableArrows)
  setBoardSize(width, height)

Arrow exit, bounded event:
  setVisibility(compactMask)
  // Future only if measured: hideArrow(index)

Input, rare event:
  onBoardTap(x, y)

Destroy:
  clearPaths()
  clearCallbacks()
```
    Recipe D · Make terminal transitions idempotent

State updates alone may arrive too late to stop a second tap or timer. Use a synchronous guard and reset it only when a new mission becomes authoritative.

```
if (!terminalGuard.tryEnter()) return;

cancelPendingHint();
cancelPendingOutcome();
commitWinOrLoss();

// When the next mission is installed:
terminalGuard.reset();
```
    Recipe E · Interpret a memory soak without fooling yourself

Warmup can look like a leak and GC can look like a fix. Require multiple signals to agree.

```
1. Skip warmup missions.
2. Compare median PSS of the first and last five measured missions.
3. Compute endpoint growth.
4. Compute Theil–Sen slope across measured missions.
5. Compute Spearman correlation with mission index.
6. Flag only when growth is material, slope is positive,
   and correlation shows a monotonic trend.
7. Observe final idle reclamation; never force GC as the cure.
```

12 · Current limits and future triggers

## Good performance has a boundary.

The present architecture is validated for today’s maximum of roughly 250 arrows. The right next optimization depends on which bound changes.

      **** **** **** **** **** **** **** **** **** **** **** ****

| Known limit | Why acceptable now | Trigger to revisit | Likely next experiment |
|---|---|---|---|
| 20-level final native soak | Passed frame and memory gates across 2,247 removals. | Before broad release or after renderer/runtime changes. | Complete 50-level memory-only and frame soaks on the final build. |
| Controlled emulator evidence | Excellent for repeatable A/B comparisons. | Release-candidate signoff. | Test low-end physical Android, 60/90/120 Hz devices, and real thermal conditions. |
| No physical iOS soak | Release simulator build verifies compilation and basic behavior. | Before claiming cross-platform performance parity. | Automated iPhone mission soak with Instruments signposts and memory graph. |
| O(n) visibility mask | n ≤ 250; final frame result is comfortably inside gate. | Boards grow substantially or traces show interop/mask cost. | Index command, bitset, typed buffer, or shared native state. |
| Text geometry payload | Parsed once per mission, outside steady-state frame work. | Mission-start latency becomes visible or geometry grows by an order of magnitude. | Typed arrays or JSI shared buffer after profiling. |
| Android compound rebuild | Bounded survivor set; measured final p95 is strong. | Frequent bulk visibility changes or much larger scenes. | Incremental native buckets or retained per-arrow display objects—benchmarked against draw-call cost. |
| iOS combines visible paths on draw | No physical trace yet proves it is a bottleneck. | iPhone p95 or energy trace points here. | Retained visible compound CGPaths with explicit invalidation. |
| Transparent Skia overlay | Small scope and near-floor final result. | Composition, memory, or binary-size budget tightens. | Platform animation view, lighter canvas, or static native hint where measured. |
| Pinned Skia patch | Fixes native window ownership, registry lifetime, mutex handoff, and mapper cleanup. | Every Skia upgrade. | Check upstream fixes, drop obsolete hunks, rerun lifecycle soak. |
| Two trail slots | Matches realistic input cadence and bounds memory. | New multi-touch or automated rapid-fire mechanic. | Measure queue/replacement semantics before increasing pool. |
| Native feedback fails silently | Gameplay remains correct and fallback exists when module is absent. | User reports missing feedback or observability need. | Rate-limited diagnostic counters outside latency path. |
| Web uses compound SVG | Correct fallback with no custom native module. | Web becomes a high-density primary platform. | Canvas/WebGL renderer with the same immutable-geometry protocol. |

 **Stop condition reached:** the representative final build passes predefined gates and sits close to the diagnostic floor. The next responsible work is physical-device validation and durability of evidence—not another speculative renderer rewrite.

13 · Source map

## Follow the evidence into the code.

This page archives decisive temporary benchmark numbers. The linked repository files are the reproducible harness and current implementation.

### Benchmark system

- [Core algorithm benchmark](../scripts/perf/core-benchmark.ts)
- [Android frame and soak harness](../scripts/perf/android/benchmark.mjs)
- [Deterministic soak planner](../scripts/perf/android/soak-plan.ts)
- [Robust memory statistics](../scripts/perf/android/soak-utils.mjs)
- [Frame and PSS parser](../scripts/perf/android/parse-gfxinfo.mjs)
- [Surface presentation parser](../scripts/perf/android/parse-surfaceflinger.mjs)
- [Native input driver](../scripts/perf/android/ArrowsWorkload.java)

### Rendering and native modules

- [Board orchestration and transient effects](../src/ui/BoardView.tsx)
- [Native board adapter](../src/ui/StaticBoardSurface.native.tsx)
- [Web compound-SVG fallback](../src/ui/StaticBoardSurface.tsx)
- [Geometry and per-board cache](../src/ui/arrowGeometry.ts)
- [Android/iOS retained board module](../modules/arrows-board/)
- [Android/iOS feedback pool](../modules/arrows-feedback/)
- [Skia lifecycle patch](../patches/@shopify+react-native-skia+2.6.2.patch)

### Core and lifecycle

- [Optimized deterministic generator](../src/core/levelGenerator.ts)
- [Allocation-conscious shape library](../src/core/shapeLibrary.ts)
- [Generator fingerprints and invariants](../src/core/__tests__/levelGenerator.test.ts)
- [Terminal-transition lifecycle guard](../src/ui/gameSessionLifecycle.ts)
- [Persistent mission/session flow](../src/ui/GameScreen.tsx)
- [Hydrated and coalesced persistence](../src/ui/storage.ts)

### Evidence provenance

The strongest accepted artifacts were `arrows-final-source-soak-20.json`, `arrows-native-path-cache-soak-20.json`, `arrows-native-view-soak-20.json`, and `arrows-empty-skia-surface-soak-20.json`. They lived in temporary storage when this guide was produced, so their accepted metrics and caveats are preserved here.

Historical phase results must stay labeled by runtime, GPU, harness, and workload. Exact-looking numbers are not comparable merely because they share a unit.

### Versioned platform references

- [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/) — React Native 0.86, platform targets, and SDK compatibility.
- [Expo Modules API overview](https://docs.expo.dev/modules/overview/) — native modules, native views, New Architecture, and JSI characteristics.

 **Durability improvement for the next campaign:** commit a small machine-readable performance report with each accepted milestone. Include artifact hash, source commit, runtime versions, device/GPU, workload checksum, status, gate result, and any reason a row is diagnostic-only.

No section or experiment matches that search. Try a subsystem such as “memory,” “native,” “trail,” “storage,” or “Godot.”
