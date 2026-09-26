# W5-11 — icon, launcher and splash raster audit; wordmark decision sheet

Task: `task-W5-11-brief.md` plus its controller amendments (F38, Table B). Measurement/read-only task,
no asset or code change. Branch `next-level`, tree at start had unrelated uncommitted W3-05 edits
(generator-version seam) in `src/core/*`, `App.tsx`, `src/ui/GameScreen.tsx`, etc. — none of those files
are touched by this task.

Tool: `scripts/art/icon-audit.mjs` (new, plain-Node ESM, `node scripts/art/icon-audit.mjs`). Emulator
evidence: `emulator-5556` / `fleet_floor_api31` / API 31, native geometry `1440x3120 @560`, motion
scales read back `1 1 1` (unchanged — never touched, per this task's dispatch), app already installed
(no reinstall), no ad tapped. Raw artifacts under `artifacts/W5-11/` (gitignored).

## 1. Raster inventory (EXECUTED, `node scripts/art/icon-audit.mjs`, run twice, byte-identical stdout)

| file | dimensions | channels | hasAlpha |
|---|---|---|---|
| `assets/images/mark.png` | 512x512 | 4 | true |
| `assets/android-icon-foreground.png` | 1024x1024 | 4 | true |
| `assets/android-icon-background.png` | 1024x1024 | 3 | false |
| `assets/icon.png` | 1024x1024 | 4 | true (fully opaque: the mark is composited onto a solid background before export) |
| `store/playstore-icon-512.png` | 512x512 | 3 | false |

**Acceptance check:** 512x512 RGBA for `mark.png` — PASS. 3 channels for the Play icon — PASS.

## 2. Opaque extent (furthest opaque radius / half-frame)

"Opaque" = alpha > 0 (any visibly-drawn pixel, including a partially-transparent antialiased edge —
this is the definition that reproduces the brief's cited 0.596 to within its own +/-0.005 tolerance;
a stricter alpha===255 definition gives 0.589 instead, see script comments).

| file | opaque px | opaque % of frame | furthest radius / half-frame |
|---|---:|---:|---:|
| `mark.png` | 35,938 / 262,144 | 13.7% | **0.6897** |
| `android-icon-foreground.png` | 107,019 / 1,048,576 | 10.2% | **0.5965** |
| `android-icon-background.png` | n/a (no alpha channel) | — | — |
| `icon.png` | 1,048,576 / 1,048,576 | 100% | 1.4128 (meaningless: no transparency once composited onto a full-bleed background) |
| `store/playstore-icon-512.png` | n/a (no alpha channel) | — | — |

**Acceptance check:** reproduces 0.596 for the adaptive foreground to +/-0.005 (measured 0.5965) — PASS.

The adaptive foreground's visible content reaches **0.596** of the half-frame. The brief cites Android's
adaptive-icon safe zone as **0.611** of the half-frame for comparison. **0.596 < 0.611: the current
foreground is inside the safe zone** by 0.015 of the half-frame (about 7.7px on the 512px-radius 1024px
layer). This audit does not re-derive the 0.611 figure; it only measures the shipped asset against it.
mark.png itself (before the W5-12/generate-store-assets resize into the 880px foreground) reaches 0.690
of ITS OWN half-frame — the two numbers are not directly comparable, because the foreground crop resizes
and recenters the same source art at a smaller scale (880 vs the source's native 512, see
`generate-store-assets.js`'s `markResized(880)`).

## 3. `mark.png`'s two dominant opaque hues (RGB-histogram peak, bucket=32, fully-opaque px only)

| peak | hex | RGB | share of fully-opaque px |
|---|---|---|---:|
| 1 | `#6040e0` | 96,64,224 | 61.6% |
| 2 | `#e04080` | 224,64,128 | 14.8% |

These are a **royal violet** and a **magenta/rose**, matching `Wordmark.tsx:6`'s own comment
("violet + magenta baked in ... so it reads on both themes"). They are close to, but not identical
with, the two palettes' own `accent` tokens (Daylight `#6D4AEF`, InkNight `#7B5BF5`) and `heart`/`heartText`
tokens (Daylight `#E4327D`/`#E11F71`, InkNight `#F0468C`) — the mark's colours are **independently
baked in**, not sampled from either live palette, which is exactly the DESIGN.md mismatch this task
was asked to surface (see "The question for W5-12" below).

Method note: a coarser bucket (32) was chosen over 16/24 because it is the coarsest one that still
separates violet from magenta into two bins rather than either merging them or fragmenting each into
several near-duplicate shading bins (checked at all three while writing the script; see code comment).

## 4. `icon.png` edge-transition band (upscale-softness baseline for W5-13)

8 radial scanlines from the image centre, thresholds `T_HI=40` (background-departure), local search
`WINDOW=8px`, `FRAC=0.9` of the local peak contrast (all OWNER-PICKED STARTING VALUES; stable when
re-checked at WINDOW 6/10/12 — identical results, so the measured transition is not an artifact of the
window size):

| angle | edge width (px) |
|---:|---:|
| 0deg | 2 |
| 45deg | 1 |
| 90deg | 2 |
| 135deg | 1 |
| 180deg | 2 |
| 225deg | 2 |
| 270deg | 3 |
| 315deg | 1 |

**Range 1-3px** at 1024px canvas (the mark itself is a ~1.84x raster upscale of the 512px source:
`generate-store-assets.js`'s `iconOn(INK_NIGHT_BG, 1024, 940)`, 940/512 = 1.836). A first attempt used
an unbounded search window and returned 24px+ on most rays; that number was an artifact of the mark's
own internal shading gradient (a soft, deliberate colour ramp inside each facet), not the upscale edge —
discarded, documented in the script's comments. **This 1-3px baseline is what W5-13 should beat** if it
redraws the icon from a sharper or vector source.

## 5. Launcher capture (P-02-style, direct `adb`, per this task's dispatch — not the P-02 harness)

`emulator-5556`, API 31 AOSP launcher, app already installed (no reinstall), scales read back `1 1 1`
(unchanged throughout). Artifacts:

- `artifacts/W5-11/app-drawer-1.png` — full app-drawer screen (`adb shell input swipe ...` from the
  home screen; the app is not pinned to the home screen on a fresh install, so the drawer is the
  launcher's actual rendering of the icon).
- `artifacts/W5-11/launcher-icon-crop.png` — a 220x220px crop around the Arrows icon, upscaled 3x
  nearest-neighbour for legibility (I looked at both).

**The icon is not clipped by the API 31 launcher's mask.** The AOSP launcher on this AVD applies a
**circular** mask; the Ink Night background fills the full circle and the violet/magenta mark sits
comfortably inside it with visible margin on all sides — consistent with the measured 0.596-of-half-frame
foreground extent being under the 0.611 safe-zone figure.

**UNVERIFIED (API 31):** themed (monochrome) icon rendering. Android's per-app themed icon feature needs
API 33+; this AVD is API 31 and cannot show it. `assets/android-icon-monochrome.png` exists and was
generated (`generate-store-assets.js`), but its on-device rendering is not checked by this task and is
not checked anywhere in this audit. UNVERIFIED-DEVICE beyond that: physical launchers (Samsung One UI,
other OEM launcher shapes/masks), and any launcher applying a **square** or **teardrop** mask instead of
this AVD's circle — the 0.596 number is mask-shape-independent (it is measured from the image centre,
not from any specific mask), but a squarer mask with sharper corners could theoretically clip content a
circular mask does not; not measured here.

## 6. `store/playstore-icon-512.png` alpha channel

Confirmed **3 channels, no alpha** (matches the brief's claim). Per the brief's own instruction, this
audit does **not** assume whether that is compliant with Play's current icon spec — checking the live
spec is deferred to upload time, out of this task's scope.

## 7. Wordmark options sheet

`artifacts/W5-11/wordmark-options.png` (brief names `out/art/wordmark-options.png`; moved under this
task's own artifacts root — see "Deviations from the brief" below). 4 panels: the current raster emblem
(`mark.png`) and DESIGN.md's flat vector accent triangle, each set as the Wordmark at the menu's actual
size (56dp) and left margin (`Wordmark.tsx`'s exact `triW`/`rectW`/`marginLeft` fractions), in both
palettes, at 3.5px/dp (matches `scripts/art/silhouette-sheet.ts`'s own convention). I looked at the
image: both variants read clearly at menu size in both palettes; the vector triangle is visibly flatter
and more uniform, the raster emblem has the interlocking-arrowhead facets and two-hue shading DESIGN.md's
one-line spec does not describe.

Caveat: the sheet's "rrows" text uses a generic bold sans-serif fallback (`font-family="sans-serif"
font-weight="700"`), not the app's actual `Fredoka_700Bold` (an OTF/TTF the SVG rasterizer used here
cannot load) — it is a size/colour/footprint comparison aid, not a pixel-accurate typographic proof.

### The question for W5-12 (one sentence, per acceptance criteria)

**Should the wordmark's "A" become DESIGN.md's flat, single-hue `accent`-coloured vector triangle
(crisp at any size, follows the live palette) in place of the current two-hue raster emblem `mark.png`
(colours independently baked in, a ~1.84x raster upscale for the launcher, 1-3px of edge softness),
per the options in `artifacts/W5-11/wordmark-options.png`?**

## Deviations from the brief

1. **Output paths moved under `artifacts/W5-11/`.** The brief names `out/art/wordmark-options.png`
   (matching `silhouette-sheet.ts`'s existing convention, and already gitignored via `.gitignore:55`
   `out/art/`). This task's controller dispatch instead asked that every output of W5-11/W5-15 live
   under `artifacts/W5-11/` / `artifacts/W5-15/` so the two tasks' evidence is easy to find and account
   for under this host's low disk headroom (~2-4 GiB free during this session, other sessions sharing
   the disk). Both locations are gitignored either way; this is a path choice, not a content change.
2. **Launcher capture used direct `adb`, not the P-02 capture harness** (`scripts/perf/android/capture.mjs`).
   This task's dispatch says to use only `adb -s emulator-5556` directly for any emulator capture this
   round, with the app already installed and scales left at `1 1 1` — the P-02 harness's
   `applyMotionScale` would have changed scales and its `--apk` path would reinstall, both out of bounds
   here. The brief's own text ("P-02 capture of the API 31 launcher home screen") is followed in spirit
   (same device, same acceptance question) but not via that literal tool.

## Emulator collision with W2-09 (disclosed per the controller's note)

Another agent (W2-09) was independently driving `emulator-5556` starting 16:02:03-16:02:04 (it uninstalled
`artifacts/W4-11/apk/arrows-testads-W4-11.apk` and installed its own `artifacts/W2-09/apk/w209-off.apk`,
a dispatch error the controller has confirmed). **This task's device evidence (the launcher/app-drawer
capture) was taken at 16:00, before that swap** (`artifacts/W5-11/app-drawer-1.png`, timestamped by its
on-screen clock "4:00"), so it is unaffected — the icon it shows is W4-11's. It would not have mattered
either way: `w209-off.apk`'s own build record shows it is a JS-only repack whose native host is
`arrows-testads-W4-11.apk` itself, so the two APKs' baked launcher/adaptive-icon resources are
byte-identical regardless of which one is installed. See `docs/dead-band-decision.md`'s "Emulator
collision with W2-09" section (W5-15, the other task in this handback) for the full timeline and evidence
— this task's own device evidence did not need to be redone. Installed APK as of this report:
`w209-off.apk` (sha256 `3c454801…a22`); wm size/density and the three motion scales are unchanged
(native `1440x3120@560`, scales `1 1 1`).

## Non-goals honoured

No asset was changed (W5-12, W5-13 territory). No API 33+ system image was downloaded.

## Gates

- `node scripts/art/icon-audit.mjs`: exit 0, run twice, byte-identical stdout (determinism check for a
  measurement script).
- `npx tsc --noEmit`: see the W5-15 report's combined gate run (both new files type-checked/lint together
  since they share one `tsc` invocation for this handback) — this file itself is plain `.mjs`, outside
  `tsc`'s TS project; nothing here changes TypeScript surface.
