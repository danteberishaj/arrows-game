# Arrows — Next Level Plan

**Written 2026-09-09** against versionCode 6 (commit `62de5ab`). Sources: a full read of the
codebase, measurements executed against the real generator and board logic, a play session on the
web build, and sourced external research. Every number below either names the measurement that
produced it or is explicitly marked as needing one.

---

## 0. The one-paragraph version

The *engineering* is genuinely good — a retained native board view, an 8-step pentatonic combo
ladder, nearest-ink tap forgiveness, deterministic generation, real perf discipline. That is
shipped-quality craft most indie puzzle games never reach. It is wrapped around a game that
**runs out of content at level 12**, **cannot be lost by thinking**, **teaches a new player
nothing**, **gives no reason to return tomorrow**, and **cannot see any of it happening** (zero
analytics). "Next level" is not more polish on the tap — the tap is already the best part. It is:
make the first session survivable, make tomorrow exist, make the curve real, make the payoff match
the effort, and instrument all of it so the next decision is measured rather than argued.

---

## 1. What is actually true today (measured, not assumed)

### 1.1 Three findings that reframe the product

**A. No tap order can ever brick a board — this is not a logic puzzle.**
50 random-greedy playthroughs across levels 1, 3, 6, 12, 24, 36, 60, 117, 162, 168 (including the
202-arrow Super Hard Cat) cleared in *exactly* `arrowCount` taps with zero dead ends. This is
provable, not just empirical: removing an arrow only empties cells, so `canExit` is monotone — a
clear lane stays clear. **PRODUCT.md's "the puzzle is finding the order" is false as implemented.**
The real game is a *visual-search / attention* task repeated 60–209 times. The only failure mode is
a misread, never a bad plan.

**B. The difficulty curve is flat forever.**

| Level | 1 | 100 | 200 | 500 | 1000 |
|---|---|---|---|---|---|
| Arrows | 60 | 85 | 93 | 119 | 97 |

Mean arrows levels 1–30 = 96.2 vs levels 171–200 = 100.4. `Difficulties.config()` switches on the
tier enum only and never reads the level index, so level 200's Normal config is byte-identical to
level 2's. **The game a player experiences at level 500 is the game they experienced at level 5.**

**C. Content is thin and ordered backwards.** Across levels 1–200:

- Circle / Diamond / Square / Rectangle = **71%** of all levels
- **33%** are a plain filled rectangle with **no picture at all** (`Square`/`Rectangle` fill the grid)
- Levels **1 and 2 are both Circle**; 29 of 199 levels repeat the previous level's shape
- First appearances: Crown@60 → **57-level novelty drought** → Hexagon@117, Butterfly@120,
  Flower@126, X@159, Heart@162, Cat@168
- After level 168 **nothing new exists ever again** — the catalogue is 26 shapes

The most shareable, most on-brand silhouettes are buried behind 160+ levels almost nobody reaches.

### 1.2 Four defects shipping right now

| # | Defect | Evidence |
|---|---|---|
| 1 | **Reduce-motion feedback blackout.** With OS reduce motion ON, `withTiming` jumps straight to `toValue`. At k=1: `blockerOpacityAt`=0, `blockedBumpAt`=0, hint pulse=0. No blocker flash, no bump, and the **rewarded-ad-paid hint renders nothing**. The game's only explanation of its core rule disappears. | Computed from the real curves. Sites: `StaticBoardSurface.native.tsx:264,308,348`; `BoardView.tsx:842,887,934` |
| 2 | **Interstitial counter resets every cold start.** `ads.tsx:255 let finishedGames = 0` is module-level and not in `PersistenceKeys`. A player who kills the app between levels — the exact session shape PRODUCT.md describes — sees interstitials almost never. A loss never shows one at all (only the win panel reaches `showInterstitialIfDue`). | Read from source |
| 3 | **Splash has no completion backstop.** Both `onDone` paths fire from a Reanimated completion callback. No timer, no AppState fallback (`grep AppState src/` = 0 hits). If the animation never completes the player is stuck. | `SplashScreen.tsx:47-49,53-56` |
| 4 | **The simulated TEST AD modal ships in production** and is the fallback whenever `initAds()` fails — which is called once from a `useEffect([])` and never retried. Rewarded no-fill is a silent no-op. | `App.tsx:85`, `ads.tsx:49-54,146-148,231-236` |

### 1.3 Contrast: the default theme is the weaker one

Computed against PRODUCT.md's own targets (≥4.5:1 body, ≥3:1 large):

| Role | Daylight | Ink Night | Needs |
|---|---|---|---|
| Inactive header glyph (sound off) | **1.21:1** | **1.44:1** | 4.5 |
| Spent heart pip on bg | **1.40:1** | **1.63:1** | 3.0 |
| Unearned star on panel | **1.21:1** | **1.44:1** | 3.0 |
| Hairline border on surface | **1.16:1** | **1.16:1** | 3.0 |
| Panel subline (`inkDim` on surface) | **4.43:1** | 6.35:1 | 4.5 |
| Perfect-streak line (13 pt) | **3.01:1** | 6.23:1 | 4.5 |

Daylight — **the default** — fails 5 roles; Ink Night fails 3. The spent heart pip at 1.40:1 is not
a WCAG technicality: it is the readout that tells the player how many lives they have left.

### 1.4 What is entirely absent

No onboarding · no analytics · no crash reporting · no remote config · no A/B capability · no IAP ·
no notifications · no store-review prompt · no achievements · no collection · no share · no cloud
save · no settings screen · no schema version key · no component-render tests · no visual
verification · no physical-device evidence on any platform · no shippable iOS build.

`SaveSystem` is **8 frozen integer keys** behind a `getInt/setInt/deleteKey` store.

---

## 2. External evidence that shapes the plan

Sourced, with confidences recorded. Two widely-circulated numbers were checked and **rejected**.

- **Real benchmarks.** GameAnalytics 2024 puzzle medians: **D1 ~20%, D7 ~4.4%, D28 ~1.2%.** The
  ubiquitous "puzzle 31.85 / 12.18 / 5.35" table is *AppsFlyer Q3 2022* recycled under 2026 bylines
  — do not use it. GameAnalytics 2026 global medians D1 ~22% / D7 ~4% / D30 ~0.7–0.8%; top 1% D30
  13–15%. For a solo, ad-light game the honest ambition is **upper-quartile, not top 1%**.
- **Difficulty is the best-evidenced retention lever.** Li et al., KDD 2021, real tile-matching
  puzzle, 10-day A/B (14,615 vs 14,687 users). Churn hazard for players in their first <10 days:
  too-easy 0.053, matched 0.081, **too-hard 0.160 — 3× the risk.** Arrows violates exactly this on
  day 0.
- **Front-loaded tutorials do not work.** NN/g's controlled test (70 participants, 4 iOS apps): a
  tutorial deck did *not* improve task success (91% readers vs 94% skippers) and made the app *feel*
  harder. NN/g grants one exception — an app introducing a workflow for which users have no mental
  model, taught **contextually at first encounter**. Arrows is that exception.
- **Streak forgiveness beats strictness.** Duolingo: raising the freeze cap 1→2–3 significantly
  improved return rates. Busuu: +15% sessions after adding a streak. But JMIR 2023 (n=14,879,
  899,071 uses) found rigid daily consistency predicted *worse* long-term persistence, and evening
  use decayed fastest — uncomfortable for a "before bed" positioning.
- **Daily content is the load-bearing retention system in this genre** and Arrows has none. NYT
  Games: 11.2B plays in 2025, calm, ad-free, timer-free, meta entirely self-competitive. Naavik's
  constraint: the daily must be completable in a new player's *first session*.
- **The incumbent.** "Arrows – Puzzle Escape" is Lessmore GmbH, acquired by Miniclip 2025-03-04,
  100M+ Play downloads, 420k App Store ratings at 4.9, with a finite handcrafted campaign, daily
  challenge, weekly themes, leagues and an 8-SKU IAP ladder. **You cannot out-live-ops them.** But
  their own reviews complain they cannot see the whole board — Arrows' fit-to-view pinch-zoom is a
  real, review-evidenced advantage *already shipped*.
- **Against an IAP ladder.** Block Blast runs ~15M DAU at ~$1M/day on ads with **~$66k lifetime
  IAP**. Tune placement before building a store.
- **Capability (verified against SDK 57 docs).** Skottie (a Lottie renderer) is **built into Skia
  2.6.2** — illustration-grade animation with zero new dependencies. Skia `Atlas` +
  `useRSXformBuffer` draws many moving sprites with **zero per-element React nodes**. Shared-element
  transitions are behind a static feature flag and **not production-ready**. A navigator is **not**
  warranted for 3 screens. Android Auto Backup is **already on and unconfigured**.

---

## 3. The strategic call

> **Arrows is a calm attention game, not a logic puzzle. Lean into that.**

Finding **A** means depth cannot be added by tuning the generator's existing knobs — the only levers
are more arrows on a bigger grid (which is what the flat curve already proves) or a *new mechanic*
that lets plans fail. That is a real fork:

- **Track A (recommended).** Accept the game as an attention/flow game. Fix the pitch. All leverage
  is in FTUE, content pacing, the reward moment, and a calm daily meta. Everything in §4 assumes this.
- **Track B (optional, later).** Add a genuine ordering constraint — a piece type that makes a plan
  fail. This breaks the generator's solvability-by-construction proof and is a design project in its
  own right. **Do not start it before Track A is measured.**

---

## 4. Cross-cutting work that must exist before the workstreams

Four independent red-team passes (brand, performance, evidence, scope) attacked the workstream plan.
They converged on the same structural finding: **the workstreams were authored in parallel and
collide.** These five items are net-new and own the collisions. Nothing in §5 starts before them.

### P-00 — Land the working tree · S
`git status` shows **48 touched paths** — modified `boardLogic.ts`, `BoardView.tsx`, `GameScreen.tsx`,
`StaticBoardSurface.native.tsx`, both native feedback modules, plus 20 untracked files including 8
new `pop*.wav`, four new test files and `metro.config.js`. Every step below is specified against a
tree that is not committed. Land or shelve it first.

### P-01 — One persistence-schema owner · M
**The single largest defect in the plan.** `PersistenceKeys` is an `Object.freeze`d 8-entry array
whose exact contents are asserted by value in `storage.test.ts:36`. Five steps independently append
to it and independently rewrite that assertion — W0-06, W1-03, W3-01, W4-01, W6-03 — each computing
a different final length (**+1, 9, 10, 19, 9**). *At most one can pass.* Two of them
(W4-01, W6-03) also create `arrows_schema_version` with different migration semantics.

P-01 replaces the key-adding half of all five: one merged key registry, one schema version, one
migration, one wipe-risk analysis, one updated assertion. It ships **alone, in its own release**,
verified by an over-install screenshot showing "Level N" unchanged.

### P-02 — One capture instrument · M
Three workstreams each build a screen-capture harness over the same `adb` plumbing
(W2's `capture-motion.mjs`, W5's `capture-device.mjs`, W6-11/12/13). Build W6's version — it is the
only one with the `animator_duration_scale` read-back and the pixel-difference floor — and have the
others consume it. **This must precede every motion and art step**, not follow them.

### P-03 — Write down what the game is · S
No step rewrites `PRODUCT.md`. The plan measured its central product claim false — "the puzzle is
finding the order" — and then all eight workstreams optimised their own axis against the unexamined
assumption that the current product is worth multiplying. Decide §3's fork, rewrite PRODUCT.md's
Product Purpose, and re-derive: if this is a visual-search game, then **legibility, density and
silhouette novelty are the core loop**, which promotes W3 and demotes parts of W2.

### P-04 — Shipping preconditions · S
`targetSdk` is pinned **nowhere in the repo** — `android/` is generated and gitignored, so it comes
from an Expo default and can only be proven from a built artifact. **Play's API 36 deadline was
2026-08-31 and is already past.** Also: `app.json` has no `extra.eas.projectId` while `eas.json`
sets `appVersionSource: remote`. Together ~30 minutes, and they gate the ability to ship *at all*.

### Collision register — same fix, specified twice

| Collision | Resolution |
|---|---|
| W0-01 vs W7-03 — strip TEST AD (`__DEV__` vs `__DEV__ \|\| web`) | Merge; W0-01's bundle-grep acceptance fails under W7-03's spec |
| W0-03 vs W2-02 — reduce motion, **different mechanisms** (thread a param into the pure curves vs pass `ReduceMotion.Never`) | Pick one. Neither references the other |
| W0-06 vs W7-11 — interstitial pacing persistence | W7-11 supersedes; fold W0-06 into it |
| W0-07 vs W5-02 — contrast repair (7 failures vs 6, two test files, two scripts) | Merge; only W5-02 catches the 1.16:1 border |
| W2 vs W5 — heart-refill pop, theme transition (**contradictory mechanisms**) | One owner each |
| W2 vs W5 — the exit trail's stroke width, modulated from two workstreams | Fix the resting value first |
| W0-04 + W0-05 — mutually dependent, neither verifiable alone | Ship as one commit |

### Missing work nobody owned

**CI** (nine suites today, plan adds ~eight more, no GitHub Action anywhere) · **a release step**
(W0's premise is "shipping right now" and no step cuts versionCode 7) · **`src/core/__tests__/saveSystem.test.ts`
does not exist** yet four steps name it as their verification command · **a rollback mechanism before
W6-08** (until then a regression needs a full Play review cycle to undo) · **a retrospective read**
once telemetry exists, against the W1/W3/W4 changes shipped blind · **web-renderer regression
coverage** (`react-native-web` is a direct dependency and `StaticBoardSurface.tsx` is the SVG twin) ·
**sound design** (DESIGN.md specifies audio behaviour and the working tree is mid-change on it) ·
**a shape-catalogue stability contract** (W4 persists collection bits keyed to catalogue order while
W3 may add ~14 and remove some — a reorder silently rewrites every player's collection) ·
**plan exit criteria** (~90 steps against a solo owner, one loaded Mac, one emulator, no physical
device on any platform).

### Two findings that change specific steps

**The reduce-motion defect is bigger than the Reanimated layer.** `reducedMotion` is a *field of the
native exit protocol* (`nativeExitAnimation.ts` serializes it as header token 3) and both native
renderers branch on it in their draw path. Under OS reduce motion the shipped exit is a **stationary
dash that fades linearly in place** — the arrowhead never translates. Nobody wrote that down and
nobody signed off on it. The census in W0-03/W2-02 is incomplete at its boundary.

**W1 and W3 both fix "level 1 is hostile" and may over-correct together.** W1 is premised on level 1
being a 60-arrow, 31.7%-clearable Circle (verified true today); W3 rebuilds level 1 to ~15–25 arrows.
If both land, the KDD *too-easy* hazard is the one nobody checked. They need a joint re-measurement.

---

## 5. The workstreams

Eight workstreams, ~90 steps. Effort: **S** <½ day · **M** 1–2 days · **L** 3–5 days · **XL** >1 week.
Full step detail — what/why/files/acceptance/verification/risk/rollback for every step — is in the
companion appendix; titles and efforts below.

### W0 — Stop the bleeding *(the four live defects + contrast)*
> *A player can no longer be shown a fake ad, get stuck on a dead screen, or be left without an
> explanation of why their tap failed.*

| ID | Step | Effort |
|---|---|---|
| W0-01 | Strip the simulated TEST AD out of production builds (`__DEV__` guard, verified by grepping the exported bundle) | S |
| W0-02 | Boot backstop: timer + AppState fallback so the app always reaches the menu; also fixes the unhandled `useFonts` error and the missing `.catch` on `initSaveSystem` | S |
| W0-03 | Reduce-motion players must still be told **which** arrow blocked them (a static magenta state, not a shorter animation) | M |
| W0-04 | A rewarded ad that cannot be served must say so, not fail silently | M |
| W0-05 | `initAds` must retry; a load failure must not disable ads for the whole session | S |
| W0-06 | Persist the interstitial counter; show one after a loss | M |
| W0-07 | Repair the palette roles that fail the contrast bar PRODUCT.md sets | M |
| W0-08 | Reconcile the missing `extra.eas.projectId` with `appVersionSource: remote` | S |

**Ordering note:** W0-01 must ship *with* W0-04, or a build whose `initAds` failed has a dead
"Continue +♥" button that does nothing.

### W1 — The first 90 seconds *(FTUE)*
> *A first-timer learns "tap fires the arrow" and "a blocked lane is why it failed" by doing both on
> two tiny hand-authored boards — while every returning player's launch is byte-for-byte unchanged.*

The determinism trap is solved by **not touching the generator at all**: the tutorial boards live in
a separate hand-authored lane.

| ID | Step | Effort |
|---|---|---|
| W1-01 | Measure the real board viewport, then derive the tutorial grid ceiling | S |
| W1-02 | Hand-authored tutorial boards in a lane that cannot touch the generator | M |
| W1-03 | First-run flag: one new int key + the migration that keeps existing players out | S |
| W1-04 | Route the first run — and prove a returning player executes none of it | S |
| W1-05 | Tutorial mode inside GameScreen: no ads, no stats writes, no win panel, auto-advance | M |
| W1-06 | The one contextual moment: the first blocked tap is free, and the only time words appear | M |
| W1-07 | Free stall hint — reuse the existing hint path; measure the delay before shipping it | M |
| W1-08 | Hand-off: on the first real board, mistakes made before your first success are free | M |
| W1-09 | Close the loop: fresh-install + over-install acceptance runs, plus the reduce-motion pass | M |

### W2 — The reward loop *(motion and feel)*
> *Every beat the player feels — finishing, losing a heart, running out — resolves as motion instead
> of a hard cut, and still plays with Reduce Motion on.*

| ID | Step | Effort |
|---|---|---|
| W2-01 | Make every feedback animation survive OS Reduce Motion | S |
| W2-02 | Make the perf harness measure real motion instead of the reduced-motion variant | M |
| W2-03 | Level → level transition: dip to the destination background instead of a hard cut | M |
| W2-04 | Win and lose panels enter and leave instead of appearing and vanishing | M |
| W2-05 | Make the loss slower than the win; stop the panel cutting off the blocker flash | S |
| W2-06 | Overlapping action on the blocked bump: let the magenta outlive the lunge | S |
| W2-07 | Measure whether the blocked bump is legible at fit zoom **before** anyone touches its amplitude | S |
| W2-08 | Hold the empty board after the final arrow leaves | M |
| W2-09 | Give the heart refill the pop the heart loss already has | S |
| W2-10 | Cross-dissolve the theme toggle instead of flipping the whole screen's luminance | S |
| W2-11 | Rewrite DESIGN.md's Motion section to describe what ships, with an honest budget | S |
| W2-12 | **DEFERRED** — visual combo escalation. The premise was false: the combo step never reaches the native payload, and the visible delta is ~2 physical pixels | — |

**The highest impact/cost item is W2-03**: the level→level hard cut fires every ~2 minutes, forever,
and DESIGN.md already specifies a transition that the RN port never built.

### W3 — Content and progression
> *The first board is small enough to survive learning the rule; boards grow measurably harder for
> thousands of levels; the picture-book silhouettes arrive in the first hour, not after level 160.*

| ID | Step | Effort |
|---|---|---|
| W3-01 | Level metrics harness; record the v1 baseline **before** anything changes | S |
| W3-02 | Measure the real board viewport and the minimum legible cell size on a device | S |
| W3-03 | Shape contact-sheet tool; delete the two dead `ShapeDef` fields | S |
| W3-04 | Split the shape RNG stream from the layout RNG stream | S |
| W3-05 | **Generator versioning and the determinism migration — the gate every content change lands behind** | M |
| W3-06 | Replace the blanket 46-row clamp with a legibility cap; fix the Bolt | M |
| W3-07 | Rebalance the shape pools: novelty schedule, no back-to-back repeats, demote the no-picture fills | M |
| W3-08 | First-session playtest that sets the on-ramp's starting value | M |
| W3-09 | Make `DifficultyConfig` a function of the level index | L |
| W3-10 | Stop the tier label from lying | S |
| W3-11 | Add silhouettes, weighted toward the ones the late curve can carry | S |

**W3-05 is the gate.** Levels are pure functions of the index and DESIGN.md makes that a hard
contract; any curve change re-generates boards under existing players mid-progress.

### W4 — The retention meta
> *A reason to come back tomorrow that survives closing the app: one fresh dated board a day, a
> streak that forgives, a growing gallery of solved silhouettes, one optional evening nudge.*

| ID | Step | Effort |
|---|---|---|
| W4-01 | **Versioned, additive save schema**: key registry, schema version, migration, wipe-risk tests | M |
| W4-02 | Measure the daily board's variety, size and **human solve time** before choosing its budget | S |
| W4-03 | Daily board: a deterministic date-seeded level drawn from all 26 silhouettes | M |
| W4-04 | Daily entry point, done-state and persisted daily record | M |
| W4-05 | Make the day streak visible and **forgiving** (free automatic freezes) instead of silent and punishing | S |
| W4-06 | Record solved silhouettes into a 26-bit collection mask | S |
| W4-07 | Shape gallery: a calm wall of solved silhouettes | L |
| W4-08 | Share artifact: a text card of today's board | S |
| W4-09 | One optional evening notification, asked for in context and never at first launch | M |
| W4-10 | Ask for a store review at a perfect clear, within both stores' rules | S |

**Explicitly rejected, with reasons:** energy/lives gating (a timer by another name) · paid streak
freezes (monetising anxiety in a bedtime product) · leagues and PvP ladders (needs accounts, a
backend and a consent layer that does not exist) · coin currencies and hint shops (a shop screen
inside "flow over menus") · seasonal FOMO events · level-select grids · arrow skins and theme packs
(PRODUCT.md forbids "decorative colour soup" — **collect shapes, not skins**).

**W4-01 is the highest-blast-radius step in the plan.** It ships alone, in its own release, verified
by an over-install screenshot showing "Level N" unchanged.

### W5 — Art direction
> *The player stops seeing a competent prototype — raw text glyphs, a placeholder dialog, a square
> board marooned in 442 dp of empty screen, a level that is secretly a cat and never says so.*

| ID | Step | Effort |
|---|---|---|
| W5-01 | Design-audit script: freeze the baseline numbers every later step is graded against | S |
| W5-02 | Real icon system: kill the five raw text glyphs; make the header buttons actually circular | M |
| W5-03 | Fix the four palette roles that fail **as information**, not as decoration | S |
| W5-04 | Depth by value, not by glow: an elevation ramp and a real panel | M |
| W5-05 | **Celebrate the silhouette: draw the shape the player just cleared, on the win panel** | M |
| W5-06 | Level card: give the top dead band a composed header instead of a run-on 12 pt string | M |
| W5-07 | Bottom dead band: a quiet progress rail, and a decision about the hint button | S |
| W5-08 | Win and loss panels: from placeholder dialog to the two moments the game has | M |
| W5-09 | Typography scale, and the counter that jitters because Fredoka has no tabular figures | M |
| W5-10 | Ad panel labels render in Roboto because `fontWeight` is set without `fontFamily` | S |
| W5-11 | Implement the corner fillet DESIGN.md specifies (and the code never had) | L |
| W5-12 | The exit trail is 1.81× the resting stroke — resolve it deliberately | S |
| W5-13 | Theme toggle: cross-fade the luminance flip | M |
| W5-14 | Paper/ink texture: a bounded spike with a kill switch, not a default | M |
| W5-15 | Store art: an icon audit and the phone screenshot set that does not exist | M |

**W5-05 is the thread that ties art to retention.** The silhouette is the single most ownable asset
in the product and the player never sees it — they clear a cat and are shown the word "Cat" in 12 pt.

### W6 — Instrumentation and verification
> *Nothing changes for the player. What changes is that every other workstream can prove its claim.*

| ID | Step | Effort |
|---|---|---|
| W6-01 | Typed event schema and a pluggable, no-op-by-default sink | S |
| W6-02 | Emit from real call sites, aggregated per level so a 250-arrow board costs no per-tap work | M |
| W6-03 | A separate persisted telemetry namespace, an install id, and a schema-version key | S |
| W6-04 | Transport: batched, anonymous, first-party ingest with an AppState flush | M |
| W6-05 | Privacy policy and Play Data safety updated **in the same release as the first byte sent** | S |
| W6-06 | One privacy seam in the ad layer: COPPA/CCPA/GDPR calls exist and are called from one place | S |
| W6-07 | Crash reporting phase A: native crashes via Play vitals, JS crashes via a persisted error event | M |
| W6-08 | Remote config and an ad kill switch, so tuning pacing stops costing a Play review cycle | M |
| W6-09 | Make `.tsx` testable: a second jest project alongside the core suite | M |
| W6-10 | Let the harness boot into splash and menu instead of only the game | S |
| W6-11 | Record `animator_duration_scale` in every result, and make it settable | S |
| W6-12 | Measure the pixel-difference floor before any effect-rendered assertion is armed | M |
| W6-13 | Phase recording, and an **effect-rendered gate** that runs before any number for a new effect is quoted | L |
| W6-14 | iOS capture path — specified now, blocked on the iOS board view compiling | L |

**W6 must come early.** Every other workstream's acceptance criteria are unfalsifiable without it,
and this project's own rule is that a number in a brief must name the measurement that produced it.

### W7 — Monetisation, compliance and platform
> *A player in the EEA/UK is asked for ad consent before any ad SDK touches their device, can find
> the policy and a support contact, and meets a listing that actually describes the game.*

**Items 01–10 are legal / listing exposure, not optimisation.** They belong in Phase 0.

| ID | Step | Effort |
|---|---|---|
| W7-01 | Consent state module + LevelPlay privacy API wiring (CMP-agnostic half) | M |
| W7-02 | Consent UI: integrate a Google-certified CMP | L |
| W7-03 | Stop shipping the simulated TEST AD modal to real players; retry ad init *(= W0-01/05)* | S |
| W7-04 | **Settings sheet** — the missing surface for policy, consent re-prompt and support | M |
| W7-05 | Rewrite the privacy policy and make it single-source | S |
| W7-06 | Reconcile the Play Data safety form against what the binary actually does | S |
| W7-07 | Make the age story consistent across binary, policy and console | S |
| W7-08 | Prove target API 36 from the uploaded artifact, not the toolchain default *(Play deadline 2026-08-31)* | S |
| W7-09 | Store-account declarations: **EU DSA trader status** and the console compliance set | S |
| W7-10 | Link the EAS project *(= W0-08)* | S |
| W7-11 | Interstitial pacing: persist the counter, wall-clock cooldown, session cap, new-player grace | M |
| W7-12 | Establish an ad baseline from LevelPlay's own data **before** tuning anything | S |
| W7-13 | Give the waterfall more than one demand source *(today "mediation" has exactly one)* | L |
| W7-14 | Play listing screenshots — there are none, and Play requires at least two | S |
| W7-15 | Two listings, two copy sets — and a title that is not the bare word "Arrows" | S |
| W7-16 | Settle icon/screenshot questions with the stores' **free A/B surfaces**, not taste | S |
| W7-17 | iOS ads prerequisites (ATT, SKAdNetwork, a currently-false privacy manifest) — ships with W8 | M |

**Recommendation: no IAP yet.** Block Blast's ~$66k lifetime IAP against ~$1M/day in ad revenue says
placement tuning outranks an SKU ladder at this stage, and an IAP adds a new native dependency to a
project whose native build is already fragile.

### W8 — iOS
> *Split into a cheap "keep it buildable and honest" tranche now, and a deferred "ship it" tranche
> that does not start until the Android retention work has shown the product is worth duplicating.*

**Tranche 1 — do now (cheap, and stops the rot):**

| ID | Step | Effort |
|---|---|---|
| W8-01 | First compile of the iOS app from a clean prebuild; record the baseline | S |
| W8-02 | Simulator smoke: prove the board renders and the slither exit is correct | S |
| W8-03 | Measure the `draw(_:)` memory baseline **before** refactoring anything | S |
| W8-04 | Replace `draw(_:)` with two retained `CAShapeLayer`s | M |
| W8-05 | Visual parity gate for the refactor — **this step can veto W8-04** | S |
| W8-06 | iOS feedback module smoke: audio bundle resolution and haptics | S |
| W8-07 | Build iOS perf measurement infrastructure, or explicitly downgrade the claim | L |
| W8-08 | Physical-iPhone perf run, gates re-derived per device | **BLOCKED — no device** |

**Tranche 2 — deferred until Android retention lands:** W8-09 ATT/SKAdNetwork/privacy manifest ·
W8-10 per-platform LevelPlay keys · W8-11 iPad decision · W8-12 App Store Connect + EAS pipeline ·
W8-13 iOS inherits the consent solution (**ATT is not GDPR consent**) · W8-14 document the
iOS/Android cloud-save asymmetry.

**Why deferred:** the Monument Valley "73% of revenue from iOS" argument is a *premium* argument.
Arrows is ad-monetised, and on iOS without ATT consent the IDFA is unavailable and mediated eCPM is
gutted — so the structural iOS advantage does not transfer to this business model. Also found:
`app.json` says `orientation: 'portrait'` but the generated Info.plist already declares **both iPad
landscape orientations**, so the app would ship landscape-capable on a layout never run on an iPad.

---

## 6. Sequencing

Corrected against the red team. Three constraints drive it: **an instrument must exist before the
thing it measures**; **save and generator changes touch existing players**; **some compliance items
are shipping blockers, not optimisations**.

**Phase 0 — Can we even ship? (days)**
P-00 land the tree · P-04 shipping preconditions · P-03 decide what the game is · P-01 persistence
schema *(own release)* · W7-02 GATE 0 — a spike proving the chosen CMP compiles on RN 0.86.3 + new
arch, because its answer reshapes W7-13, W8-09, W8-10 and W8-13.

**Phase 1 — Stop the bleeding**
W0-01+W0-05+W7-03 *(merged)* · W0-02 · W0-03 *(mechanism chosen; census extended to the native exit
protocol)* · W0-04 *(same commit as W0-05)* · W0-07+W5-02 *(merged)* · **W6-08 remote kill switch —
pulled forward: it is the only rollback that does not cost a Play review cycle.**

**Phase 2 — Instruments before the things they measure**
P-02 capture harness · W6-01…W6-06 telemetry + the privacy seam · W6-09 `.tsx` testability
*(prerequisite for tests in W0-04, W1-05, W2-06, W4-05, W4-07, W5-08 — all of which currently say
"screenshots only")* · W6-10…W6-13 · W3-01, W3-02 baselines · W7-12 ad baseline **before** any
pacing change.

**Phase 3 — The first 90 seconds**
W1-02…W1-06, W1-08, W1-09 · W7-01/W7-02 consent *(legal exposure; live right now)* · W7-14 screenshots.

**Phase 4 — A reason to come back**
W4-02…W4-06 · W4-09, W4-10 · W5-05 silhouette celebration.

**Phase 5 — The curve** *(behind the W3-05 generator-version gate)*
W3-04, W3-06, W3-07, W3-09…W3-11 · **joint re-measurement of W1+W3 on level 1** · W4-07, W4-08.

**Phase 6 — Surface and reach**
W5 remainder · W7 remainder · W8 tranche 1 · **retrospective telemetry read against everything
shipped blind in Phases 3–5.**

### If you only do 20%

The scope reviewer's cut, defended: **P-00, P-04, P-01, P-03 · W0-01+05+W7-03, W0-02, W0-03, W0-04,
W0-07 · W6-08 · W1-02…W1-06, W1-08 · W4-03, W4-05 · W3-02, W3-06 · W7-01, W7-02, W7-14.**
That is ~26 steps. It fixes what is actively broken, gives a new player a first 90 seconds, gives
everyone a reason to return tomorrow, and closes the legal exposure — and it defers every step whose
value cannot be observed yet.

### Plan exit criteria

Define these before starting, or the plan has no end: which retention/funnel numbers must move, by
how much, measured over what window, on which build. Until W6 lands, **none of them exist** — so the
honest exit criterion for Phases 0–2 is *"the instruments report, and the four live defects are gone,
verified on device."*

---

## 7. Invented-number register

This project has been burned 6+ times by a brief pinning a number nobody measured. The evidence
auditor re-ran the plan's own scripts and found roughly **45 of ~80 steps carry a picked number**.
These must each become "measure first, then decide" — they are *not* approved values:

`SPLASH_MAX_MS = 4000` · the `initAds` retry schedule 3×(5s/15s/45s) · the blocked-bump anticipation
magnitude · shape-pool size ≈ 40 · gallery tile ≈ 20 dp and 14-row rasterization · share-card
12-column downsample / ≤240 chars · notification hour 20:30 and the 3-day cutoff · review-prompt gate
at 25 solves · silhouette badge at 20 dp / 64 dp · W5-07's 15 dp clearance · W8-04's memory gates
(20% / 25% of a baseline W8-03 has not yet produced) · W8-07's "two runs within 15%" · W6-08's
`gamesPerInterstitial` clamp of 10 · W1-08's "exactly 1 free level".

Also unresolved: **`adb screenrecord`'s real frame period on the API 31 emulator is unmeasured**, yet
eleven acceptance criteria across W2 are stated in frame counts against it. And **no perf A/B in the
plan states a minimum detectable effect**, despite the 2026-09-08 record being cited repeatedly as
proof that absolute gates are unevaluable on a loaded host.

---

## 8. Decisions that need you

Each carries a recommendation; none should be decided by an engineer mid-implementation.

| # | Decision | Recommendation |
|---|---|---|
| 1 | **Track A or Track B** — accept the attention game, or add a real ordering constraint? | **Track A now.** Revisit B only after Track A is measured. |
| 2 | Do `Square`/`Rectangle` stay in the pool at all, given they deliver no picture? | Demote, don't delete — DESIGN.md explicitly blesses them |
| 3 | Derive the difficulty tier label from measured metrics, or remove it? | **Remove or derive** — measured tier bands overlap almost completely (Normal 57–116, Hard 102–197, Super Hard 54–209 arrows) |
| 4 | Approve the tutorial copy — this adds instructional text to a game that has none | Approve, but keep it colour-independent ("clear the arrow in its way", not "the pink one") |
| 5 | Show a paced interstitial after a **loss**, not only a win? | Yes, but never in the same beat as the rewarded "Continue +♥" |
| 6 | When no rewarded ad can be served, grant the hint free? | **Yes** — it is the only teaching aid a new player can reach |
| 7 | Does the shape gallery violate "cluttered level-select grids"? | No, if it is non-tappable, has no level numbers, and cannot be played from |
| 8 | Build DESIGN.md's unbuilt "Solved!"/"Perfect!" toast, or delete it from the doc? | **Delete it** — the win panel already says all of it |
| 9 | `ios.supportsTablet: true` obliges a 13" iPad screenshot set for a build that does not compile | **Flip to false** until an iPad build is scheduled |
| 10 | Buy one mid-range physical Android handset? | **Yes.** The emulator's software GPU is the largest unknown in every number this project has |
| 11 | Ship an evening push notification at all? | **Gate it.** The step's own evidence argues against: gaming is the worst push vertical (<1% CTR), uninstall risk rises sharply at 2–5/week, and JMIR found evening use decays fastest. It is a pressure channel in a product whose purpose is the absence of pressure |
| 12 | Promote the day streak to its own element on the menu? | **No** — DESIGN.md deliberately keeps streaks in one quiet `ink-dim` line shown only from 2 up. Ship the *forgiveness*, not the prominence |
| 13 | Get the privacy policy, Data safety answers and DSA trader declaration legally reviewed? | **Yes**, scoped to those three artefacts. They are the only items whose failure mode is regulatory or listing removal rather than lost revenue |
| 14 | Add a remove-ads IAP? | **Not yet.** Block Blast: ~$66k lifetime IAP against ~$1M/day in ads. Tune placement first |
| 15 | Sequence iOS now, or after Android retention lands? | **After.** The Monument Valley iOS argument is a *premium* argument; Arrows is ad-monetised, and without ATT consent the IDFA is unavailable and iOS eCPM is gutted. Do tranche 1 (make it compile) now, defer tranche 2 |

---

## 9. Open verification gaps

Carry this list forward; do not let an item sit here silently across sessions.

1. **No physical device on any platform.** Every perf number is one API 31 emulator, on a host whose
   load already made absolute gates unevaluable once. Only paired differences are meaningful.
2. **iOS is entirely unverified** — the native board view has not compiled since 2026-09-01.
3. **No visual verification exists.** Every motion and art step in W2/W5 closes only on a
   simulator/device screenshot or recording. This repo has a scar from transform fixes verified by
   `tsc` alone; W6-13 builds the gate that closes it.
4. **No analytics.** Every retention claim in §2 is external evidence about *other* games. Nothing
   here is measured on Arrows' own players until W6 lands.
5. **The reduce-motion blackout is verified by computation, not on device.** The mechanism is certain
   (all three curves evaluate to 0 at k=1, which is where Reanimated jumps); the on-device
   observation is still owed.
6. **W4-02's human solve time is unmeasured** and n=1 expert when it is measured — it will understate
   a new player's time. Record the caveat rather than treating it as the new-player number.
7. **`adb screenrecord`'s real frame period on the API 31 emulator is unmeasured**, yet eleven W2
   acceptance criteria are stated in frame counts against it.
8. **The O(n) `visibleMask` rebuild is the largest per-event cost in the architecture and nobody
   measures it.** Every blocked tap adds and then removes the tapped arrow from `excludedArrows`,
   triggering it twice — and W0-03, W2-07 and W6-02 all ship changes on that exact path.
9. **The historical `exit`-phase perf numbers were taken at `animator_duration_scale 0`** — i.e. of
   the *reduced-motion* variant, not the shipping one. No step reconciles them; treat the
   2026-09-01 and 2026-09-08 exit columns as measuring a different effect than the one that ships.
10. **`withDecay` (pan momentum) was never included in the reduce-motion census.** It takes a
    `reduceMotion` key like every other Reanimated animation.
11. **`board.arrows()` returns the live internal array** (`return this._arrows`), spliced in place —
    so its reference never changes and every memo keyed on it depends on `arrowCount` instead. Any
    new memo in this area needs that stated explicitly or it will silently never recompute.

---

*Companion memory: `game-design-truths-measured`, `shipping-defects-found-2026-09-09`,
`perf-architecture-and-evidence`, `tap-forgiveness-and-verification-gaps`.*
