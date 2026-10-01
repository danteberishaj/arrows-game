# Reusable prompt for a new arrow skin

Copy the brief below into a new task and replace the bracketed art direction. Resolve the current source,
stable IDs and latest linked evidence from the repository; do not reuse an old task's HEAD or measurements.
This prompt generates data on the existing renderer. A compelling design still needs measured acceptance.

---

Create these arrow skins: **[names, art direction, reference colours/materials]**.

Read `AGENTS.md`, `docs/engineering-lessons.md`, `docs/skins/README.md`,
`docs/skins/performance-recipes.md`, `docs/performance/field-guide.md`, and the latest linked skin report
and Controller review first. Inspect the current TS spec registry and native renderer. Preserve all
existing stable numeric IDs and save behavior; append new IDs, never reuse/renumber them. If the runtime
skin code is held in a patch, verify the latest report's patch/base and apply it before implementation.

Use one data spec per style on the shared renderer. Start with a proven vocabulary/template recipe;
change colours, bounded widths, head/tail types and ordered layers to express the art direction. Do not
copy a renderer or branch on a skin ID. If a genuinely missing capability is needed, add one general
type, explain its geometry/cache invariant, and test it for every spec with a deliberately broken control.
Do not describe a new type as cheap until the appropriate measurements exist.

Keep these visual rules:

- Every filled layer, including offset shadow/glow, fits the union of the arrow's own cells eroded .04 cell
  at the exterior. Tail caps are centred on the tail cell and the shaft starts there, with no rear stub.
- Head tip ≤.46 cell past its centre; head decoration area exceeds tail decoration area. One-cell arrows
  are head only: no tail, face or shaft decoration. Preserve Classic's original renderer.
- Use filled joins with consistent path winding. Primary shaft accents are straight on straight runs,
  centred on the shaft/head axis, continuous through rounded bends and inset .03 cell inside the body.
  Keep the small contained head oval separate. An explicitly declared stitched seam may have real gaps;
  it is not a broken primary gloss line. No global up-left offset or wave displacement for gloss.
- Opaque outline contrast ≥3:1 on both actual backgrounds; light body fills are allowed. Keep shared red
  blocked feedback. An approved dark-preference exception must retain its honest failing light rows and
  picker note. Do not fake contrast or weaken geometry checks.
- At most seven paint layers plus one missed-mark draw per strip; use the body as a band's outer colour
  rather than redrawing the same full-width band. Full detail at 29.39 dp must remain full detail.
- Reuse current bounded interaction motion. No idle animation, new particle system, blur/displacement/
  turbulence filters, bitmap assets, sound, shop/unlock logic or iOS rendering for this task. Reduced motion
  disables squash, particles and breathing.

Optimize with explicit invariants: lazy per-strip compound construction, shared relative shape/length
templates, cached direction-only heads and static tail decorations, one compatible centreline per
template, no production audit-only geometry. Own caches per selection and clear them on release.
Do not remove defining art, degrade LOD, drop input or introduce camera culling without proving its
invalidation and pan/lifecycle behavior. Distinguish avoided work counts from measured speed gains.

Verify every registered procedural spec, not just the new one: native fit against an independent Region
oracle, draw bound at 10/100/250 arrows, head > tail, outline contrast, actual flat LOD, reduced motion,
head-only one-cell, filled joins, accent connectivity/inset/axis. Use dense level index 3827 and campaign
levels 1–20. Compare any renderer optimization against frozen/audited geometry and exact software pixels
in actual light/dark backgrounds at 29.39/38/below-flat dp, open/blocked eyes; assert non-background output
for every pixel case. Positive pictures and empty paths must never silently pass. Run Jest and tsc.

Save before/after native art at the actual screen cell size, plus a 38 dp fixture, both themes, one-cell,
tail-to-tail, head-into-tail, bends and long centred accents. Label source/spec/scale honestly and leave
owner look review pending. Picker previews must use the spec palette and existing accessible radio rules.

Measure complete level opening: construction + all prop setup + recording + full first draw, including
lazy geometry/merge exactly once. Use at least 12 shuffled OFF/ON pairs per spec on one test-ads/PERF APK,
dense index 3827 at 29.39 dp, all original META flags and picker enabled. Retain paired overhead, median,
maximum, n, full phase data, source/APK hashes and host/device context. Compare the complete sum with
Classic +16 ms for both median and maximum; report every failure and outlier. Isolate one mechanism at
a time for a causal optimization claim. Draw count or a low preparation timer cannot certify performance.

Measure exit frames only with host load <4 and no other emulator; otherwise report UNVERIFIED with raw
context, zero accepted frames and no percentiles. Quiet-host frames, physical-device behavior and owner
review are separate gates. Do not claim “no performance drop” without their supporting evidence.
Keep flag OFF behavior/save ownership unchanged, identical asset names, and exact native OFF pixels;
small antialiasing differences are still a failed exact gate.

Use the repository's required Node version (currently v20.19.4), emulator-5556/fleet_floor_api31 only,
test-ads/PERF builds, no commits/push/EAS, and restore any display/animation settings changed. Never touch
another session's emulator or wipe saved data. Preserve rejected attempts separately from accepted runs.

Deliver a per-style learning table: stable ID, feature recipe, contract status, avoided work, opening
phases/total/paired overhead, exit sample status, what differs from the reference, and the next isolated
question. A failed run means “not cleared under these conditions”; do not call it impossible to optimize.
Update the skin guide, performance recipes and engineering lessons together, with evidence/cause or
labelled hypothesis/correction/verification/report. Provide byte-verified patch series and reproducible
tools in the new task's artifacts. Keep the experiment default OFF while gates or owner review remain open.

---
