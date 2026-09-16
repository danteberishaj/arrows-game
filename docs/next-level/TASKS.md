# Arrows next-level — execution index

Branch `next-level`, base commit `da93dcd`. Integrated 2026-09-16 from `docs/next-level/tasks/{P,W0…W8}.md` and `docs/NEXT-LEVEL-PLAN.md`, under the owner rulings of 2026-09-16 and the controller rulings recorded in `docs/next-level/progress.md`. Nothing here is merged to `main`, pushed, published or released without an explicit owner yes.

**How to read this file.** One row per task. *Depends on* lists hard dependencies only (ids that must be done first); a parenthesis adds a soft or partial dependency. *Phase* is the execution phase below, not the workstream. Status values: READY (agent work can start once its dependencies are done), BLOCKED-ON-OWNER, BLOCKED-ON-DISK, BLOCKED-ON-DEVICE, CUT. A READY task whose dependency is an owner gate is still READY; the serial order marks the wait. Every new player-visible feature ships behind a flag defaulted OFF.

**Ids.** Every id in this file is a *consolidated* id. The owner and controller rulings of 2026-09-16 were written against the *draft* ids in `docs/NEXT-LEVEL-PLAN.md`, and many were renumbered. Examples: the rulings' "W0-03 reduce motion" is W0-04 here; "W0-04 + W0-05 as one task" is W0-02; "W0-07 contrast" is W0-06; "W7-11 cut except persistence" is W0-05, while W7-11 here is the plan's W7-12 ad baseline; "W7-03 test ad" is merged into W0-01/W0-02, while W7-03 here is the CMP integration. Each task file's "Merged from" line gives the mapping.

**Shared artifacts.** Build outputs and evidence that later tasks reuse live under the gitignored `artifacts/` directory (P-04a creates it), never only in a session scratchpad: `artifacts/base/da93dcd-release-arm64.apk` is the base APK for P-01, W0 and W7-02, and W0 evidence lives under `artifacts/w0/`.

**Counts:** READY 91 · BLOCKED-ON-OWNER 38 · BLOCKED-ON-DISK 7 · BLOCKED-ON-DEVICE 2 · CUT 7 · total 145 ids (138 live).

Validated by the integrator on 2026-09-16 (script output in `progress.md`): every depends-on id exists and none is CUT; the dependency graph is acyclic; no hard dependency points to a later phase except W1-11 → W3-12/W3-17, which gates only the `FTUE_ASSIST_ENABLED` flip; the serial order respects every READY dependency and never moves backwards through phases; only P-01 edits `PersistenceKeys` or the `storage.test.ts` key assertion; only P-02 (with its iOS parts P-02b/P-02c) builds a capture instrument.

## Phase 0 — Can we ship

**Exit criterion:** P-01 over-install verified on the emulator, targetSdk ≥ 36 read from a built artifact, PRODUCT.md Track A diff accepted by the owner, CI replica green locally, CMP GATE 0 verdict written; P-04b sits in the Owner queue.

| ID | Title | Status | Effort | Depends on | Phase | Section |
|---|---|---|---|---|---|---|
| P-04a | Prove targetSdk from a locally built release artifact | READY | S | — | 0 | [P.md](tasks/P.md#p-04a--prove-targetsdk-from-a-locally-built-release-artifact) |
| P-04c | Set `ios.supportsTablet` to false | READY | S | — | 0 | [P.md](tasks/P.md#p-04c--set-iossupportstablet-to-false) |
| P-03 | Rewrite PRODUCT.md for Track A and correct DESIGN.md's measured-false claims | READY | M | — | 0 | [P.md](tasks/P.md#p-03--rewrite-productmd-for-track-a-and-correct-designmds-measured-false-claims) |
| P-01 | Own the save schema: one key registry, one schema version, one additive migration | READY | M | — | 0 | [P.md](tasks/P.md#p-01--own-the-save-schema-one-key-registry-one-schema-version-one-additive-migration) |
| P-05 | CI: run jest and tsc on every push to `next-level` | READY | S | — (soft: after P-01 so CI covers its tests) | 0 | [P.md](tasks/P.md#p-05--ci-run-jest-and-tsc-on-every-push-to-next-level) |
| W7-02 | GATE 0: prove a certified CMP compiles and runs on RN 0.86.3 with the new architecture | READY | M | — | 0 | [W7.md](tasks/W7.md#w7-02--gate-0-prove-a-certified-cmp-compiles-and-runs-on-rn-0863-with-the-new-architecture) |
| P-04b | Link the EAS project and reconcile the remote versionCode | BLOCKED-ON-OWNER | S | P-04a | 0 | [P.md](tasks/P.md#p-04b--link-the-eas-project-and-reconcile-the-remote-versioncode) |

## Phase 1 — Stop the bleeding

**Exit criterion:** W0-07 passes every W0 criterion on one hashed release APK including an over-install, and W6-02 flips both directions on the emulator with its flag OFF by default; W0-08 is in the Owner queue.

| ID | Title | Status | Effort | Depends on | Phase | Section |
|---|---|---|---|---|---|---|
| W0-01 | Strip the simulated TEST AD out of production builds | READY | S | — | 1 | [W0.md](tasks/W0.md#w0-01--strip-the-simulated-test-ad-out-of-production-builds) |
| W0-02 | Make rewarded ads honest when no ad can be served, and make ad init recoverable | READY | M | W0-01 | 1 | [W0.md](tasks/W0.md#w0-02--make-rewarded-ads-honest-when-no-ad-can-be-served-and-make-ad-init-recoverable) |
| W0-03 | Boot backstop: the app must always reach the menu | READY | S | — | 1 | [W0.md](tasks/W0.md#w0-03--boot-backstop-the-app-must-always-reach-the-menu) |
| W0-04 | Reduce-motion players must still see which arrow blocked them | READY | M | — | 1 | [W0.md](tasks/W0.md#w0-04--reduce-motion-players-must-still-see-which-arrow-blocked-them) |
| W0-05 | Persist the interstitial pacing counter across cold start | READY | S | P-01, W0-01, W0-02 | 1 | [W0.md](tasks/W0.md#w0-05--persist-the-interstitial-pacing-counter-across-cold-start) |
| W0-06 | Make every text and state colour meet PRODUCT.md's contrast bar, locked by a test | READY | L | W0-02 | 1 | [W0.md](tasks/W0.md#w0-06--make-every-text-and-state-colour-meet-productmds-contrast-bar-locked-by-a-test) |
| W0-07 | Verify every W0 fix together on one release artifact, including an over-install | READY | M | P-01, W0-01, W0-02, W0-03, W0-04, W0-05, W0-06 | 1 | [W0.md](tasks/W0.md#w0-07--verify-every-w0-fix-together-on-one-release-artifact-including-an-over-install) |
| W6-02 | Add a remote kill switch for ads and telemetry (client side) | READY | M | P-01, W0-01, W0-02, W0-05 | 1 | [W6.md](tasks/W6.md#w6-02--add-a-remote-kill-switch-for-ads-and-telemetry-client-side) |
| W0-08 | Cut and submit the W0 release | BLOCKED-ON-OWNER | S | W0-07, P-04a, P-04b, P-04c | 1 | [W0.md](tasks/W0.md#w0-08--cut-and-submit-the-w0-release) |
| W6-03 | Host the kill-switch config file and prove its caching by observation | BLOCKED-ON-OWNER | S | W6-02 | 1 | [W6.md](tasks/W6.md#w6-03--host-the-kill-switch-config-file-and-prove-its-caching-by-observation) |

## Phase 2 — Instruments before what they measure

**Exit criterion:** P-02 calibration doc published (or its kill condition recorded), mask-rebuild doc and v1 probe baseline + corpus fingerprint committed, no-op telemetry wired with a PASS/REGRESSION/UNEVALUABLE A/B verdict, `.tsx` spike verdict recorded.

| ID | Title | Status | Effort | Depends on | Phase | Section |
|---|---|---|---|---|---|---|
| P-02 | Build one capture instrument: boot into any screen, set and read back motion settings, record, and prove an effect rendered | READY | XL | — | 2 | [P.md](tasks/P.md#p-02--build-one-capture-instrument-boot-into-any-screen-set-and-read-back-motion-settings-record-and-prove-an-effect-rendered) |
| W6-01 | Measure the O(n) visibleMask rebuild on the blocked-tap path before anyone changes that path | READY | M | — | 2 | [W6.md](tasks/W6.md#w6-01--measure-the-on-visiblemask-rebuild-on-the-blocked-tap-path-before-anyone-changes-that-path) |
| W3-01 | Build the difficulty probe and check in the v1 baseline | READY | M | — | 2 | [W3.md](tasks/W3.md#w3-01--build-the-difficulty-probe-and-check-in-the-v1-baseline) |
| W3-02 | Widen the fill/solve net and fingerprint the whole v1 corpus | READY | S | — | 2 | [W3.md](tasks/W3.md#w3-02--widen-the-fillsolve-net-and-fingerprint-the-whole-v1-corpus) |
| W6-04 | Define a typed event schema and a pluggable sink that does nothing by default | READY | S | — | 2 | [W6.md](tasks/W6.md#w6-04--define-a-typed-event-schema-and-a-pluggable-sink-that-does-nothing-by-default) |
| W6-05 | Add telemetry identity accessors on P-01's int keys, and document Auto Backup behaviour | READY | S | P-01, W6-04 | 2 | [W6.md](tasks/W6.md#w6-05--add-telemetry-identity-accessors-on-p-01s-int-keys-and-document-auto-backup-behaviour) |
| W6-06 | Emit level, session, ad and screen events from the real call sites, aggregated per level | READY | M | W0-01, W0-02, W0-05, W6-01, W6-02, W6-04, W6-05 (coordinate: W2-06 `onRemoved` signature) | 2 | [W6.md](tasks/W6.md#w6-06--emit-level-session-ad-and-screen-events-from-the-real-call-sites-aggregated-per-level) |
| W6-07 | Record JS fatals into int keys and emit them on the next cold start | READY | M | P-01, W6-04, W6-06 | 2 | [W6.md](tasks/W6.md#w6-07--record-js-fatals-into-int-keys-and-emit-them-on-the-next-cold-start) |
| W6-08 | Prove native crash stacks are symbolicated for a minified release build | READY | S | — | 2 | [W6.md](tasks/W6.md#w6-08--prove-native-crash-stacks-are-symbolicated-for-a-minified-release-build) |
| W6-10 | Spike: can `.tsx` components be tested on Expo 57 / RN 0.86.3 / React 19.2.3? | READY | S | — | 2 | [W6.md](tasks/W6.md#w6-10--spike-can-tsx-components-be-tested-on-expo-57--rn-0863--react-1923) |
| W6-11 | Add a `.tsx` jest project and two component tests that pin real contracts | READY | M | W0-02, W6-06, W6-10 | 2 | [W6.md](tasks/W6.md#w6-11--add-a-tsx-jest-project-and-two-component-tests-that-pin-real-contracts) |
| W6-12 | Write the decision rules each metric must resolve, before any data exists | READY | S | W6-04 | 2 | [W6.md](tasks/W6.md#w6-12--write-the-decision-rules-each-metric-must-resolve-before-any-data-exists) |
| W6-13 | Draft the analytics disclosure: policy section, Data safety mapping and endpoint data rules | READY | S | W6-02, W6-04, W6-05 | 2 | [W6.md](tasks/W6.md#w6-13--draft-the-analytics-disclosure-policy-section-data-safety-mapping-and-endpoint-data-rules) |
| W6-14 | Write the batched HTTP transport client, shipped with the flag OFF and no endpoint | READY | M | W6-02, W6-04, W6-05, W6-06 | 2 | [W6.md](tasks/W6.md#w6-14--write-the-batched-http-transport-client-shipped-with-the-flag-off-and-no-endpoint) |
| W6-09 | Confirm Play Console deobfuscates native crashes for the shipped versionCode | BLOCKED-ON-OWNER | S | W6-08 | 2 | [W6.md](tasks/W6.md#w6-09--confirm-play-console-deobfuscates-native-crashes-for-the-shipped-versioncode) |
| W7-11 | Establish an ad baseline from LevelPlay's own data before anything is tuned | BLOCKED-ON-OWNER | S | — (comparison half needs W0-08 released) | 2 | [W7.md](tasks/W7.md#w7-11--establish-an-ad-baseline-from-levelplays-own-data-before-anything-is-tuned) |

## Phase 3 — First 90 seconds

**Exit criterion:** W1-10 owner packet (scenarios A–F) delivered with every W1 flag still OFF, W2-01 census test green with the reduced-motion exit recording ruled on, W2-03 fixed, W7-01 consent module landed with `CONSENT_GATE` OFF.

| ID | Title | Status | Effort | Depends on | Phase | Section |
|---|---|---|---|---|---|---|
| W1-01 | Measure the board viewport, then derive the tutorial grid ceiling | READY | S | — | 3 | [W1.md](tasks/W1.md#w1-01--measure-the-board-viewport-then-derive-the-tutorial-grid-ceiling) |
| W1-02 | Author the tutorial boards T1 and T2 without calling the generator | READY | M | W1-01 | 3 | [W1.md](tasks/W1.md#w1-02--author-the-tutorial-boards-t1-and-t2-without-calling-the-generator) |
| W1-03 | Add FTUE stage accessors and a pure first-run route that keeps returning players out | READY | S | P-01, W1-02 | 3 | [W1.md](tasks/W1.md#w1-03--add-ftue-stage-accessors-and-a-pure-first-run-route-that-keeps-returning-players-out) |
| W1-04 | Add tutorial mode inside GameScreen: first Play lands on T1, with no ads, no stats, no panels, and auto-advance | READY | M | W0-01, W1-02, W1-03 | 3 | [W1.md](tasks/W1.md#w1-04--add-tutorial-mode-inside-gamescreen-first-play-lands-on-t1-with-no-ads-no-stats-no-panels-and-auto-advance) |
| W1-05 | Teach the blocked-lane rule at first encounter: first blocked tap on T2 is free, with copy for owner approval | READY | M | W0-04, W1-04 | 3 | [W1.md](tasks/W1.md#w1-05--teach-the-blocked-lane-rule-at-first-encounter-first-blocked-tap-on-t2-is-free-with-copy-for-owner-approval) |
| W1-06 | On real boards, make blocked taps before a board's first successful removal free, until the player's first perfect clear | READY | M | W1-03, W1-04, W1-05 | 3 | [W1.md](tasks/W1.md#w1-06--on-real-boards-make-blocked-taps-before-a-boards-first-successful-removal-free-until-the-players-first-perfect-clear) |
| W1-07 | Add a stall hint on tutorial boards (code behind a flag; delay unset) | READY | S | W0-04, W1-04 | 3 | [W1.md](tasks/W1.md#w1-07--add-a-stall-hint-on-tutorial-boards-code-behind-a-flag-delay-unset) |
| W1-08 | Add a dev-only session log for the first-time-player playtest | READY | S | W1-04 | 3 | [W1.md](tasks/W1.md#w1-08--add-a-dev-only-session-log-for-the-first-time-player-playtest) |
| W2-01 | Finish the reduce-motion census: remaining Reanimated sites, `withDecay`, web exit trail, native exit protocol | READY | M | P-02, W0-03, W0-04 | 3 | [W2.md](tasks/W2.md#w2-01--finish-the-reduce-motion-census-remaining-reanimated-sites-withdecay-web-exit-trail-native-exit-protocol) |
| W2-02 | Record the signed-off reduce-motion contract and reduced-motion exit look in DESIGN.md | READY | S | P-03, W2-01 | 3 | [W2.md](tasks/W2.md#w2-02--record-the-signed-off-reduce-motion-contract-and-reduced-motion-exit-look-in-designmd) |
| W2-03 | The lose panel must wait until the blocker flash has finished explaining the fatal mistake | READY | S | P-02, W0-04 | 3 | [W2.md](tasks/W2.md#w2-03--the-lose-panel-must-wait-until-the-blocker-flash-has-finished-explaining-the-fatal-mistake) |
| W7-01 | Add a consent state module and send LevelPlay's privacy calls before init | READY | M | P-01, W0-01, W0-02, W0-05 | 3 | [W7.md](tasks/W7.md#w7-01--add-a-consent-state-module-and-send-levelplays-privacy-calls-before-init) |
| W1-10 | Run the workstream acceptance captures and build the owner review packet | READY | M | P-02, W0-01, W0-04, W1-04, W1-05, W1-06, W1-07 | 3 | [W1.md](tasks/W1.md#w1-10--run-the-workstream-acceptance-captures-and-build-the-owner-review-packet) |
| W1-09 | Run the first-time-player playtest | BLOCKED-ON-OWNER | M | W1-04, W1-05, W1-06, W1-07, W1-08 | 3 | [W1.md](tasks/W1.md#w1-09--run-the-first-time-player-playtest) |
| W1-11 | Owner acceptance: approve the copy, the rules and the delay, then flip the flags | BLOCKED-ON-OWNER | S | W1-10, W3-12, W3-17 (W3-12 and W3-17 gate only the `FTUE_ASSIST_ENABLED` flip) | 3 | [W1.md](tasks/W1.md#w1-11--owner-acceptance-approve-the-copy-the-rules-and-the-delay-then-flip-the-flags) |
| W7-03 | Integrate the chosen CMP behind the consent gate | BLOCKED-ON-OWNER | L | P-02, W0-03, W7-01, W7-02 | 3 | [W7.md](tasks/W7.md#w7-03--integrate-the-chosen-cmp-behind-the-consent-gate) |

## Phase 4 — A reason to come back

**Exit criterion:** Every approved W4 surface (forgiving streak, daily, gallery, review prompt) and the W5 win-panel silhouette built behind OFF flags with capture packets in front of the owner; share card only prepared (owner has not ruled).

| ID | Title | Status | Effort | Depends on | Phase | Section |
|---|---|---|---|---|---|---|
| W4-01 | Freeze the shape catalogue as an append-only save-format contract | READY | S | — | 4 | [W4.md](tasks/W4.md#w4-01--freeze-the-shape-catalogue-as-an-append-only-save-format-contract) |
| W5-01 | Add a pure mask-to-outline function for silhouettes, and a sheet renderer to size them | READY | M | — | 4 | [W5.md](tasks/W5.md#w5-01--add-a-pure-mask-to-outline-function-for-silhouettes-and-a-sheet-renderer-to-size-them) |
| W4-02 | Make the day streak forgiving with free automatic freezes, keeping it in the quiet stats line | READY | M | P-01 | 4 | [W4.md](tasks/W4.md#w4-02--make-the-day-streak-forgiving-with-free-automatic-freezes-keeping-it-in-the-quiet-stats-line) |
| W4-03 | Build a date-seeded daily board in its own seed namespace, with a versioned shape pool | READY | M | W4-01 | 4 | [W4.md](tasks/W4.md#w4-03--build-a-date-seeded-daily-board-in-its-own-seed-namespace-with-a-versioned-shape-pool) |
| W4-04 | Add a dev-only time-to-clear instrument | READY | S | W4-03 | 4 | [W4.md](tasks/W4.md#w4-04--add-a-dev-only-time-to-clear-instrument) |
| W4-06 | Add the daily board entry, route and done-state | READY | M | P-01, P-02, W4-02, W4-03 | 4 | [W4.md](tasks/W4.md#w4-06--add-the-daily-board-entry-route-and-done-state) |
| W4-07 | Record solved silhouettes into the collection, with an incremental version-aware fold | READY | M | P-01, W4-01, W4-06 | 4 | [W4.md](tasks/W4.md#w4-07--record-solved-silhouettes-into-the-collection-with-an-incremental-version-aware-fold) |
| W4-08 | Measure silhouette legibility at gallery sizes before choosing tile size and raster rows | READY | S | W4-01, W5-01 | 4 | [W4.md](tasks/W4.md#w4-08--measure-silhouette-legibility-at-gallery-sizes-before-choosing-tile-size-and-raster-rows) |
| W4-09 | Build the shape gallery: a calm, non-tappable wall of solved silhouettes | READY | M | P-02, W0-06, W4-07, W4-08, W5-01 | 4 | [W4.md](tasks/W4.md#w4-09--build-the-shape-gallery-a-calm-non-tappable-wall-of-solved-silhouettes) |
| W4-10 | Compose the menu with every W4 entry enabled, and count the words | READY | S | P-02, W4-02, W4-06, W4-09 | 4 | [W4.md](tasks/W4.md#w4-10--compose-the-menu-with-every-w4-entry-enabled-and-count-the-words) |
| W4-11 | Request a store review at a perfect clear, within both stores' rules | READY | M | P-01, W1-03, W4-02 | 4 | [W4.md](tasks/W4.md#w4-11--request-a-store-review-at-a-perfect-clear-within-both-stores-rules) |
| W4-12 | Render candidate share cards so the owner can rule on the share artifact | READY | S | W4-01, W4-03 | 4 | [W4.md](tasks/W4.md#w4-12--render-candidate-share-cards-so-the-owner-can-rule-on-the-share-artifact) |
| W5-04 | Show the cleared silhouette on the win panel | READY | S | P-02, W5-01 (soft: rebase with W2-05 (same JSX)) | 4 | [W5.md](tasks/W5.md#w5-04--show-the-cleared-silhouette-on-the-win-panel) |
| W4-05 | Record expert time-to-clear on daily boards (not a first-session claim) | BLOCKED-ON-OWNER | S | W4-03, W4-04 | 4 | [W4.md](tasks/W4.md#w4-05--record-expert-time-to-clear-on-daily-boards-not-a-first-session-claim) |
| W4-13 | Add the share card to the daily win panel | BLOCKED-ON-OWNER | S | W4-06, W4-12 | 4 | [W4.md](tasks/W4.md#w4-13--add-the-share-card-to-the-daily-win-panel) |

## Phase 5 — The curve

**Exit criterion:** v2 frozen by its own fingerprint and the W3-21 over-install recording delivered with `GEN_V2_ENABLED` still false; the joint W1+W3 level-1 re-measurement (W3-12 sweep, W3-17 playtest) reported.

| ID | Title | Status | Effort | Depends on | Phase | Section |
|---|---|---|---|---|---|---|
| W3-03 | Delete the two dead `ShapeDef` fields | READY | S | W3-02 | 5 | [W3.md](tasks/W3.md#w3-03--delete-the-two-dead-shapedef-fields) |
| W3-04 | Build the shape preview and contact-sheet tool | READY | S | W3-01 | 5 | [W3.md](tasks/W3.md#w3-04--build-the-shape-preview-and-contact-sheet-tool) |
| W3-05 | Add the generator version seam with one per-install switch level | READY | M | P-01, W3-02, W4-01 | 5 | [W3.md](tasks/W3.md#w3-05--add-the-generator-version-seam-with-one-per-install-switch-level) |
| W3-06 | Add a dev-only level and generator-version jump, and tag the session log with the version | READY | S | W1-08, W3-05 | 5 | [W3.md](tasks/W3.md#w3-06--add-a-dev-only-level-and-generator-version-jump-and-tag-the-session-log-with-the-version) |
| W3-08 | Capture the legibility screenshot set and the cellPt table | READY | S | W1-01, W3-01, W3-06 | 5 | [W3.md](tasks/W3.md#w3-08--capture-the-legibility-screenshot-set-and-the-cellpt-table) |
| W3-10 | Give v2 a capacity-aware shuffled shape bag, with no silent clamp shortfall | READY | L | W3-01, W3-02, W3-04, W3-05, W4-01 (soft: W3-09 (uses 46 until it lands)) | 5 | [W3.md](tasks/W3.md#w3-10--give-v2-a-capacity-aware-shuffled-shape-bag-with-no-silent-clamp-shortfall) |
| W3-11 | Add a clearable-fraction knob to v2, dark at neutral, and measure its transfer curve | READY | M | W3-01, W3-02, W3-05 | 5 | [W3.md](tasks/W3.md#w3-11--add-a-clearable-fraction-knob-to-v2-dark-at-neutral-and-measure-its-transfer-curve) |
| W3-12 | Sweep level-1 candidates, including W1's tutorial boards, on one table | READY | S | W1-02, W3-01, W3-10, W3-11 | 5 | [W3.md](tasks/W3.md#w3-12--sweep-level-1-candidates-including-w1s-tutorial-boards-on-one-table) |
| W3-14 | Make v2 difficulty a function of the level index, and report curve candidates | READY | L | W3-09, W3-10, W3-11, W3-13 | 5 | [W3.md](tasks/W3.md#w3-14--make-v2-difficulty-a-function-of-the-level-index-and-report-curve-candidates) |
| W3-15 | Measure whether the candidates' worst boards are affordable on the emulator | READY | M | P-02, W3-14, W6-01 | 5 | [W3.md](tasks/W3.md#w3-15--measure-whether-the-candidates-worst-boards-are-affordable-on-the-emulator) |
| W3-18 | Author new silhouettes, high-fill first | READY | L | P-01, W3-04, W3-10, W4-01 | 5 | [W3.md](tasks/W3.md#w3-18--author-new-silhouettes-high-fill-first) |
| W3-21 | Freeze v2, prove the over-install on the emulator, and prepare the flag flip | READY | M | P-01, W0-08, W3-10, W3-11, W3-14, W3-16, W3-17, W3-19 (W3-19 only for new shapes; W0-08 = P-01 released) | 5 | [W3.md](tasks/W3.md#w3-21--freeze-v2-prove-the-over-install-on-the-emulator-and-prepare-the-flag-flip) |
| W3-09 | Owner sets the minimum legible cell size | BLOCKED-ON-OWNER | S | W3-08 | 5 | [W3.md](tasks/W3.md#w3-09--owner-sets-the-minimum-legible-cell-size) |
| W3-13 | Owner picks the level-1 starting row | BLOCKED-ON-OWNER | S | W3-06, W3-12 | 5 | [W3.md](tasks/W3.md#w3-13--owner-picks-the-level-1-starting-row) |
| W3-16 | Owner picks the curve and how existing players meet it | BLOCKED-ON-OWNER | S | W3-14, W3-15 | 5 | [W3.md](tasks/W3.md#w3-16--owner-picks-the-curve-and-how-existing-players-meet-it) |
| W3-17 | Run the joint W1+W3 first-session playtest | BLOCKED-ON-OWNER | M | W1-04, W1-05, W1-06, W1-07, W1-08, W3-06, W3-12, W3-16 | 5 | [W3.md](tasks/W3.md#w3-17--run-the-joint-w1w3-first-session-playtest) |
| W3-19 | Run the blind naming test for new silhouettes | BLOCKED-ON-OWNER | S | W3-18 | 5 | [W3.md](tasks/W3.md#w3-19--run-the-blind-naming-test-for-new-silhouettes) |
| W3-20 | Stop the tier label from lying | BLOCKED-ON-OWNER | S | W3-01, W3-16 | 5 | [W3.md](tasks/W3.md#w3-20--stop-the-tier-label-from-lying) |
| W3-22 | Confirm the legibility floor and silhouettes on a physical phone | BLOCKED-ON-DEVICE | S | W1-01, W3-09, W3-19 | 5 | [W3.md](tasks/W3.md#w3-22--confirm-the-legibility-floor-and-silhouettes-on-a-physical-phone) |

## Phase 6 — Surface and reach

**Exit criterion:** Compliance evidence pack, policy and listing drafts ready for owner review; W5-19 art packet and W2 feel captures delivered with flags OFF; W8-01 static check and P-02b iOS capture script landed; remaining iOS work waits on disk or owner.

| ID | Title | Status | Effort | Depends on | Phase | Section |
|---|---|---|---|---|---|---|
| W7-06 | Build the compliance evidence pack from a built release artifact | READY | M | W0-01, W0-02 (soft: pastes P-04a dump) | 6 | [W7.md](tasks/W7.md#w7-06--build-the-compliance-evidence-pack-from-a-built-release-artifact) |
| W7-05 | Draft the privacy policy from one source and generate the HTML from it | READY | S | P-03, W7-06 | 6 | [W7.md](tasks/W7.md#w7-05--draft-the-privacy-policy-from-one-source-and-generate-the-html-from-it) |
| W7-08 | Draft the Play listing copy (and an unused Apple draft) for a calm visual-search game | READY | S | P-03, W7-06 | 6 | [W7.md](tasks/W7.md#w7-08--draft-the-play-listing-copy-and-an-unused-apple-draft-for-a-calm-visual-search-game) |
| W7-09 | Capture the Play phone screenshot set from a release build | READY | M | P-02, W0-01, W0-06, W7-08 | 6 | [W7.md](tasks/W7.md#w7-09--capture-the-play-phone-screenshot-set-from-a-release-build) |
| W7-04 | Add a Settings sheet on the menu: privacy policy, ad privacy choices, support, version | READY | M | P-02, W0-06, W4-10, W7-01 (rows go live with W7-03 / W7-07) | 6 | [W7.md](tasks/W7.md#w7-04--add-a-settings-sheet-on-the-menu-privacy-policy-ad-privacy-choices-support-version) |
| W5-03 | Stop the `{remaining} left` counter reflowing on every tap | READY | S | P-02 (coordinate: W1-04 header) | 6 | [W5.md](tasks/W5.md#w5-03--stop-the-remaining-left-counter-reflowing-on-every-tap) |
| W5-09 | Make the ad modal's labels Fredoka instead of the system font | READY | S | W0-01 | 6 | [W5.md](tasks/W5.md#w5-09--make-the-ad-modals-labels-fredoka-instead-of-the-system-font) |
| W5-08 | Route every text size through named type tokens, with zero pixel change | READY | S | P-02, W5-03, W5-09 | 6 | [W5.md](tasks/W5.md#w5-08--route-every-text-size-through-named-type-tokens-with-zero-pixel-change) |
| W5-02 | Replace the OS-font control glyphs with one SVG icon set, and make HeaderButton circular | READY | M | P-02, W0-02, W0-06 | 6 | [W5.md](tasks/W5.md#w5-02--replace-the-os-font-control-glyphs-with-one-svg-icon-set-and-make-headerbutton-circular) |
| W5-06 | Header silhouette: swap the shape-name word for its badge without growing the header | READY | S | P-02, W1-01, W5-01, W5-03 | 6 | [W5.md](tasks/W5.md#w5-06--header-silhouette-swap-the-shape-name-word-for-its-badge-without-growing-the-header) |
| W5-07 | Record the exit trail's resting width at four candidates so the owner can pick one | READY | M | P-02 | 6 | [W5.md](tasks/W5.md#w5-07--record-the-exit-trails-resting-width-at-four-candidates-so-the-owner-can-pick-one) |
| W5-11 | Audit the icon, launcher and splash rasters, and prepare the wordmark decision sheet | READY | S | P-02 | 6 | [W5.md](tasks/W5.md#w5-11--audit-the-icon-launcher-and-splash-rasters-and-prepare-the-wordmark-decision-sheet) |
| W5-14 | Paper grain spike: menu only, flag OFF, owner-picked opacity | READY | M | P-02 | 6 | [W5.md](tasks/W5.md#w5-14--paper-grain-spike-menu-only-flag-off-owner-picked-opacity) |
| W5-15 | Prepare the dead-band decision sheet from the logged viewport, with labelled mocks | READY | S | P-02, W1-01 | 6 | [W5.md](tasks/W5.md#w5-15--prepare-the-dead-band-decision-sheet-from-the-logged-viewport-with-labelled-mocks) |
| W2-04 | Level → level transition: cover with a flat background-coloured scrim, swap under full cover, uncover | READY | M | P-02, W2-01, W2-03 | 6 | [W2.md](tasks/W2.md#w2-04--level--level-transition-cover-with-a-flat-background-coloured-scrim-swap-under-full-cover-uncover) |
| W2-05 | Win and lose panels enter instead of appearing; the continue-with-ad dismissal fades instead of vanishing | READY | M | P-02, W2-01, W2-03, W2-04 | 6 | [W2.md](tasks/W2.md#w2-05--win-and-lose-panels-enter-instead-of-appearing-the-continue-with-ad-dismissal-fades-instead-of-vanishing) |
| W2-06 | Post-clear timeline: the empty-board hold stops depending on how far the last arrow travelled, and the owner picks the numbers | READY | M | P-02, W2-01, W2-03, W2-05 (coordinate: W5-17 reveal slot) | 6 | [W2.md](tasks/W2.md#w2-06--post-clear-timeline-the-empty-board-hold-stops-depending-on-how-far-the-last-arrow-travelled-and-the-owner-picks-the-numbers) |
| W2-07 | Give the rewarded-ad heart refill a pop of its own | READY | S | P-02, W0-01, W2-01, W2-05 | 6 | [W2.md](tasks/W2.md#w2-07--give-the-rewarded-ad-heart-refill-a-pop-of-its-own) |
| W2-08 | Theme toggle: pass through a flat destination-background scrim instead of a one-frame luminance flip | READY | S | P-02, W2-04 | 6 | [W2.md](tasks/W2.md#w2-08--theme-toggle-pass-through-a-flat-destination-background-scrim-instead-of-a-one-frame-luminance-flip) |
| W2-09 | Let the blocked arrow's magenta outlast its lunge | READY | S | P-02, W0-04 | 6 | [W2.md](tasks/W2.md#w2-09--let-the-blocked-arrows-magenta-outlast-its-lunge) |
| W2-10 | Measure whether the blocked lunge reads on screen before anyone changes its amplitude | READY | S | P-02 | 6 | [W2.md](tasks/W2.md#w2-10--measure-whether-the-blocked-lunge-reads-on-screen-before-anyone-changes-its-amplitude) |
| W5-05 | Give the win and lose panels depth by value: an edge you can see, and no glow | READY | M | P-02, W0-06, W2-05, W5-04 | 6 | [W5.md](tasks/W5.md#w5-05--give-the-win-and-lose-panels-depth-by-value-an-edge-you-can-see-and-no-glow) |
| W5-19 | Capture the W5 owner review packet, including the whole-screen chrome and word census | READY | M | P-02, W5-02, W5-03, W5-04, W5-05, W5-06, W5-07, W5-14, W5-15 | 6 | [W5.md](tasks/W5.md#w5-19--capture-the-w5-owner-review-packet-including-the-whole-screen-chrome-and-word-census) |
| W8-01 | Type-check both Swift modules and tabulate Kotlin↔Swift exit parity, without a build | READY | S | — | 6 | [W8.md](tasks/W8.md#w8-01--type-check-both-swift-modules-and-tabulate-kotlinswift-exit-parity-without-a-build) |
| P-02b | iOS backend of the capture instrument: the simctl capture script, proven on a stock simulator app | READY | M | P-02 | 6 | [P.md](tasks/P.md#p-02b--ios-backend-of-the-capture-instrument-the-simctl-capture-script-proven-on-a-stock-simulator-app) |
| P-02c | Calibrate the iOS capture instrument on the app: recorder rate, pixel floor, reduced-motion read-back | BLOCKED-ON-DISK | M | P-02, P-02b, W8-03 | 6 | [P.md](tasks/P.md#p-02c--calibrate-the-ios-capture-instrument-on-the-app-recorder-rate-pixel-floor-reduced-motion-read-back) |
| W2-11 | If the owner says the lunge does not read, add an absolute on-screen floor and bounded anticipation | BLOCKED-ON-OWNER | S | W2-09, W2-10 | 6 | [W2.md](tasks/W2.md#w2-11--if-the-owner-says-the-lunge-does-not-read-add-an-absolute-on-screen-floor-and-bounded-anticipation) |
| W2-12 | Ask the owner whether the shipped audio combo ladder should stay | BLOCKED-ON-OWNER | S | — | 6 | [W2.md](tasks/W2.md#w2-12--ask-the-owner-whether-the-shipped-audio-combo-ladder-should-stay) |
| W3-23 | Correlate the probe's search cost with real per-level mistakes | BLOCKED-ON-OWNER | S | W3-21, W6-06, W6-15 | 6 | [W3.md](tasks/W3.md#w3-23--correlate-the-probes-search-cost-with-real-per-level-mistakes) |
| W5-12 | Make the wordmark a themed vector | BLOCKED-ON-OWNER | M | P-02, W5-11 | 6 | [W5.md](tasks/W5.md#w5-12--make-the-wordmark-a-themed-vector) |
| W5-13 | Regenerate the launcher, favicon and splash rasters from the vector mark | BLOCKED-ON-OWNER | M | W5-11, W5-12, W5-20 | 6 | [W5.md](tasks/W5.md#w5-13--regenerate-the-launcher-favicon-and-splash-rasters-from-the-vector-mark) |
| W5-16 | Build the dead-band option the owner picks | BLOCKED-ON-OWNER | M | P-02, W1-01, W5-06, W5-15 | 6 | [W5.md](tasks/W5.md#w5-16--build-the-dead-band-option-the-owner-picks) |
| W5-17 | Draw the silhouette outline once on the cleared board | BLOCKED-ON-OWNER | M | P-02, W0-04, W2-06, W5-01, W5-04 | 6 | [W5.md](tasks/W5.md#w5-17--draw-the-silhouette-outline-once-on-the-cleared-board) |
| W5-18 | Recapture the store screenshots once the W5 art flags are accepted | BLOCKED-ON-OWNER | S | W0-01, W5-20, W7-09 | 6 | [W5.md](tasks/W5.md#w5-18--recapture-the-store-screenshots-once-the-w5-art-flags-are-accepted) |
| W5-20 | Owner acceptance: answer the art questions, then flip the flags | BLOCKED-ON-OWNER | S | W5-19 | 6 | [W5.md](tasks/W5.md#w5-20--owner-acceptance-answer-the-art-questions-then-flip-the-flags) |
| W6-15 | Turn telemetry on: endpoint, consent, reviewed disclosure, first byte | BLOCKED-ON-OWNER | M | W6-02, W6-03, W6-13, W6-14, W7-01, W7-03, W7-04, W7-05, W7-06, W7-07 | 6 | [W6.md](tasks/W6.md#w6-15--turn-telemetry-on-endpoint-consent-reviewed-disclosure-first-byte) |
| W6-16 | Read the telemetry back against the W1/W3/W4 changes that shipped blind | BLOCKED-ON-OWNER | M | W6-12, W6-15 | 6 | [W6.md](tasks/W6.md#w6-16--read-the-telemetry-back-against-the-w1w3w4-changes-that-shipped-blind) |
| W7-07 | Owner: legal review, host the policy, confirm the age posture, enter the console declarations | BLOCKED-ON-OWNER | S | P-04a, P-04b, P-04c, W7-05, W7-06 | 6 | [W7.md](tasks/W7.md#w7-07--owner-legal-review-host-the-policy-confirm-the-age-posture-enter-the-console-declarations) |
| W7-10 | Owner: pick the title, accept the copy and screenshots, and upload the listing | BLOCKED-ON-OWNER | S | P-04a, P-04b, P-04c, W7-07, W7-08, W7-09 | 6 | [W7.md](tasks/W7.md#w7-10--owner-pick-the-title-accept-the-copy-and-screenshots-and-upload-the-listing) |
| W7-12 | Add a second demand source to the mediation waterfall | BLOCKED-ON-OWNER | L | W7-02, W7-03, W7-05, W7-06, W7-11 | 6 | [W7.md](tasks/W7.md#w7-12--add-a-second-demand-source-to-the-mediation-waterfall) |
| W7-13 | Run Play store-listing experiments on screenshot order and graphics | BLOCKED-ON-OWNER | S | W7-10 | 6 | [W7.md](tasks/W7.md#w7-13--run-play-store-listing-experiments-on-screenshot-order-and-graphics) |
| W8-03 | First compile of the iOS app from a clean prebuild; record the baseline | BLOCKED-ON-DISK | S | P-04c, W8-01 | 6 | [W8.md](tasks/W8.md#w8-03--first-compile-of-the-ios-app-from-a-clean-prebuild-record-the-baseline) |
| W8-05 | Simulator smoke: the board renders, exits slide the right way, the reduced-motion exit is recorded | BLOCKED-ON-DISK | S | P-02c, W8-03 (soft: W2-01 signed-off look) | 6 | [W8.md](tasks/W8.md#w8-05--simulator-smoke-the-board-renders-exits-slide-the-right-way-the-reduced-motion-exit-is-recorded) |
| W8-06 | Measure the `draw(_:)` memory and mask-rebuild cost before refactoring | BLOCKED-ON-DISK | S | P-02c, W8-03 | 6 | [W8.md](tasks/W8.md#w8-06--measure-the-draw_-memory-and-mask-rebuild-cost-before-refactoring) |
| W8-07 | Replace `draw(_:)` with two retained `CAShapeLayer`s | BLOCKED-ON-DISK | M | W8-05, W8-06 | 6 | [W8.md](tasks/W8.md#w8-07--replace-draw_-with-two-retained-cashapelayers) |
| W8-08 | Visual parity gate for W8-07 (this task can veto it) | BLOCKED-ON-DISK | S | P-02c, W8-07 | 6 | [W8.md](tasks/W8.md#w8-08--visual-parity-gate-for-w8-07-this-task-can-veto-it) |
| W8-09 | Feedback module smoke: audio bundle resolution, clip loading and lifecycle | BLOCKED-ON-DISK | S | P-02b, W8-03 | 6 | [W8.md](tasks/W8.md#w8-09--feedback-module-smoke-audio-bundle-resolution-clip-loading-and-lifecycle) |
| W8-10 | iOS perf measurement harness, or a written downgrade of every iOS perf claim | BLOCKED-ON-OWNER | L | P-02b, W8-07, W8-08 | 6 | [W8.md](tasks/W8.md#w8-10--ios-perf-measurement-harness-or-a-written-downgrade-of-every-ios-perf-claim) |
| W8-11 | Physical-iPhone perf run with gates derived from that device | BLOCKED-ON-DEVICE | M | W8-07, W8-10 | 6 | [W8.md](tasks/W8.md#w8-11--physical-iphone-perf-run-with-gates-derived-from-that-device) |
| W8-12 | ATT, SKAdNetwork and a truthful privacy manifest, all from config | BLOCKED-ON-OWNER | M | W7-01, W7-03, W7-12, W8-03 | 6 | [W8.md](tasks/W8.md#w8-12--att-skadnetwork-and-a-truthful-privacy-manifest-all-from-config) |
| W8-13 | Per-platform LevelPlay app key and ad unit ids | BLOCKED-ON-OWNER | S | W0-01, W0-02, W8-12 | 6 | [W8.md](tasks/W8.md#w8-13--per-platform-levelplay-app-key-and-ad-unit-ids) |
| W8-14 | iOS inherits the consent solution through one shared code path | BLOCKED-ON-OWNER | S | W7-01, W7-03, W8-12 | 6 | [W8.md](tasks/W8.md#w8-14--ios-inherits-the-consent-solution-through-one-shared-code-path) |
| W8-15 | EAS iOS build and submit pipeline | BLOCKED-ON-OWNER | M | P-04b, P-04c, W8-12, W8-13, W8-14, W8-16 | 6 | [W8.md](tasks/W8.md#w8-15--eas-ios-build-and-submit-pipeline) |
| W8-16 | Close the iOS checks other workstreams deferred, on an iOS Release build, before any submission | BLOCKED-ON-OWNER | M | P-02c, W8-08, W8-09 | 6 | [W8.md](tasks/W8.md#w8-16--close-the-ios-checks-other-workstreams-deferred-on-an-ios-release-build-before-any-submission) |
| W8-17 | Document the iOS/Android save-backup asymmetry | BLOCKED-ON-OWNER | S | — | 6 | [W8.md](tasks/W8.md#w8-17--document-the-iosandroid-save-backup-asymmetry) |

## Cut or moved during integration

These ids remain as stubs in their files so nothing silently disappears.

| ID | Title | Status | Effort | Depends on | Phase | Section |
|---|---|---|---|---|---|---|
| W3-07 | (CUT: merged into W6-01) | CUT | — | — | — | [W3.md](tasks/W3.md#w3-07--cut-merged-into-w6-01) |
| W5-10 | (CUT: merged into P-03) | CUT | — | — | — | [W5.md](tasks/W5.md#w5-10--cut-merged-into-p-03) |
| W6-17 | (CUT: moved to P-02b and P-02c) | CUT | — | — | — | [W6.md](tasks/W6.md#w6-17--cut-moved-to-p-02b-and-p-02c) |
| W7-14 | (CUT: merged into W8-12) | CUT | — | — | — | [W7.md](tasks/W7.md#w7-14--cut-merged-into-w8-12) |
| W7-15 | (CUT: merged into P-04c) | CUT | — | — | — | [W7.md](tasks/W7.md#w7-15--cut-merged-into-p-04c) |
| W8-02 | (MOVED to P-02b) | CUT | — | — | — | [W8.md](tasks/W8.md#w8-02--moved-to-p-02b) |
| W8-04 | (MOVED to P-02c) | CUT | — | — | — | [W8.md](tasks/W8.md#w8-04--moved-to-p-02c) |

### Plan items with no task and no CUT record (found in the 2026-09-16 critique)

Not CUT and not built: these need a controller or owner decision. Listed so they do not disappear silently.

| Plan source | Item | Nearest coverage today | Decision needed |
|---|---|---|---|
| `docs/NEXT-LEVEL-PLAN.md` §4 "Missing work nobody owned" | **Web-renderer regression coverage** (`react-native-web` is a direct dependency; `src/ui/StaticBoardSurface.tsx` and `BoardView.tsx`'s `WebDynamicBoardLayer` are the SVG twin of the native feedback layer) | One-off checks only: W0-04 criterion 6 (may end UNVERIFIED), W2-01's web exit-trail step. No standing check keeps the twin in step with native. | Own it (for example a W6-11 component test once W6-10 resolves, or a web capture step), or record it CUT. |
| `docs/NEXT-LEVEL-PLAN.md` §4 "Missing work nobody owned" | **Sound design** | Partial: P-03 corrects DESIGN.md's audio row; W2-12 asks the owner to keep or remove the combo ladder. No task re-specifies audio behaviour as a whole. | Confirm P-03 + W2-12 is enough, or record the remainder CUT. |

## Serial execution order

Implementers run **one task at a time on one checkout**; the `fleet_floor_api31` emulator and native builds are shared, so run `df -h /` before every native build and never run two. Take the READY tasks in exactly this order. "waits:" means stop and put the owner item in front of the owner before starting (or closing) that task; do not skip ahead past a task whose hard dependency is unfinished. Owner gates never block unrelated later tasks in the list unless named.

**Phase 0**

1. **P-04a** Prove targetSdk from a locally built release artifact (S) — build at `da93dcd`; keep the APK as the shared base artifact at `artifacts/base/da93dcd-release-arm64.apk` (P-01, W0 pre-fix repros, W0-07 and W7-02 reuse it)
2. **P-04c** Set `ios.supportsTablet` to false (S)
3. **P-03** Rewrite PRODUCT.md for Track A and correct DESIGN.md's measured-false claims (M) — owner yes on the PRODUCT.md diff before it lands
4. **P-01** Own the save schema: one key registry, one schema version, one additive migration (M)
5. **P-05** CI: run jest and tsc on every push to `next-level` (S) — workflow lands now; the first GitHub run waits on the owner's push yes
6. **W7-02** GATE 0: prove a certified CMP compiles and runs on RN 0.86.3 with the new architecture (M) — scratch branch only; only the findings doc lands

**Phase 1**

7. **W0-01** Strip the simulated TEST AD out of production builds (S)
8. **W0-02** Make rewarded ads honest when no ad can be served, and make ad init recoverable (M) — owner accepts the two copy strings from screenshots before merge
9. **W0-03** Boot backstop: the app must always reach the menu (S)
10. **W0-04** Reduce-motion players must still see which arrow blocked them (M) — owner accepts the static reduced-motion look from the recording
11. **W0-05** Persist the interstitial pacing counter across cold start (S)
12. **W0-06** Make every text and state colour meet PRODUCT.md's contrast bar, locked by a test (L) — owner accepts the before/after screenshot set and picks the "LEVEL N" fix
13. **W0-07** Verify every W0 fix together on one release artifact, including an over-install (M) — hand to owner for W0-08
14. **W6-02** Add a remote kill switch for ads and telemetry (client side) (M)

**Phase 2**

15. **P-02** Build one capture instrument: boot into any screen, set and read back motion settings, record, and prove an effect rendered (XL)
16. **W6-01** Measure the O(n) visibleMask rebuild on the blocked-tap path before anyone changes that path (M)
17. **W3-01** Build the difficulty probe and check in the v1 baseline (M)
18. **W3-02** Widen the fill/solve net and fingerprint the whole v1 corpus (S)
19. **W6-04** Define a typed event schema and a pluggable sink that does nothing by default (S)
20. **W6-05** Add telemetry identity accessors on P-01's int keys, and document Auto Backup behaviour (S)
21. **W6-06** Emit level, session, ad and screen events from the real call sites, aggregated per level (M)
22. **W6-07** Record JS fatals into int keys and emit them on the next cold start (M)
23. **W6-08** Prove native crash stacks are symbolicated for a minified release build (S)
24. **W6-10** Spike: can `.tsx` components be tested on Expo 57 / RN 0.86.3 / React 19.2.3? (S)
25. **W6-11** Add a `.tsx` jest project and two component tests that pin real contracts (M) — only if W6-10 reports RESOLVES; otherwise record CUT and skip
26. **W6-12** Write the decision rules each metric must resolve, before any data exists (S)
27. **W6-13** Draft the analytics disclosure: policy section, Data safety mapping and endpoint data rules (S)
28. **W6-14** Write the batched HTTP transport client, shipped with the flag OFF and no endpoint (M)

**Phase 3**

29. **W1-01** Measure the board viewport, then derive the tutorial grid ceiling (S)
30. **W1-02** Author the tutorial boards T1 and T2 without calling the generator (M)
31. **W1-03** Add FTUE stage accessors and a pure first-run route that keeps returning players out (S)
32. **W1-04** Add tutorial mode inside GameScreen: first Play lands on T1, with no ads, no stats, no panels, and auto-advance (M)
33. **W1-05** Teach the blocked-lane rule at first encounter: first blocked tap on T2 is free, with copy for owner approval (M)
34. **W1-06** On real boards, make blocked taps before a board's first successful removal free, until the player's first perfect clear (M)
35. **W1-07** Add a stall hint on tutorial boards (code behind a flag; delay unset) (S)
36. **W1-08** Add a dev-only session log for the first-time-player playtest (S)
37. **W2-01** Finish the reduce-motion census: remaining Reanimated sites, `withDecay`, web exit trail, native exit protocol (M) — closes on the owner's yes/no on the reduced-motion exit recording
38. **W2-02** Record the signed-off reduce-motion contract and reduced-motion exit look in DESIGN.md (S) — waits: the owner's W2-01 ruling
39. **W2-03** The lose panel must wait until the blocker flash has finished explaining the fatal mistake (S) — owner says "beat" or "hang" from the capture
40. **W7-01** Add a consent state module and send LevelPlay's privacy calls before init (M)
41. **W1-10** Run the workstream acceptance captures and build the owner review packet (M) — hand the packet to the owner for W1-11

**Phase 4**

42. **W4-01** Freeze the shape catalogue as an append-only save-format contract (S)
43. **W5-01** Add a pure mask-to-outline function for silhouettes, and a sheet renderer to size them (M)
44. **W4-02** Make the day streak forgiving with free automatic freezes, keeping it in the quiet stats line (M)
45. **W4-03** Build a date-seeded daily board in its own seed namespace, with a versioned shape pool (M)
46. **W4-04** Add a dev-only time-to-clear instrument (S)
47. **W4-06** Add the daily board entry, route and done-state (M)
48. **W4-07** Record solved silhouettes into the collection, with an incremental version-aware fold (M)
49. **W4-08** Measure silhouette legibility at gallery sizes before choosing tile size and raster rows (S)
50. **W4-09** Build the shape gallery: a calm, non-tappable wall of solved silhouettes (M) — waits: the owner's raster rows and tile size from W4-08
51. **W4-10** Compose the menu with every W4 entry enabled, and count the words (S) — owner accepts the flags-ON capture before DESIGN.md is edited
52. **W4-11** Request a store review at a perfect clear, within both stores' rules (M)
53. **W4-12** Render candidate share cards so the owner can rule on the share artifact (S) — hand output to the owner for the W4-13 ruling
54. **W5-04** Show the cleared silhouette on the win panel (S)

**Phase 5**

55. **W3-03** Delete the two dead `ShapeDef` fields (S)
56. **W3-04** Build the shape preview and contact-sheet tool (S)
57. **W3-05** Add the generator version seam with one per-install switch level (M)
58. **W3-06** Add a dev-only level and generator-version jump, and tag the session log with the version (S)
59. **W3-08** Capture the legibility screenshot set and the cellPt table (S) — hand screenshots to the owner for W3-09
60. **W3-10** Give v2 a capacity-aware shuffled shape bag, with no silent clamp shortfall (L) — uses `V2_MAX_GRID_DIM = 46` until W3-09 lands
61. **W3-11** Add a clearable-fraction knob to v2, dark at neutral, and measure its transfer curve (M)
62. **W3-12** Sweep level-1 candidates, including W1's tutorial boards, on one table (S) — hand table to the owner for W3-13
63. **W3-14** Make v2 difficulty a function of the level index, and report curve candidates (L) — waits: W3-09 (floor) and W3-13 (level-1 row)
64. **W3-15** Measure whether the candidates' worst boards are affordable on the emulator (M) — hand report to the owner for W3-16
65. **W3-18** Author new silhouettes, high-fill first (L) — one shape per commit; owner stop rule; each shape waits on W3-19 before v2 admission
66. **W3-21** Freeze v2, prove the over-install on the emulator, and prepare the flag flip (M) — waits: W3-16, W3-17, W3-19 (for new shapes) and the P-01 release (W0-08); flag stays false

**Phase 6**

67. **W7-06** Build the compliance evidence pack from a built release artifact (M) — legal exposure is live: first in Phase 6
68. **W7-05** Draft the privacy policy from one source and generate the HTML from it (S)
69. **W7-08** Draft the Play listing copy (and an unused Apple draft) for a calm visual-search game (S)
70. **W7-09** Capture the Play phone screenshot set from a release build (M)
71. **W7-04** Add a Settings sheet on the menu: privacy policy, ad privacy choices, support, version (M) — `SETTINGS_SHEET` flip waits on W7-07's live policy URL
72. **W5-03** Stop the `{remaining} left` counter reflowing on every tap (S)
73. **W5-09** Make the ad modal's labels Fredoka instead of the system font (S)
74. **W5-08** Route every text size through named type tokens, with zero pixel change (S)
75. **W5-02** Replace the OS-font control glyphs with one SVG icon set, and make HeaderButton circular (M)
76. **W5-06** Header silhouette: swap the shape-name word for its badge without growing the header (S)
77. **W5-07** Record the exit trail's resting width at four candidates so the owner can pick one (M) — owner picks the width in W5-20
78. **W5-11** Audit the icon, launcher and splash rasters, and prepare the wordmark decision sheet (S)
79. **W5-14** Paper grain spike: menu only, flag OFF, owner-picked opacity (M)
80. **W5-15** Prepare the dead-band decision sheet from the logged viewport, with labelled mocks (S)
81. **W2-04** Level → level transition: cover with a flat background-coloured scrim, swap under full cover, uncover (M)
82. **W2-05** Win and lose panels enter instead of appearing; the continue-with-ad dismissal fades instead of vanishing (M)
83. **W2-06** Post-clear timeline: the empty-board hold stops depending on how far the last arrow travelled, and the owner picks the numbers (M)
84. **W2-07** Give the rewarded-ad heart refill a pop of its own (S)
85. **W2-08** Theme toggle: pass through a flat destination-background scrim instead of a one-frame luminance flip (S)
86. **W2-09** Let the blocked arrow's magenta outlast its lunge (S)
87. **W2-10** Measure whether the blocked lunge reads on screen before anyone changes its amplitude (S) — hand frames to the owner for per-condition verdicts (W2-11)
88. **W5-05** Give the win and lose panels depth by value: an edge you can see, and no glow (M)
89. **W5-19** Capture the W5 owner review packet, including the whole-screen chrome and word census (M) — hand packet to the owner for W5-20
90. **W8-01** Type-check both Swift modules and tabulate Kotlin↔Swift exit parity, without a build (S)
91. **P-02b** iOS backend of the capture instrument: the simctl capture script, proven on a stock simulator app (M) — steps 1–4 need no build; boots a stock simulator (check `df -h /` first)

## Owner queue

Every BLOCKED-ON-OWNER task, in phase order, with the precise action. When the owner acts, the agent resumes the task's agent-doable part.

| ID | Phase | Owner action | Unblocks |
|---|---|---|---|
| P-04b | 0 | Log in to Expo (`npx eas-cli login`); run `npx eas-cli project:info`, and only if no project exists run `npx eas-cli init` (writes `expo.extra.eas.projectId`); read `npx eas-cli build:version:get -p android --profile production` and set it so the next production build is > 6; say yes before any cloud build is queued. | W0-08, W7-07, W7-10, W8-15 |
| W0-08 | 1 | Say yes to merging `next-level` (or a W0 release branch) and releasing; decide whether P-01 ships alone first (recommended) or W0-05 is left out; **before this release reaches players, do W7-11's LevelPlay CSV export** (the baseline must predate the W0-05 pacing change it measures, ruling I-23); run the production build and upload to the Play internal track; send a Play Console screenshot showing versionCode > 6. | W3-21 |
| W6-03 | 1 | Choose the origin for `arrows-config.json`, grant hosting-account access, and confirm with the legal review (W7-07) that a config request exposing device IP is covered by the published policy; approve the release that flips `REMOTE_KILL_SWITCH`. | W6-15 |
| W6-09 | 2 | In Play Console → App bundle explorer for the production versionCode, screenshot whether a deobfuscation (ReTrace mapping) file is listed; once any crash exists, screenshot one Android vitals crash stack. | — |
| W7-11 | 2 | Export at least 7 days of LevelPlay dashboard CSV for the live build (impressions, DAU, ARPDAU, rewarded fill and completion, interstitial shows per placement, sessions, retention if available) to a location outside the repo, ideally before the W0-05 release reaches players; say whether any revenue figure may be committed (default no). | W7-12 |
| W1-09 | 3 | Recruit at least 5 people who have never played Arrows and run or observe their sessions on the prepared flags-ON, `EXPO_PUBLIC_FTUE_LOG=1` build, with no coaching; return the raw `[ftue]` logs. | — |
| W1-11 | 3 | From the W1-10 packet answer in writing: (1) approve the 3 copy strings, reword them, or choose wordless; (2) keep the "free before first removal, until first perfect clear" assist rule or add a count; (3) pick `FTUE_STALL_HINT_MS` or leave the stall hint OFF; (4) whether tutorial clears count as solves/streak; (5) whether a future reset clears `arrows_ftue_stage`. Approve each flag flip separately; `FTUE_ASSIST_ENABLED` only after W3-12 and W3-17 report. | — |
| W7-03 | 3 | Choose the CMP from W7-02's report (UMP, a commercial CMP, or no ads in EEA/UK); create and configure the vendor side (AdMob account with a published GDPR message for `com.danteb.arrows`, or the commercial CMP account with TCF config and ironSource/Unity in the vendor list); hand over the resulting app/config ids; register the emulator as a test device for the EEA debug geography. | W6-15, W7-12, W8-12, W8-14 |
| W4-05 | 4 | Before playing, write down a threshold X in minutes; then play the 8 listed daily boards cold, without hints, on the W4-04 dev build and paste the 8 `[measure-clear]` lines back; write the verdict line. | — |
| W4-13 | 4 | Using W4-12's cards, rule on the share artifact: build or cut; URL or no URL (and which); glyph set; column width. | — |
| W3-09 | 5 | Look at the W3-08 fit-to-view screenshot set and name the smallest board you would accept a player seeing (this sets `MIN_LEGIBLE_CELL_PT` and `V2_MAX_GRID_DIM`). | W3-14, W3-22 |
| W3-13 | 5 | Choose one row of `docs/level1-sweep-<date>.md` (after seeing fit-to-view screenshots of your 3 shortlisted rows); it sets v2 level 1's cell target and bias. | W3-14 |
| W3-16 | 5 | Choose one W3-14 curve candidate, state whether its saturation level is acceptable, and pick the discontinuity handling for existing players: (a) accept the table, (b) a v1 floor, or (c) other. | W3-17, W3-20, W3-21 |
| W3-17 | 5 | Recruit first-time players (may share W1-09's recruits), state the pass rule before the sessions, run or observe them on the prepared W1-flags-ON + `GEN_V2_ENABLED` build, and return the `[ftue]` logs. | W1-11, W3-21 |
| W3-19 | 5 | Show each W3-18 silhouette screenshot (no names) to at least one person who has not seen the shape list, ask "what object is this?" with no options, and record the answers under a pass rule you fix beforehand. | W3-21, W3-22 |
| W3-20 | 5 | Choose (a) derive the displayed tier from measured board metrics or (b) remove the tier word from the game header and menu. | — |
| W2-11 | 6 | Give a "does not read" verdict on at least one W2-10 condition (a "yes everywhere" closes this as not needed); if so, pick the target on-screen lunge in points and the anticipation depth from a candidate capture. | — |
| W2-12 | 6 | Listen to the prepared eight-tap burst on the emulator's host audio with `EXIT_COMBO_ESCALATES` true and then false, and rule keep or remove. | — |
| W3-23 | 6 | Make telemetry live first (W6-15: consent, reviewed policy and Data safety, endpoint hosting); then the agent joins per-level data to the probe. | — |
| W5-12 | 6 | Look at `out/art/wordmark-options.png` (W5-11) and answer in writing: is the canonical mark the shipped two-hue emblem (DESIGN.md:51-52 gets corrected) or DESIGN.md's violet ▲ (the in-app mark changes)? | W5-13 |
| W5-13 | 6 | After W5-12 is accepted and flipped in W5-20, give a written yes on a side-by-side of the old and new launcher icons. | — |
| W5-16 | 6 | Pick option A, B, C or D in `docs/dead-band-decision.md` from W5-15's mocks (A ends the task as CUT; B also accepts one more game-screen element) and state the margin. | — |
| W5-17 | 6 | Take the single post-clear timeline decision from W2-06's capture: final-exit factor, empty-board hold, won delay, and this reveal's fade-in, hold and fade-out. | — |
| W5-18 | 6 | Flip the accepted W5 art flags (W5-20); upload the recaptured screenshots in Play Console yourself. | — |
| W5-20 | 6 | From the W5-19 packet answer the 9 art questions in writing: icons + stroke weight; win silhouette + badge size; panel depth + token set; header silhouette keep/kill; exit-trail width; paper grain + opacity or no; whether 36 dp header buttons grow; any type-size change; wordmark / clear reveal / dead band once their blocked tasks have run. | W5-13, W5-18 |
| W6-15 | 6 | Choose and grant access to a first-party ingest endpoint host; ship consent (W7-01 + W7-03); get W6-13's disclosure legally reviewed; publish the updated policy (W7-05) and Data safety form (W7-06) in the same release; decide where the analytics opt-out lives (W7-04); approve that release. | W3-23, W6-16 |
| W6-16 | 6 | With W6-15 live, pick the data window in `docs/telemetry-decision-rules.md`. | — |
| W7-07 | 6 | Confirm the 13+ target audience (or rule otherwise); have the policy, Data safety answers and DSA trader declaration reviewed by someone legally qualified (incl. "no ad init on GDPR refusal"); publish the policy at a live URL (the RELEASE.md URL returned 404 on 2026-09-16; GitHub Pages from `main` needs your merge+push yes); enter Data safety, ads declaration, content rating, target audience, DSA trader status and policy URL in Play Console; after P-04b, build the production AAB and run `bundletool dump manifest` or hand it over. | W6-15, W7-10 |
| W7-10 | 6 | Choose the title from W7-08's candidates (or keep "Arrows"), accept or edit the copy, choose the screenshot order, and enter the copy and upload the screenshots in Play Console; if the title changes, decide whether the launcher label changes. | W7-13 |
| W7-12 | 6 | Decide which ad networks to add, sign up with each and enable them in the LevelPlay dashboard, and hand over each network's LevelPlay Android adapter coordinates and versions (AdMob requires W7-03 live first). | W8-12 |
| W7-13 | 6 | Create and run Play store-listing experiments (screenshot order; feature graphic vs an alternative you supply) once the listing has enough traffic; send the console result screenshots. | — |
| W8-10 | 6 | Decide that iOS will ship (start tranche 2); also free ≥ 20 GB of disk. | W8-11 |
| W8-12 | 6 | Start tranche 2; rule iOS monetisation (ads, premium, or remove-ads IAP; premium deletes W8-12/W8-13); approve the `NSUserTrackingUsageDescription` copy and the ATT prompt moment; complete W7-03 and W7-12 first. | W8-13, W8-14, W8-15 |
| W8-13 | 6 | Start tranche 2; create the iOS app entry for `com.danteb.arrows` in the LevelPlay dashboard and hand over the iOS app key plus interstitial and rewarded ad unit ids. | W8-15 |
| W8-14 | 6 | Start tranche 2 and complete W7-03's owner steps (CMP vendor account after GATE 0). | W8-15 |
| W8-15 | 6 | Start tranche 2; enrol in the Apple Developer Program; create the App Store Connect record for `com.danteb.arrows`; complete P-04b; let EAS manage iOS signing; answer export compliance; say yes before any cloud build or submit. | — |
| W8-16 | 6 | Start tranche 2 (and free ≥ 20 GB of disk). | W8-15 |
| W8-17 | 6 | Start tranche 2. | — |

### Owner sign-offs inside READY tasks and standing owner decisions

| Item | Owner action |
|---|---|
| Push `next-level` | P-05 acceptance 4 and every CI run need an explicit yes to push (owner ruling 2). |
| iPad submission history | Confirm no iOS build was ever submitted to App Store Connect with iPad support (carried from CUT W7-15 into P-04c). |
| P-01 release order | Decide whether P-01 ships alone first (plan rule; recommended) — decided inside W0-08; W3-21 also waits on it. |
| P-03 | Say yes to the PRODUCT.md Track A wording diff. |
| W0-02 / W0-04 / W0-06 | Accept the "no ad available" copy, the static reduced-motion feedback look, and the contrast before/after set (pick the "LEVEL N" fix). |
| W2-01 / W2-03 | Yes/no on the reduced-motion exit recording; "beat" or "hang" on the longer lose-panel lock. |
| W2-04…W2-09 | Accept each W2 feel flag (and the W2-05 loss-entrance and W2-06 timeline candidates) from its capture before it flips. |
| W4-02 / W4-06 / W4-09 / W4-10 / W4-11 | Accept each W4 flag from its captures; pick raster rows and tile size from W4-08; accept the composed menu (W4-10). |
| W3-04 / W3-11 / W3-18 / W3-21 | Look at the contact sheet; accept or reject any clearable bias that changes the arrow look; say "stop" for new shapes; approve regenerated promo art and give the explicit yes before `GEN_V2_ENABLED` flips. |
| W7-04 | Accept the Settings sheet captures and the menu composite before `SETTINGS_SHEET` flips. |
| LevelPlay test device (optional) | Register the emulator as a LevelPlay/AdMob test device if you want real rewarded/interstitial flows observed (W0-02, W0-05); otherwise they stay UNVERIFIED-DEVICE. |
| Disk | Every BLOCKED-ON-DISK iOS task (P-02c, W8-03, W8-05…W8-09) needs ≥ 20 GB free; 10 GB is free today. |
| Physical device | Plan decision 10 (buy a mid-range Android handset) and W8-11 (an iPhone) are unruled; W3-22 and W8-11 are BLOCKED-ON-DEVICE until then. |

## Blocked on disk or device

| ID | Status | What unblocks it |
|---|---|---|
| P-02c | BLOCKED-ON-DISK | ≥ 20 GB free (`df -h /`); 10 GB free on 2026-09-16. Never delete owner files, runtimes or caches the agent did not create. |
| W3-22 | BLOCKED-ON-DEVICE | A physical Android phone (owner purchase decision). |
| W8-03 | BLOCKED-ON-DISK | ≥ 20 GB free (`df -h /`); 10 GB free on 2026-09-16. Never delete owner files, runtimes or caches the agent did not create. |
| W8-05 | BLOCKED-ON-DISK | ≥ 20 GB free (`df -h /`); 10 GB free on 2026-09-16. Never delete owner files, runtimes or caches the agent did not create. |
| W8-06 | BLOCKED-ON-DISK | ≥ 20 GB free (`df -h /`); 10 GB free on 2026-09-16. Never delete owner files, runtimes or caches the agent did not create. |
| W8-07 | BLOCKED-ON-DISK | ≥ 20 GB free (`df -h /`); 10 GB free on 2026-09-16. Never delete owner files, runtimes or caches the agent did not create. |
| W8-08 | BLOCKED-ON-DISK | ≥ 20 GB free (`df -h /`); 10 GB free on 2026-09-16. Never delete owner files, runtimes or caches the agent did not create. |
| W8-09 | BLOCKED-ON-DISK | ≥ 20 GB free (`df -h /`); 10 GB free on 2026-09-16. Never delete owner files, runtimes or caches the agent did not create. |
| W8-11 | BLOCKED-ON-DEVICE | A physical iPhone (owner purchase decision). |
