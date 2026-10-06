# Owner rulings, 2026-10-06: four two-minute decisions

Prepared on branch `next-level`, HEAD `15cab37`. Nothing in the product changed. All visuals are in
`artifacts/OWNER-RULINGS-2026-10-06/`. That folder is gitignored, so the files exist only on this Mac.

| # | Decision | Visual to open first | Recommendation |
|---|---|---|---|
| 1 | Is the blocked-tap "lunge" big enough? | `q1-lunge-normal-then-4x-slow.mp4` | Add a 4 pt minimum. No pull-back. |
| 2 | First-session help: words, rules, stall-hint delay | `q2-first-session-screens.png` | Approve everything as built. Keep the stall hint off for now. |
| 3 | Timing after the last arrow, and the outline reveal | `q3-clear-timeline-normal-4x-mockup.mp4` | Set B: a 250 ms pause, then the outline for 400 ms |
| 4 | Daily share card | `q4-share-card-mockup.png` | Yes: purple squares, at most 10 by 10, no link yet |

Lines marked **RULING** are judgement calls made while preparing this packet. They are not facts.
Evidence labels: **MEASURED** = captured and measured. **CODE** = read from the source at the file:line given.
**INFERRED** = computed from code but never captured.

---

## Q1. The blocked-tap lunge (W2-11)

**The question in plain words.** When you tap an arrow that is blocked, it jumps a little toward the blocker and
springs back. This is the "lunge". It is not the exit slither. On a crowded board seen zoomed all the way out, the
jump is tiny. Does it read as a deliberate "I can't go", or should it be bigger?

**Visuals**
- `artifacts/OWNER-RULINGS-2026-10-06/q1-lunge-normal-then-4x-slow.mp4` (7.8 s). Four boards side by side: five
  passes at normal speed, then two passes at 4x slow motion.
- `artifacts/OWNER-RULINGS-2026-10-06/q1-lunge-normal-speed-loop.mp4` (3.0 s, normal speed only).
- `artifacts/OWNER-RULINGS-2026-10-06/q1-rest-vs-peak-reused-W2-10.png`: the arrow at rest next to the arrow at full
  stretch, for each board.

**What you are looking at** (MEASURED in W2-10 on the emulator; 1 pt = 3.5 device px):

| Panel | Board and zoom | Jump on screen |
|---|---|---|
| A | Level 1 (60 arrows), zoomed fully out | **4.1 pt** |
| B | Level 1, zoomed fully in | 15 pt |
| C | 250-arrow board, zoomed fully out | **2.2 pt** (smallest) |
| D | 250-arrow board, zoomed fully in | 14 pt |

Most boards open at about 14 cells across, not fully zoomed out. At that zoom the jump is about **6.5 pt**
(INFERRED from `boardCamera.ts:28, :94`; not captured). Boards small enough to open fully zoomed out jump at
least 5.2 pt. The 2.2 pt case only happens after a player pinches all the way out on a big board.

**Options**

| Option | What changes | Consequence |
|---|---|---|
| **Keep as is** | Nothing. W2-11 closes as "not needed". | Pinched-out big boards keep a ~2 pt jump. The blocker flash and the heart carry the message there. |
| **4 pt minimum** | The jump is never smaller than 4 pt on screen | Only views zoomed out past ~23 cells across change, which means pinched-out big boards (C: 2.2 → 4 pt, the same size as A). Every view you play at normally stays exactly the same. |
| **6 pt minimum** | The jump is never smaller than 6 pt | A becomes 6 pt and C becomes 6 pt. On C that is 0.6 of a cell, so the arrow visibly pokes into its neighbour's square. The opening zoom (6.5 pt) is untouched. |
| *Add-on:* pull-back ("anticipation") | A small backward dip before the jump | At half the jump it is a 0.11-cell dip: about 1 pt on a zoomed-out dense board (invisible) and 2 pt on level 1. On packed boards it pushes into the arrow behind. |

**Recommendation: 4 pt minimum, no pull-back.** It lifts the one view that looks like nothing (C) to the size of
level 1 and leaves every normally played view untouched. (RULING)

**Your choice:** Keep / 4 pt minimum / 6 pt minimum, plus pull-back yes or no.
If A (4.1 pt) also looks too small to you, pick 6 pt.

<details><summary>For the implementer</summary>

- Spec: `docs/next-level/tasks/W2.md` W2-11. Flag `blockedAnticipation`, default OFF. Evidence:
  `docs/next-level/reports/W2-10.md` and `docs/motion-bump-legibility-2026-09-26.md`. Fill in the owner-verdict
  table there: A/B/D read; C = the owner's answer.
- Curve: `src/ui/feedbackCurves.ts:13` (`BLOCKED_BUMP_MS = 300`), `:22` (amplitude 0.5), `:28` (peak k ≈ 0.3195),
  `:31-35` (`blockedBumpAt`, peak 0.2227 cell). Stroke: `src/ui/arrowGeometry.ts:20` (`STROKE = 0.144` cell).
  Consumers: `src/ui/BoardView.tsx:1378` (board units, `CELL`) and `src/ui/StaticBoardSurface.native.tsx:454`
  (`cellSize`). Both keep `reducedMotion ? 0 :`.
- Floor: points ÷ the live cell size in points, so a 4 pt floor is 4 / cellPt cells. Never a multiplier on 0.5.
  Suggested shape: `max(blockedBumpAt(k), (floorCells / 0.2227) · blockedBumpAt(k))`, which keeps the endpoints at 0
  and the peak at k ≈ 0.32. Cell sizes: A 19.34 pt, B 67.68 pt, C 9.92 pt, D 64.0 pt, opening zoom ≈ 29.4 pt
  (`boardCamera.ts:28` `TARGET_CELLS_ACROSS = 14`; `:36` `ZOOM_SKIP_FIT_CELL_PT = 23.5`; `:85-94`). The floor is
  active when cellPt < floorPt / 0.2227: below 17.96 pt for 4 pt, below 26.9 pt for 6 pt.
- A 6 pt floor at C is 0.605 cell, under the ~0.856-cell perpendicular-overlap point from the W2-11 context. An
  8 pt floor (0.81 cell at C) was not offered.
- If pull-back is chosen: `feedbackCurves.test.ts:15` (`d >= 0`) must be replaced by the bounded-minimum assertions
  W2-11 lists, not just deleted. Its duration must be ≥ 2 × P-02's frame period (~34 ms) inside the 300 ms.
- **Needs a build** for W2-11 acceptance (the patched P-02 captures) and for any candidate capture if the owner wants
  to see 4 vs 6 pt before choosing. That build is HEAD plus the W2-11 patch, with
  `EXPO_PUBLIC_META_BLOCKED_ANTICIPATION=1` and the `artifacts/PETAL-ADS-01/build/env.txt` flag set. It is not
  needed to make this ruling.
- Reuse: the W2-10 clips were captured at `32594e7` with `w506-on.apk`. The lunge code has not changed since
  (`git diff 8a5a56d 15cab37 -- src/ui/feedbackCurves.ts` is empty). UNVERIFIED-DEVICE: arm's-length legibility on
  a physical phone.
</details>

---

## Q2. First-session help (W1-11)

**The question in plain words.** A brand-new player gets two tiny practice boards before level 1. They show three
short lines of text, and a few gentle rules forgive early mistakes. Approve or change each item below. Separately,
should a stuck player get an automatic hint, and after how long?

**Visual:** `artifacts/OWNER-RULINGS-2026-10-06/q2-first-session-screens.png`.
- Panels 1-6 are **new**. They were captured today on a fresh install of the installed test build (flags FTUE
  and FTUE_ASSIST on).
- Panels 7-8 are **reused** from W1-10 (2026-09-20). This build has the stall hint switched off, so panel 8 comes
  from W1-10's stall-hint test build (4 s test delay, reduced motion).
- The raw screenshots are in `q2-raw/`.

### Words (approve / change each)

| # | Shown when | Exact text | File:line | Approve / change |
|---|---|---|---|---|
| 1 | Practice board 1 (panel 2) | `Tap an arrow.` | `src/ui/ftueCopy.ts:2` | ☐ / ☐ |
| 2 | Practice board 2 (panel 3) | `One arrow is free. Find it.` | `src/ui/ftueCopy.ts:3` | ☐ / ☐ |
| 3 | First wrong tap on board 2 (panel 4). It wraps to 2 lines on a phone and disappears after the next good tap. | `Blocked. Clear what's in its way.` | `src/ui/ftueCopy.ts:4` | ☐ / ☐ |

Help text that already ships to everyone (listed for completeness; change only if you want to):

| Exact text | Where | File:line |
|---|---|---|
| `Hint` | Screen-reader name of the bulb button | `src/ui/GameScreen.tsx:152` |
| `Hint unavailable ·` | Under the level title when no hint ad loaded | `src/ui/GameScreen.tsx:1096` |
| `No ad available right now — Retry is free` | Lose panel, when no ad is ready | `src/ui/GameScreen.tsx:974` |

### Rules (approve / change each)

| # | Rule as built | Code | Recommendation |
|---|---|---|---|
| R1 | Board 1 has 6 arrows and every one is free, so you cannot lose there (MEASURED today: cleared with 3 hearts). | authored board | Approve |
| R2 | Board 2: your **first** wrong tap is free and shows line 3. A wrong tap on a different arrow then costs a heart (MEASURED: panels 4 and 5). Three charged taps restart board 2. | `src/ui/tapRules.ts:27-29`; `GameScreen.tsx:643-646, :662-665` | Approve |
| R3 | **Assist:** on real levels, wrong taps made **before your first successful tap on that board** are free. This lasts until your first perfect clear (no heart lost). | `tapRules.ts:24-26`; `src/ui/ftueRoute.ts:40-42`; `GameScreen.tsx:572-574` | Approve. No fixed count: any count would be a made-up number. |
| R4 | Tapping the same blocked arrow again never costs a second heart (all players, already shipping). | `tapRules.ts:40-48` | (unchanged) |
| R5 | The practice boards do not count toward "puzzles solved" or the day streak. | `GameScreen.tsx:555-567` (no `registerSolve`) vs `:575` | Approve. Counting them would hand out stats nobody earned. |
| R6 | Existing players (any progress saved) never see the practice boards. | `ftueRoute.ts:35` | Approve |
| R7 | A future "reset progress" button should also reset the tutorial stage. Nothing in the app can reset today. | `src/core/saveSystem.ts:790` | Approve for later. No change now. |

### Stall-hint delay

The automatic hint lights up the free arrow (panel 8). It works only on the two practice boards, and only after
this long without a successful tap. Wrong taps do not reset the clock (`GameScreen.tsx:359-376, :534`). Today it
is **off**: `FTUE_STALL_HINT_MS = null` (`src/ui/ftueConfig.ts:5`).

| Option | Consequence |
|---|---|
| **Off** (today) | Nobody is ever handed the answer. A truly stuck player can still find the free arrow by trial and error: 5 arrows, the first mistake is free, then 2 hearts. |
| **10 s** | A safety net that rarely fires. Ten seconds with no progress on a 5-arrow board means "stuck", not "thinking". |
| **6 s** | Fires for slow readers too. It can give away board 2's single lesson ("find the free one") before they have looked at all 5 arrows. |
| 4 s | The value used only for W1-10's test capture. Too eager for real players. |

There is no player data yet. W1-09's playtest (5 new players, BLOCKED-ON-OWNER) has not run, and W1-10's 0.76 s first success is n = 1 by someone
who knew the rules. Every number above is an **OWNER-PICKED STARTING VALUE**, not a measurement.

**Recommendation: approve words 1-3 and rules R1-R7 as built, and keep the stall hint off.** The first-session
playtest kit (W3-17) can supply real stall times. If anyone stalls more than ~10 s on board 2 there, turn the hint
on at 10 s. (RULING for the 10 s.)

**Your choice:** for each of 3 words and 7 rules, approve or change. Stall hint: off / 10 s / 6 s.

<details><summary>For the implementer</summary>

- Spec: `docs/next-level/tasks/W1.md` W1-11. Earlier packet: `docs/ftue-acceptance-2026-09-20.md` and
  `docs/next-level/reports/W1-10.md`.
- Flags: `src/ui/ftueConfig.ts:1-5` (`FTUE_ENABLED`, `FTUE_ASSIST_ENABLED`, `FTUE_STALL_HINT_ENABLED`,
  `FTUE_STALL_HINT_MS`). Copy: `src/ui/ftueCopy.ts:2-4`. Line rendering: `GameScreen.tsx:1068-1073`
  (`numberOfLines={2}`), initial line `:1196-1199`, set on grace `:645`, cleared on the next removal `:536`.
  After that removal the T2 header line is blank. That is the build's behaviour, seen in code, not captured.
- One commit per approved flag, then re-run W1-10 scenarios A and B on that commit (spec).
- **Already enabled by env in internal builds:** `artifacts/ART-SKINS-08/release/build-aab16.sh:14` exports
  `EXPO_PUBLIC_FTUE=1 EXPO_PUBLIC_FTUE_ASSIST=1` for the vc16 Play internal-testing AAB. W1-11's approval is what
  makes those the committed defaults.
- Assist is spec-gated on W3-12 and W3-17 as well (W1-11 "Depends on").
- Capture context for panels 1-6:
  - device: `emulator-5556`, API 31, 1440x3120 @560, scales 1/1/1;
  - build: installed APK sha `c2967710…f340` (`artifacts/PETAL-ADS-01/build/test-ads.apk`, built at `8a5a56d`);
  - copy, rules and FTUE code are identical at HEAD (`git diff 8a5a56d 15cab37 -- src/ui/ftueCopy.ts
    src/ui/ftueConfig.ts` is empty; HEADER-FIT changed only the non-tutorial header);
  - host load averaged 50-65 during capture, which is why the blocked-tap flash is not visible in panels 4-5.
- Fresh state came from `pm clear` after a byte-exact backup, which was restored afterwards (see "Device" at the end).
</details>

---

## Q3. After the last arrow: timing and the outline reveal (W5-17 + W2-06)

**The question in plain words.** When you clear a board, the last arrow slithers away. The empty board pauses for
a moment, then the win panel slides in. We could also draw the outline of the shape you just cleared during that
pause, like "this is what you made". Pick one timing set: how long the pause is, whether the outline appears, and
for how long.

**Visuals**
- `artifacts/OWNER-RULINGS-2026-10-06/q3-clear-timeline-normal-4x-mockup.mp4` (12.3 s). One level-1 clear, played
  twice at normal speed and once at 4x slow motion, with a timeline bar underneath. It ends with a **mock-up** of
  the outline fading in (the outline is not built).
- `q3-clear-moments-with-outline-mockup.png`: five moments side by side, including the mock-up.
- `q3-timing-options.png`: the three timing sets, drawn to scale.
- `q3-reused-W2-06-hold-candidates-x1.mp4` / `-x4.mp4` / `-strip.png`: W2-06's six real pause candidates
  (250 / 350 / 500 ms, slither x1.0 / x1.5) side by side.

**Today** (CODE, MEASURED in W2-06; the same timing as the installed build and the vc16 internal build):

| Step | Value | Source |
|---|---|---|
| Last arrow on screen | 0.09-0.19 s (depends on how far it travels) | W2-06 `visrange-L0-39.txt`; slither factor `FINAL_EXIT_FACTOR = 1.0` at `src/ui/exitAnimationConfig.ts:54` |
| Empty-board pause | 350 ms (measured 340-380 ms) | `EMPTY_BOARD_HOLD_MS` at `src/ui/gameSessionLifecycle.ts:27` |
| Outline reveal slot | 0 ms (not built) | `CLEAR_REVEAL_MS` at `src/ui/gameSessionLifecycle.ts:29` |
| Panel starts | 0.44-0.54 s after the last tap | `wonPanelDelayMs` at `gameSessionLifecycle.ts:36`, used at `src/ui/GameScreen.tsx:552-554` |
| Panel slides in | 180 ms; stars start 250 ms after it begins | `src/ui/overlayPresence.ts:31, :42` |

**Options** (pick one set):

| Set | Slither | Pause | Outline | Panel starts after the last tap | Consequence |
|---|---|---|---|---|---|
| **A**: keep today, no outline | x1.0 | 350 ms | none | 0.44-0.54 s | Snappy. W5-17 is shelved. The cleared shape is only shown as the small badge on the panel. |
| **B**: short outline beat | x1.0 | 250 ms | 400 ms (150 ms fade-in, then held) | 0.74-0.84 s | The shape you cleared appears on the board, then the panel. About 0.3 s longer per level. Every slither keeps the same speed. |
| **C**: savour the clear | x1.5 (slower last arrow) | 350 ms | 600 ms (200 ms fade-in) | 1.09-1.23 s | Clearly ceremonial. The last arrow moves visibly slower than every other. About 0.65 s longer per level, which adds up over a session. |

With reduce-motion on, the outline is skipped in every set and only the pause remains (W5-17 rule).

**Recommendation: B.** The game is built around shapes, so a short "here's what you made" beat is worth 0.3 s.
B keeps every arrow moving at the same speed, and the badge on the panel then echoes the outline.
(RULING. The outline's look and its 400 ms have not been seen in motion. The animated outline in the clip is a
mock-up.)

**Your choice:** A / B / C.

<details><summary>For the implementer</summary>

- Specs: `docs/next-level/tasks/W5.md` W5-17 (`ART_CLEAR_REVEAL_ENABLED`, default OFF; not built) and
  `docs/next-level/tasks/W2.md` W2-06 (built; report `docs/next-level/reports/W2-06.md`, decision table there).
- Set → constants:

  | Set | `FINAL_EXIT_FACTOR` | `EMPTY_BOARD_HOLD_MS` | `CLEAR_REVEAL_MS` | Reveal fade-in |
  |---|---|---|---|---|
  | A | 1.0 | 350 | 0 | n/a |
  | B | 1.0 | 250 | 400 | 150 |
  | C | 1.5 | 350 | 600 | 200 |

  The reveal fade-in values are **OWNER-PICKED STARTING VALUES** proposed here. The won-delay ranges use the fit
  visible range 90..187 ms × the factor.
- Factor 1.5 keeps every duration inside the parsers' 160..1000 ms band (`exitAnimationConfig.ts:10-11`; max 320 ×
  1.5 = 480). Any factor > 1 must keep the comment at `exitAnimationConfig.ts:49-53` that the speed invariant is
  broken on purpose (W2-06 acceptance 4).
- Reduced motion: W5-17 mounts nothing. Pass a 0 ms reveal then, for example
  `wonPanelDelayMs(exit, EMPTY_BOARD_HOLD_MS, reducedMotion ? 0 : CLEAR_REVEAL_MS)`, so the panel is not delayed by
  an invisible outline. This is not in either spec. RULING proposal.
- Open spec point: W5-17 says "unmount at phase change". The panel's scrim starts at opacity 0 when the won phase
  commits (`overlayPresence.ts:31`, 180 ms entrance), so an unmount at that commit pops the outline off in plain
  view. Keep it mounted until the entrance ends, or fade it with the scrim. This is a mock-up observation, not
  captured.
- The mock-up outline is the cell-boundary loop of level 0's mask (`LevelGenerator.generate(0, 1)`, Circle 20x20),
  drawn like `src/ui/silhouette.ts:90` at 2 dp. It is registered to the frame from the opening frame's ink bounding
  box: x matches W2-06's camera `tx`, and the origin is y = 1036.3 px.
- W2-06's `plan-L0-fit-registered-camera.json` `ty` (208.65 dp) is relative to the board view, not to the screen.
  The screen origin is 87.4 dp lower.
- Reused capture: `artifacts/W2-06/cap/on-long-r3.mp4`, the W2-06 ON build (factor 1.0, hold 350, fit camera without
  `META_ZOOMED_CAMERA`), 120 frames, median frame period 16.89 ms, no stall in the exit. Phase times are from its
  `on-long-r3-timeline.json`: on screen 181.1 ms, hold 348.6 ms. Frames were picked by last PTS ≤ t (VFR-safe).
- **Needs a build** to close W5-17 (registration, timing and reduce-motion captures, A/B/A perf), not to make this
  ruling. That build is HEAD plus the W5-17 patch with `EXPO_PUBLIC_ART_CLEAR_REVEAL=1` (flag name per the spec's
  `ART_CLEAR_REVEAL_ENABLED`), the chosen constants, and the PETAL-ADS-01 env flag set.
</details>

---

## Q4. The daily share card (W4-13)

**The question in plain words.** After winning the daily puzzle, a player could tap "Share" and send a small
text picture of the day's shape to a friend, like Wordle's grid. Do you want this? If yes, which look?

**Visual:** `artifacts/OWNER-RULINGS-2026-10-06/q4-share-card-mockup.png`. It shows today's real daily board
(Pentagon, 2026-10-06) as a chat message in four variants, light and dark, plus the worst case: a tall shape
(Bolt).

**What the card reveals** (privacy):
- The date and the day's shape name. These are the same for every player that day.
- Hearts left (for example 3/3).
- The player's day streak (for example 7). This is the only personal stat, and it is a number the player chose to
  send.
- **No** name, account, device, location, level number, link-tracking code or ad ID.
- The app sends nothing by itself. Android's share sheet hands the text to the chat the player picks, and the
  player can edit it before sending.

**Options**

| Option | Consequence |
|---|---|
| **No**: cut W4-13 | Nothing to build. The daily stays a solo ritual. |
| **Yes, recommended look:** purple squares 🟪⬜, the shape fitted inside a 10 x 10 box, no link | At most 10 rows and 261 characters on any day for 10 years (measured over days 0-3649). Purple matches the app. Emoji fonts draw both squares at the same width, so rows should line up (UNVERIFIED on a real phone). Very tall shapes get thin: Bolt becomes 4 columns wide and loses its zig-zag. |
| Yes, W4-12 as written: 10 wide, any height | Same look, but tall shapes get long: Bolt is 28 rows and 468 characters, a scroll in a chat. |
| Glyph alternative: black/white ⬛⬜ | Neutral, Wordle-like, not on-brand. |
| Glyph alternative: plain ■□ | Shortest text. The two symbols can have different widths in some phone fonts, which shears the picture (UNVERIFIED). |
| Add a Play Store link | +65 characters. Only worth it once the store listing is public. A dead link in friends' chats is worse than none. |

**Recommendation: yes. Purple squares, at most 10 by 10, no link for now.** It is a free, organic way for players
to show off the daily. It reveals nothing personal beyond a streak number the player chooses to send, and the
10 x 10 cap keeps every card short. (RULING. The 10 x 10 cap was not one of W4-12's widths. It answers W4-12's
finding that every fixed width overflows on tall shapes.)

**Your choice:** No / Yes. If yes: the glyphs (🟪⬜ / ⬛⬜ / ■□), the size (10 x 10 box / a fixed width of 8, 10,
12 or 16), and link or no link.

<details><summary>For the implementer</summary>

- Specs: `docs/next-level/tasks/W4.md` W4-12 (done; report `docs/next-level/reports/W4-12.md`, sheets in
  `artifacts/W4-12/`) and W4-13. Flag `META_SHARE_CARD`, default false. W4-13's status line must record build/cut,
  URL, glyph set, width, and the length ceiling.
- Work (effort S per spec; no new dependency, since RN's `Share.share({ message })` is enough):
  - a new pure `src/ui/shareCard.ts` (`buildDailyShareText`);
  - `src/ui/__tests__/shareCard.test.ts`, written first: cell-by-cell against the cropped and downsampled mask over
    days 0..3649, equal glyphs per row, length ≤ the ruled ceiling, no `?`, `&`, `utm_` or level index;
  - one Share control on the **daily** win panel only (`src/ui/GameScreen.tsx`);
  - the flag in `src/featureFlags.ts`;
  - three P-02 captures: the campaign panel without the button, the daily panel with it, and the share sheet showing
    the text.
- "10 x 10 box": wide shapes downsample to 10 columns (as in W4-12). Tall shapes downsample to 10 rows, with columns
  = round(10 · w / h). Measured worst cases over days 0..3649 (example header with streak 365): box 10 rows, ■□ 172
  and 🟪⬜ 261 UTF-16 units; fixed width 10: 28 rows, 366 and 468. Script:
  `artifacts/OWNER-RULINGS-2026-10-06/scripts/q4-cards.ts` (output `q4-cards.json`). It copies W4-12's crop and ≥50 %
  box downsample, because that script exports nothing.
- Suggested ceiling for the recommended look: 280 UTF-16 units. That is the measured 261 plus room for a 4-digit
  streak. RULING.
- If a link is ever ruled in: the Play URL contains `?id=`, so the "no `?`" test must exempt exactly the
  owner-ruled URL (the spec already allows "the owner-ruled URL is the only URL allowed").
- Mock-up rendering: Apple Color Emoji and Apple Symbols on macOS. Android's Noto emoji are flat squares.
  UNVERIFIED-DEVICE: how the card looks pasted into WhatsApp or Messages on a physical phone, including emoji
  advance width.
</details>

---

## Device, reuse and builds

- **Reused:**
  - Q1: W2-10's four-board clips and rest-vs-peak sheet, re-cut with labels.
  - Q2 panels 7-8: W1-10 screenshots.
  - Q3: W2-06's `on-long-r3.mp4` recording, re-cut with a timeline and a mock-up, plus W2-06's candidate clips,
    copied.
- **New:** the Q2 panels 1-6 screenshots (a fresh install state on the installed build), the Q3 outline mock-up and
  options chart, and the Q4 card render from the real `generateDaily` masks.
- **No build was made.** None of the four rulings needs one. Builds are needed afterwards, to implement W2-11 and
  W5-17 (listed in their implementer notes).
- **Device:** `emulator-5556` only. App data was backed up byte-exact before `pm clear`: `su 0 tar`, sha
  `d9c9d46d…a466`. It was restored afterwards: the re-tar sha is equal, `ls -laR` is identical, and the animation
  scales, font scale and `wm` are identical. The installed APK was untouched (sha `c2967710…f340`). Scripts:
  `artifacts/OWNER-RULINGS-2026-10-06/scripts/backup.sh` and `restore.sh`. Proof:
  `artifacts/OWNER-RULINGS-2026-10-06/device/`. No ad appeared, and nothing was tapped on an ad.
