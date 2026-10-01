# ART-SKINS-05 — light fills, continuous accents and complete opening cost

2026-10-01. **Experimental, default OFF. Owner look review pending. Cinnamon opening budget FAIL; Sherbet aggregate comparison: FAIL. Exits UNVERIFIED.** No commits, push or EAS.

Started by applying the required ART04 restoration once, to base `568ee88c64fb7df08af4fb1647e684d5a8965991`. The final ART05 patch series includes that restoration and all corrections; apply it to that clean base, not after separately applying the ART04 patch. The current working tree already has the changes applied and uncommitted.

Read AGENTS.md, engineering lessons, the skin guide's K3/K4/one-cell rulings and ART04 Controller review before changes. Exact Expo v57 documentation was consulted; the requested Node v20.19.4 was retained. Local arm64 Android builds only, emulator-5556 / fleet_floor_api31 only, test ads/PERF and all seventeen META flags enabled, including zoomed camera. The other emulator was observed for the host gate and never operated.

## Acceptance ledger

| Gate | Result | Evidence / limits |
| --- | --- | --- |
| K1 | PASS, red → green | Frozen ART03 Cinnamon fails **17,191 / 23,298** path checks over v1 indices 0–19 and 3827. Current Cinnamon + Sherbet: **0 / 36,006** failures, 2,118 real arrows per spec. Independent Android Region DIFFERENCE, union then .04-cell exterior inset, 400 samples/cell. |
| K2 | PASS | At 29.387754 dp, 10/100/250 arrows: Cinnamon **8**, Sherbet **5** static Canvas draws per strip including one reserved missed mark. Moving arrows/interaction overlays are separate. Actual dense opening logs prove full detail (7/4 draws with no mark). |
| K3 | PASS under updated ruling | Every full-detail head cap area exceeds the tail cap area. Long icing/shine area is not compared, as ruled in the skin guide. |
| K4 | PASS under updated ruling | Outline contrast ≥3:1 on both backgrounds; light fill is free. Eight rows including blocked colours, all passing. Shared `heart` supplies blocked feedback. |
| K5 | PASS | Flat exists and draws two layers at 10 dp; opening at 29.387754 dp starts in full detail, with no flat-first rebuild. |
| K6 | PASS within native test scope | Reduced press scale 1, zero emitted particles, non-empty hint pixels identical at 300/900 ms. Reduced exit anticipation/particle guards remain. Real interaction frame timing is unverified. |
| K7 | Cinnamon FAIL; Sherbet aggregate FAIL | Twelve shuffled OFF/ON pairs per spec, full native opening sum at 29.387754 dp. Complete numbers below. The paired-delta data is also printed; no gate success implies that every individual open adds ≤16 ms. |
| K8 | PASS, ART04 negative red | **898** actual one-cell checks, no face and no tail larger than a dot. Frozen ART04 Cinnamon fails **449** one-cell checks. Both dot/none alternatives checked in all four directions. Exit art retains original one-cell identity. Both delivered specs choose `none`. |
| Filled joins and shaft accents | PASS | Every head Region minus body Region empty without tolerance erosion. Frozen opposite-winding control has missing head area (29,012 Cinnamon / 30,076 Sherbet samples at 400/cell). Every non-empty shaft accent has one connected component; head oval excluded. **946** straight-run axis checks pass; a shifted-shine negative control fails with centre error −2.600 logical pixels. Accents remain inside the body inset .03 cell. |
| Look captures | OWNER REVIEW PENDING | Actual display-level 3828 viewports at 29.387754 dp, native whole boards, lossless 2× one-cell-cluster crops and earlier collision/run crops. Updated straight icing and unchanged separate head oval. |
| Jest + TypeScript | PASS | 115 suites, **1,933 tests**, 12 snapshots; TypeScript exit 0. Final native geometry checks ran again after the final native-only compaction change. |
| Flag unset / assets / ads | PASS | Actual unset board crop pixel-identical to the selected build's native OFF crop; no ArtSkin events. Same fifteen asset names in all three APKs; nine official test ad-unit IDs only in each JS bundle. Unset has no diagnostic instrumentation registration. |
| Exits | UNVERIFIED | No pair eligible: host load exceeded 4 and another emulator ran. **Frame count 0 per spec**, no P50/P95/P99 values claimed. Raw host checkpoints retained. |

This is not an all-green acceptance. Both skins miss K7 in the final complete-timer runs, owner taste approval is pending, and exits have no valid frames. Default OFF remains appropriate.

## Appearance and geometry

K4 now measures the rim, not the fill. Cinnamon dough is `#E6AE71`, rim `#96603A`; Sherbet pastel cycle is `#EEB0CB`, `#ADDAD2`, `#CBB8E8`, `#F3D39F`, rim `#82638D`. Daylight / Ink Night outline contrast: Cinnamon **5.210 / 3.584**, Sherbet **5.099 / 3.662**. Blocked shared red: **4.157 / 5.299**. See `checks/contrast.json`; the test rejects a white rim even with a dark body and permits light fill behind a valid rim.

The existing general system stays: one TypeScript SkinSpec registry, one immutable JSON selection prop parsed once, one native Skin* renderer with no per-skin native branches. `tail.oneCell: dot|none` is mandatory and spec-driven. A one-cell arrow draws its directional head and small interior highlight, with no roll or face for these specs. The dot alternative is capped at .13 cell. Tail rolls remain centred on the tail cell for longer arrows, with no shaft stub behind them. Cell-fit bounds, wider dominant head and reduced-motion behavior remain.

The owner's first follow-up showed a white wedge at the shaft/head join. It was a fill hole, not an oversized head highlight: Boolean-clipped caps had opposite winding to the stroke fill, cancelling their overlap on path concatenation. Cached head caps now have positive winding. Only those small caps are flattened, at ≤.005 logical-pixel approximation error; shafts/bends retain native curves. The native coverage assertion and frozen broken control reject this exact failure.

The owner then clarified: **the head oval is good; the shaft lines should be straight and connected.** This supersedes Cinnamon's earlier wavy-icing brief. Its ribbon now has amplitude 0, width .075, zero offset; the brown stripe sits .09 cell to one side (width .055), clear of the white line. The oval stays separate. The owner then pointed specifically to pink/green Sherbet bars: those straight bars were globally shifted up .065 cell, off the good head oval axis. Sherbet now has zero shine offset too. Both skins have straight shaft highlights on the same axis as their ovals, independently checked on real straight runs. “Straight” includes visual alignment, not just local slope. See `checks/accent-axis-negative.txt` for the deliberately shifted-shine rejection. Long-run fading remains one cell; short-run fading is limited to .35 of the available shaft so two-cell icing does not look like a broken sliver. Rounded accents follow the same rounded centreline as the body. Narrow accents fit by construction; unsupported wider/offset combinations retain the general inset-body intersection fallback. The independent Region check still tests the resulting paths.

## Opening design and measured cost

Relative (shape, direction, detail) templates are built lazily on first strip draw and merged directly into strip layers. This avoids the ART04 per-arrow intermediate copies. Preparation constructs **zero decorated arrows**; dense first drawing uses 57 shared templates and logs `individualArt=0`. Individual art is allocated lazily for interactions. Templates are bounded to the current board/tier and cleared with selection/geometry replacement. Palette lookup is one small generated bitmap, not a packaged asset.

The generic narrow-fit construction avoids full-arrow Boolean intersections where its bounds establish containment; other specs retain that fallback. Cached head caps avoid repeated clipping. Exact-collinear ribbon samples are removed, without a tolerance or changed contour; both dense native board images are **pixel-identical** before/after compaction (before the later intentional Sherbet centering change) (`checks/compaction-pixels.json`). This reduces redundant retained path points, but differently contended pilots do **not** prove a timing improvement from compaction.

Headline is **preparation + strip recording + full first draw**. Preparation includes native renderer field construction (after the ExpoView framework superclass), every initial native prop setter, and retained preparation. This includes geometry parsing/strip partitioning, grid/config setup, and feedback/mask setup. Selection/cell/base parsing are nested breakdown timers, not extra costs. Canvas command recording is included in first draw. Lazy template/merge cost occurs once inside first draw; it is not added again as recording. Sum each run, then calculate median/max. Phase medians/maxima do not sum to the headline. These are elapsed intervals covering the owned native renderer work (framework superclass construction is excluded), not launcher-to-presented-frame latency; JS startup, GPU rasterization and frame presentation are outside this timer.

All final opening results: core index **3827**, displayed **LEVEL 3828**, 250 arrows, logical cell 40 dp × camera .734693854 = **29.387754 dp on screen**, 1440×3120 physical display, density 560 (3.5 px/dp). All META flags ON. **n=12 ON and n=12 OFF per spec**, force-stopped process opens, seed 20261001, shuffled order within each OFF/ON block. OFF is a native diagnostic override in the same selected JS bundle; the unset build independently proves the normal flag guard. No slow samples discarded.

| Complete opening, median / max ms | On-screen cell dp | n ON / OFF | Skin ON | Flat OFF | Flat +16 threshold | Gate |
| --- | --- | --- | --- | --- | --- | --- |
| cinnamon | 29.387754 | 12 / 12 | **45.885 / 75.844** | 5.963 / 20.846 | 21.963 / 36.846 | **FAIL** |
| sherbet | 29.387754 | 12 / 12 | **33.762 / 54.381** | 11.039 / 25.795 | 27.039 / 41.795 | **FAIL** |

The same phase breakdown as ART04, with the complete sum as the headline above. Every row below uses **29.387754 dp** and **n=12 per state/spec**, values median / max ms:

| Phase | On-screen cell dp | Cinnamon | Sherbet |
| --- | --- | --- | --- |
| Native renderer field construction | 29.387754 | 0.093 / 0.190 | 0.094 / 0.137 |
| All native prop setup, including parsing/grid/partition | 29.387754 | 12.245 / 28.382 | 9.740 / 28.215 |
| Selection JSON (nested in prop setup) | 29.387754 | 0.537 / 1.535 | 0.457 / 18.897 |
| Owned-cell parsing (nested in prop setup) | 29.387754 | 1.439 / 13.595 | 0.936 / 2.205 |
| Base geometry parsing (nested in prop setup) | 29.387754 | 9.024 / 16.487 | 6.161 / 24.079 |
| Retained preparation only | 29.387754 | 0.203 / 11.384 | 0.818 / 12.165 |
| Cold preparation incl. construction + all prop setup | 29.387754 | 12.747 / 29.338 | 11.163 / 30.384 |
| Strip recording ON (excluding preparation) | 29.387754 | 0.080 / 0.246 | 0.091 / 2.875 |
| Strip recording OFF | 29.387754 | 0.185 / 0.516 | 0.267 / 0.819 |
| Full first draw ON incl. lazy templates/merge/Canvas | 29.387754 | 31.315 / 60.923 | 15.953 / 32.283 |
| Complete opening ON | 29.387754 | 45.885 / 75.844 | 33.762 / 54.381 |
| Complete opening OFF | 29.387754 | 5.963 / 20.846 | 11.039 / 25.795 |
| Within-pair ON minus OFF | 29.387754 | 36.378 / 69.031 | 21.672 / 49.637 |

Cinnamon's largest remaining measured interval is first draw: **31.315 / 60.923 ms at 29.387754 dp**, including template construction, merging, and Canvas commands. This instrumentation does not attribute those suboperations separately; it would be misleading to claim an exact submethod bottleneck. The existing flat base parser also has substantial elapsed outliers. Sherbet's aggregate comparison is **FAIL**, and paired extra maximum **49.637 ms** exceeds 16 ms. A stricter per-pair maximum gate would fail; quiet repeatability remains unestablished. Contention does not excuse Cinnamon's failed budget.

Final raw host load range (all before/input-gate/after checkpoints): Cinnamon **7.52–12.74**, Sherbet **5.73–10.64**. Another emulator was present throughout. Exits **UNVERIFIED**, frame count **0** per spec. No percentiles or exit speedup claimed. Quiet exit capture requires both members of all twelve pairs to meet load<4, sole emulator, accepted tap and positive frame-count checks; that branch has not run successfully on this host.

Raw final evidence: `perf/{cinnamon,sherbet}-raw.json`, all `*-open.log`, `perf/summary.json`; full-detail `ArtSkinDraws` and `ArtSkinLazy` are preserved beside every open. Historical ART04 sums came from different timers/host conditions and are not used to assert an exact percentage speedup.

## Captures players see

Actual app viewports (all META flags, 29.387754 dp, display level 3828): [Cinnamon](../../../artifacts/ART-SKINS-05/screens/cinnamon-on-viewport.png), [Sherbet](../../../artifacts/ART-SKINS-05/screens/sherbet-on-viewport.png).

[Actual viewport one-cell cluster, before Cinnamon / after Cinnamon / after Sherbet, 2×](../../../artifacts/ART-SKINS-05/screens/comparison-viewport-one-cell-cluster-2x.png).

![Actual viewport one-cell cluster comparison](../../../artifacts/ART-SKINS-05/screens/comparison-viewport-one-cell-cluster-2x.png)

Whole-board native Canvas diagnostics at the same 29.387754 dp: [Cinnamon](../../../artifacts/ART-SKINS-05/screens/after-cinnamon-board.png), [Sherbet](../../../artifacts/ART-SKINS-05/screens/after-sherbet-board.png). These expose the complete board beyond the clipped player viewport; they are labelled diagnostics, not app screenshots. The before files are the controller-reviewed ART04 captures, with source hashes in `screens/before-provenance.json`.

Lossless 2× comparisons: [one-cell cluster](../../../artifacts/ART-SKINS-05/screens/comparison-one-cell-cluster-2x.png), [tail-to-tail](../../../artifacts/ART-SKINS-05/screens/comparison-tail-to-tail-2x.png), [head into tail](../../../artifacts/ART-SKINS-05/screens/comparison-head-into-tail-2x.png), [long continuous icing](../../../artifacts/ART-SKINS-05/screens/comparison-long-icing-2x.png). Crop metadata records core arrow indices, real cells, pixel bounds and source provenance in `screens/{crops,viewport-crops}.json`. No retouching or generated pixels. [Sherbet bar-axis correction, actual viewport before/after 2×](../../../artifacts/ART-SKINS-05/screens/comparison-sherbet-centred-2x.png). OWNER REVIEW PENDING.

## Validation and retained rejected experiments

Native before and after: `checks/native-{before,after}.json` and all 21 per-level outputs for each mode. The final after check includes direct-template merge equivalence, strict filled-head coverage, accent inset and shaft connectivity, one-cell rules and the previous zero-length corner-fragment negative control (two components versus one clean rim). Frozen controls live only in `scripts/art/skin-contract/`; four temporary Kotlin copies and their generated-manifest registration were removed from the ordinary tree before the unset build.

All Jest: `checks/jest-final.txt` (115 suites / 1,933 tests / 12 snapshots). TypeScript: `checks/tsc-final.txt`, empty output, exit 0. Native local build logs, saved environments and Node pin are in `checks/`. Final Jest/TypeScript checks include both centering corrections. The native contract includes the current shaft-axis assertion and its displaced-shine negative control. The isolated compaction pixel-equality evidence is retained from before the intentional Sherbet offset change. No runtime source changed after the final checks.

Retained pilots are not final acceptance data:

- `perf/pilot-initial/`: ART04 restoration and the initial head-hole capture.
- `perf/pilot-head-unions/`: explicit Boolean head union fixed coverage but opening budget failed.
- `perf/pilot-cached-heads/`: cached normalized caps with slower body-clipped accents; failed budget.
- `perf/pilot-rounded-accents/`: narrow rounded accent construction, before the owner requested straight icing; superseded.
- `perf/pilot-straight-uncompacted/`: straight appearance before removing redundant collinear points; same pixels, different host contention.
- `checks/rejected-head-coverage/`: the strict oracle exposed rounding in an earlier cap construction; final checks have no tolerance erosion.
- `checks/rejected-dark-outline.txt`: initial revised rims failed night contrast and were corrected before acceptance.
- `perf/pilot-sherbet-offset/`: previous straight-but-off-axis Sherbet bars; owner rejected them and the new native axis check rejects the displaced data.
- `perf/pilot-incomplete-timer/`: previous sums omitted some setter/constructor work. Final review rejected their “complete” label; the final timer covers all owned native initialization and prop setup, including grid/config/strip partitioning. Nested parsers are not counted twice.

The report/lesson uses final source and measurements, not a selectively faster pilot. No independent controller re-review has occurred in this task; author checks and pending owner review are distinct.

## Build hygiene, patches and future sessions

Final test APKs at 29.387754 dp:

| APK | SHA-256 | Diagnostic instrumentation |
| --- | --- | --- |
| cinnamon.apk | `96373aa7c5144bc8d6e8876692fd2d338ad2498342f8f05f445ffbd2e8c19339` | Present in diagnostic test APK only |
| sherbet.apk | `8f140d49a7caa9bae08b12582632193ee9569da404688bf38ecfe386141a60dc` | Present in diagnostic test APK only |
| unset.apk | `05ab13e169addf082d8815461ca48e22dc59187346cf3c28c4d5432aa2288d9a` | Absent |

`checks/apk-checks.json`: same fifteen packaged asset names, nine official test ad-unit IDs in each JS bundle, all seventeen META flags 1. Existing native AdMob application-id configuration was not changed. No skin bitmap/atlas assets were added; the per-board palette lookup is generated runtime data. `checks/unset-check.json`: unset normal app board pixels equal the native OFF capture over `[0,312,1440,2940]`; actual camera cell 29.387754 dp, no ArtSkin events. See `screens/unset-viewport.png` and `checks/unset-open.log`.

Patch series: `artifacts/ART-SKINS-05/patches/01-general-skin-system.patch`, `02-contract-and-tooling.patch`, `03-report-and-lessons.patch`. Forward application to a temporary clean archive, exact file-hash comparison, reverse check and whitespace check are recorded in `checks/patch-verification.json`; no index or commit writes. Read `patches/README.md` before applying. Generated APKs/screens/raw evidence remain ignored artifacts. No EAS or remote writes.

Updated [engineering lessons](../../engineering-lessons.md) and [How to add a skin](../../skins/README.md) record the corrected K4, K8, winding coverage, owner straight-line/axis ruling, continuous-accent and alignment tests, and complete opening sum. AGENTS.md now also points future skin work directly to the skin guide and its latest review, in addition to requiring lessons to be consulted and updated. Reproduction uses `ART_SKINS_DIR=artifacts/ART-SKINS-05`; tooling creates its output directories and derives fixtures from the single TS spec source. Canonical native test fixtures are copied only for diagnostic builds. The final unset build omits them. Cleanup evidence for the task-owned emulator is in `checks/device-cleanup.json`; no other emulator or display override is changed.

## Controller review (2026-10-01)

Verdict: **look nearly there (owner review pending); REQUEST CHANGES on speed; keep OFF.**

Executed by the reviewer: with the delivered code, `tsc` exit 0 and `jest` 115 suites / 1933 tests / 12 snapshots
(Node v20.19.4). Recomputed from `perf/*-raw.json` (`totalOpenMs`, 29.3878 dp, n = 12/12): Cinnamon ON 45.885 / 75.844 ms
vs OFF 5.963 / 20.846 ms, paired extra median 36.378, max 69.031; Sherbet ON 33.762 / 54.381 vs OFF 11.039 / 25.795,
paired extra median 21.672, max 49.637 — identical to the report. K1 still 0 / 36,006 (before: 17,191 / 23,298).
Host load 5.7–12.7 with a second emulator, so exits remain UNVERIFIED.

Visual: light dough restored; one-cell arrows are clean triangles (the blob-with-eyes problem is gone); Sherbet's
pastels read well. Opening cost fell from ~136 ms (ART-SKINS-04 sum) to ~46 ms, still ~36 ms over flat for
Cinnamon. Next: first draw (31 / 61 ms) is the largest phase; then a quiet-host or owner-phone exit check.

Disposition: code moved out of the tree into `artifacts/ART-SKINS-05/patches/skin-code-removed-from-tree.patch`;
docs, guide, AGENTS.md pointer, tooling and lessons committed.
