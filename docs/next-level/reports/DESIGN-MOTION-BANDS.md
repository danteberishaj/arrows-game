# DESIGN-MOTION-BANDS report: fold the flagged W2/POLISH motion effects into DESIGN.md's bands

- **Status:** DONE.
- **Base:** `00af43e` on `next-level` (BASE named in the dispatch). No git command that changes
  state was run; the controller owns git (`.superpowers/sdd/TASKS/codex/GLOBAL.md`).
- **Scope:** only `DESIGN.md`'s Motion section, bands above the `Reduce motion` subsection
  (`Tap-local feedback` and `State / screen transitions`); plus this report. The `Reduce motion`
  subsection W2-02 wrote (lines ~322-364 at BASE) was not touched, per the brief. No code, test,
  or other doc file changed.

## What changed

`DESIGN.md`, two bands:

- **`### Tap-local feedback — 180-320 ms`**: added four sub-effects, each a new bullet (or nested
  bullet under the effect it modifies), all `META_*`-flagged and default OFF:
  - **Arrow exit, launch curve** (`META_EXIT_TO_SCREEN_EDGE`, POLISH-T10): the ease-out
    `launch·k + (1-launch)·k²`, `launch = 1.15` (`EXIT_EDGE_LAUNCH`, `src/ui/exitToScreenEdge.ts:40`),
    the lengthened ray (`EXIT_EDGE_ONSCREEN_MAX`, `:47`), the 88-185 ms visible run
    (`exitOnScreenMs`, `src/ui/exitAnimationConfig.ts:82`), and the fix-round-1 `endAtExtent` stop
    (`src/ui/exitToScreenEdge.ts:201-206`) — nested under the existing "Arrow exit (slither)" bullet.
  - **Blocked bump, magenta hold** (`META_BLOCKED_INK_HOLD`, W2-09): pure `heart` through the
    lunge's peak (`BLOCKED_BUMP_PEAK_K`, `src/ui/feedbackCurves.ts:28`), then a smoothstep release
    (`:70-81`) — nested under "Blocked bump".
  - **Heart refill pop** (`META_HEART_REFILL_POP`, W2-07): starts at scale 1/1.35 ≈ 0.74
    (`HEART_PIP_REFILL_START_SCALE`, `src/ui/heartPip.ts:23`), springs to 1 with the loss pop's own
    spring (`HEART_PIP_SPRING`, `src/ui/GameScreen.tsx:1304,1336`) — nested under "Heart pop".
  - **Button press spring** (`META_PRESS_SPRING`, POLISH-T9/POLISH-T11): 90 ms ease-out press-in
    (`PRESS_IN_MS`, `src/ui/PressScale.tsx:24,84-88`), spring release (damping 15, stiffness 400,
    mass 1, `:26-27,34,94-99`), settling at relative energy 1e-4 in ~0.61 s instead of Reanimated's
    default ~1.26 s (`RELEASE_ENERGY_THRESHOLD`, `:36-43`) — new top-level bullet.
- **`### State / screen transitions — 180-380 ms`**: fixed the stale "Menu ↔ game" citation and
  added two new bullets plus a rewrite of the "Not animated today" paragraph:
  - **Menu ↔ game citation fixed**: `App.tsx:63,75` (now telemetry code, unrelated to any fade) →
    `screenHandoff.tsx:160` (`FadeIn.duration(180)`, inside `ScreenSlot`, PERF-DEADTAG), wired at
    `App.tsx:346,349,353,358` for menu/game/daily/gallery. Added one clause on the leaving-screen
    hand-off (PERF-DEADTAG's frame-delay fix), since the old "removed at once" wording no longer
    matched the current mechanism.
  - **Level → level** (`META_LEVEL_TRANSITION`, W2-04): the 180 ms cover / 180 ms uncover flat scrim
    (`SCRIM_COVER_MS`/`SCRIM_UNCOVER_MS`, `src/ui/ScreenScrim.tsx:20-21`; wired `GameScreen.tsx:291`)
    — new bullet, replacing the old placeholder text ("a transition is specified by the W2
    level-transition task", which predates W2-04 actually shipping it behind a flag).
  - **Theme toggle** (`META_THEME_TRANSITION`, W2-08): the same 180/180 dip through the destination
    background, reusing W2-04's primitives (`src/ui/themeTransition.ts`; wired `App.tsx:256-261`) —
    new bullet (the theme toggle had no entry in this band at all before).
  - **"Not animated today" paragraph, win/lose panel entry rewritten**: fixed the stale
    `GameScreen.tsx:119,147` citation (now unrelated imports/constants) to `gameSessionLifecycle.ts:18-19`
    for `LOSE_PANEL_DELAY_MS`/`WON_PANEL_DELAY_MS`, wired at `GameScreen.tsx:531,641`; added the
    `META_POST_CLEAR_TIMELINE` (W2-06) flagged alternative (exit-visible-time + 350 ms provisional
    hold, `EMPTY_BOARD_HOLD_MS`, `gameSessionLifecycle.ts:27`) and the `META_PANEL_MOTION` (W2-05)
    flagged panel entrance/exit (win 180 ms / loss 260 ms **owner pick 2026-09-25** / exit 180 ms,
    `src/ui/overlayPresence.ts:29,34,36`, easing `src/ui/PanelPresence.tsx:21-22`). Kept the
    "button press... no tween either way" sentence's own (pre-existing, out-of-scope) citations
    untouched and added one clause cross-referencing the flagged press spring in Tap-local feedback.

No other text in the Motion section was touched. The `Reduce motion` subsection already covered
`META_LEVEL_TRANSITION`, `META_THEME_TRANSITION`, `META_PANEL_MOTION`, `META_HEART_REFILL_POP` and
`META_PRESS_SPRING`'s reduced-motion behaviour (W2-02); its cross-references (`GameScreen.tsx:291`,
`App.tsx:257`, `screenHandoff.tsx:159-160`) were re-checked against the current tree and are still
accurate, so nothing there needed to change.

## Sources read

Reports: `docs/next-level/reports/{W2-04,W2-05,W2-06,W2-07,W2-08,W2-09,POLISH-T9,POLISH-T10,POLISH-T11,PERF-DEADTAG}.md`.
Git history for the one fact no report states outright: `git log --oneline --all | grep -i panel`
found commit `87ec519` ("record the owner's pick of 260 ms for the loss-panel entrance",
2026-09-25), whose diff changes `overlayPresence.ts`'s comment from "provisional middle candidate"
to `// OWNER PICK 2026-09-25 ("keep 260")`. W2-05's own report still says "260 ships provisionally"
and lists the loss duration among open owner acceptances — the commit is the actual ruling and is
what the brief's "loss 260 ms owner pick 2026-09-25" refers to. The overall `META_PANEL_MOTION`
flag is still default OFF / owner-acceptance-pending (win entrance, exit and Decision 3 are still
open per the report); only the loss-duration *number* was picked. DESIGN.md's new text says this
precisely ("owner acceptance pending, except the loss duration below" / "owner pick 2026-09-25").

For the press-spring settle time, POLISH-T9's own report left `energyThreshold` untouched (~1.26 s
tail, "left for a ruling") and POLISH-T11's report explicitly states "I did not change it: it is a
picked number" and offers the owner a choice ("accept / trim"). The actual trim is in a later
commit, `fae213a` ("perf(POLISH-T11): whole-round fps gate report; the press spring stops
redrawing ~0.6 s sooner"), which adds `RELEASE_ENERGY_THRESHOLD = 1e-4` to `PressScale.tsx` — found
by `git log -p -- src/ui/PressScale.tsx` after noticing the live source already had a constant
neither report's prose described. DESIGN.md cites the live constant and its value, not either
report's narrative, since the constant is what is actually in the tree.

## Values not invented

Every duration, curve expression and constant name in the new text was read from the live source
listed above (grepped, then opened to confirm the surrounding line numbers) or copied verbatim from
a report's own stated number (e.g. "263-360 ms of empty board" from W2-06, "88-185 ms" from
POLISH-T10). `EMPTY_BOARD_HOLD_MS = 350` is labelled "provisional" because W2-06's own status line
says the flag "stays OFF until the owner picks the numbers" from its candidate table — no owner
ruling for that number exists in the repo (checked: no commit touches `gameSessionLifecycle.ts`
after W2-06 landed, and `docs/next-level/progress.md` was not updated past 2026-09-17).

## Gates

- `npx tsc --noEmit`: **exit 0** (EXECUTED). DESIGN.md is documentation; this is the sanity gate
  the brief names, not a functional test of the doc's content.

## Decisions

1. **Flagged effects that modify an existing bullet are nested under it** (blocked bump, heart pop,
   arrow exit curve) rather than given a fully separate top-level bullet, since they change the same
   physical feedback rather than adding a new one. The press spring and the two new screen-transition
   effects (level→level, theme toggle) are new top-level bullets, since nothing today occupies that
   slot.
2. **Band bounds (180-320 ms, 180-380 ms) were left unchanged.** DESIGN.md's own rule states a
   band's bounds are "the min and max duration of the *shipped* timed effects in it" — every effect
   added here is default OFF, so none of them is shipped in that sense regardless of its own
   duration, and the existing bound numbers still describe only the always-on effects.
3. **The win/lose panel paragraph stays under "Not animated today"** rather than being promoted to
   its own bulleted entry, because the *default* (flag-OFF) behaviour is still exactly "appears
   without animation" — that heading is still literally true; only the flagged alternatives are new.
4. **Fixed two more stale citations while rewriting their sentences** (`GameScreen.tsx:119,147`
   for the panel-delay constants) beyond the one citation the brief named
   (`App.tsx:63,75` → `screenHandoff.tsx:160`), since I was already rewriting that exact sentence to
   add the W2-06/W2-05 material and leaving a citation I knew to be wrong in the same sentence would
   be worse than the brief's letter. I did not go further than that.

## Concerns

1. **Other stale citations exist nearby that I did not fix**, because they sit in sentences I was
   not otherwise touching and fixing them is a broader citation audit than this brief scopes:
   - The "button press" sentence's own citations (`HeaderButton.tsx:32`, `HomeScreen.tsx:86`,
     `GameScreen.tsx:281,297`) no longer point at the press-snap code (POLISH-T9 replaced it with
     `PressScale`/`pressSnapTransform`; the real call sites are now `HeaderButton.tsx:85`,
     `HomeScreen.tsx:198,357,385`, `GameScreen.tsx:932,961`).
   - The "Arrow exit (slither)" bullet's own citations into `exitAnimationConfig.ts` (`:15,22-24,35-40`
     and `:46`) have shifted from W2-06's and POLISH-T10's edits to that file; I did not re-verify or
     re-point them, only added a new nested bullet next to them with fresh, verified citations.
   These are pre-existing drift, not something this task introduced, and are worth a follow-up
   citation sweep of the whole Motion section rather than a piecemeal fix.
2. **`EMPTY_BOARD_HOLD_MS = 350` and `FINAL_EXIT_FACTOR`'s owner pick are still open** (W2-06); the
   DESIGN.md text says so explicitly ("provisional", "the owner has not yet picked"). If the owner
   later picks a different hold or a factor > 1, this paragraph needs a numbers update, not a
   structural one.
3. **I did not verify any of this on device or in a running app** — this is a documentation-only
   task; every number is either a source-level constant or a figure a prior report already measured
   and stated. UNVERIFIED beyond `tsc`.
