# First-session playtest: W1 tutorial + generator v2 (W3-17), 2026-10-06

- **Status: DRAFT. No sessions have been run, and this file holds no results.**
- **Owner:** runs the sessions and sends back one saved log file per participant session.
- **Agent:** generates the tables in (f) from those files with `scripts/analysis/ftue-playtest-tables.mjs`, then
  pastes the raw logs into (g). The agent reports n, median and max only.
- **Builds:** `~/Desktop/Arrows-playtest-2026-10-06/`. Build details and proofs are in
  [docs/next-level/reports/W3-17-prep.md](next-level/reports/W3-17-prep.md).

| APK | What it deals | sha256 |
|---|---|---|
| `arrows-playtest-V2-c2b64ce.apk` | **V2:** generator v2 on (`GEN_V2_ENABLED` set by a throwaway edit, since reverted) | `a55fcfb2625b32a783602b15eba0d08771c2bf754db89560bcf6f19e922e7522` |
| `arrows-playtest-V1-c2b64ce.apk` | **V1:** generator v1 (today's levels) | `43ec2ae81b0b131c81fc86b58ae99de91e75863f169fc8d65b3ce760593caf08` |

Both APKs have the W1 first-session flags on: the T1/T2 tutorial, T2's free first blocked tap, and the real-board
assist. The stall-hint switch is on but has no effect, because no delay has been picked. Both also have the `[ftue]`
session log and **Google test ads**. Every other feature flag is off, as in today's player build.

A fresh install sees this first session. These numbers come from `artifacts/W3-17/expected-boards.ts`.

| Board | V2 | V1 |
|---|---|---|
| T1, T2 (tutorial) | 5×5, 6 arrows; 5×5, 5 arrows | the same |
| Level 1 | Diamond 14×14, **24** arrows | Circle 20×20, **60** arrows |
| Level 2 | Teacup 12×13, 23 | Circle 21×21, 74 |
| Level 3 | Plus 16×16, 32 | Triangle 37×37, 139 |
| Level 4 | Triangle 15×15, 23 | Rectangle 16×24, 95 |
| Level 5 | Hourglass 16×13, 25 | Diamond 29×29, 106 |

Every board starts with 3 hearts.

## (a) Purpose

The difficulty probe measures how hard a board is to search. It does not measure a person. W1 (the tutorial and
the forgiving first blocked taps) and W3 (generator v2's smaller early boards) both aim to soften a new player's
first session. Only first-time players can show whether that works:
- whether the stack lands;
- whether it overshoots, so the game feels trivially easy;
- whether level 1 still loses people.

This playtest watches about five people who have never played Arrows. Each plays their first session on the
flags-on build. The session log is recorded so that taps, blocked taps, hearts lost, time and outcome per board
come from the phone, not from memory. The results feed two decisions:
- whether v2 ships (`GEN_V2_ENABLED`; W3-21 keeps it off until this report exists and the owner says yes);
- whether `FTUE_ASSIST_ENABLED` turns on (W1-06 gates it on this report).

The owner may re-pick level 1 or the curve (W3-13, W3-16) if the tables argue for it. This doc makes no
statistical claim. With n ≈ 5 it reports raw rows, n, median and max.

## (b) Logistics (recommendation)

**Setup: one phone (the owner's), one laptop, participants in turn.**

1. **Phone.**
   - It must not already have Arrows installed. A Play copy has a higher version code (Play builds have reached
     versionCode 15; these APKs are 6). It is probably also signed with Play's app-signing key rather than the
     upload key these APKs use; that is inferred and has not been checked. `adb install` then fails with
     `INSTALL_FAILED_VERSION_DOWNGRADE` or `INSTALL_FAILED_UPDATE_INCOMPATIBLE`.
   - Uninstalling a Play copy deletes that copy's progress. That is the owner's call. Alternatively, use a phone
     that never had Arrows.
   - Turn on Developer options › USB debugging. Set the sound to a normal level.
2. **Laptop.** Android platform-tools (`adb`) and the phone connected by USB. Check that `adb devices` lists the
   phone as `device`.
3. **Install the first build of the day:**
   `adb install -r arrows-playtest-V2-c2b64ce.apk`
4. **Before each participant session**, run these steps in this order. `pm clear` wipes the app's data, so each
   participant gets a true fresh install that starts at the T1 tutorial.

   ```sh
   adb shell am force-stop com.danteb.arrows
   adb shell pm clear com.danteb.arrows                         # true fresh install
   adb logcat -c                                                # empty the log buffer
   adb logcat -v time -s ReactNativeJS:I > P1-1-V2.txt          # leave running for the whole session
   ```

   Then unlock the phone, open Arrows from the launcher, and hand the phone over at the menu.
5. **After the session**, press Ctrl-C in the logcat window. Check that the file is not empty:
   `grep -c '\[ftue\]' P1-1-V2.txt` should print more than 0.
6. **File names matter.** Name each file `P<participant>-<session 1 or 2>-<V1 or V2>.txt`, for example `P1-1-V2.txt`
   and `P1-2-V1.txt`. The parser reads the participant, the order and the build from the name, and rejects any
   other name. It also cross-checks the build against the log: v2 boards print `gen=2`.
7. **Switching builds** (only if you run the comparison in (d)). Install the other APK over the first, then do
   step 4 again. The `pm clear` in step 4 is the reset between builds.

   ```sh
   adb install -r arrows-playtest-V1-c2b64ce.apk
   ```

8. **Send back** every `P*.txt` file unedited, plus your notes and the answers to the one question in (c).

**Ads.** These are Google **test** ads, labelled "Test Ad". After a participant has finished two real levels, a
test interstitial can appear when they press "Next level". The lose panel's "Continue +♥ (ad)" and the 💡 hint
also play test ads. They are part of the product a new player meets. Let participants deal with them as they
would, and say nothing. A test ad earns nothing and bills no one.

**Fallback if no laptop is available.**
- **The app has no in-app way to get the `[ftue]` lines out.** It has no share, export, copy or file-save path;
  the lines go only to the Android log. Nothing was added for this playtest.
- So without a laptop at the session:
  - **Reset** each participant with Settings › Apps › Arrows › Storage › **Clear storage**. This equals `pm clear`.
    Install the APK from the phone's file manager. Allow "install unknown apps" for that file manager once.
  - **Record by hand**, per participant and per board: the level reached, cleared or not, hearts left at the
    clear, roughly how long it took, and whether they lost all hearts. You may also use Android's built-in Screen
    record (Quick Settings) and send the video.
  - These hand-recorded rows cannot be parsed or reconciled against `arrowCount`. The agent will mark them
    "hand-recorded, not reconciled". Taps and blocked taps will be missing.
- A laptop afterwards does not reliably recover the log. The phone's log buffer is small, so a session may have
  scrolled out by the time it is read. Before the first session, Developer options › Logger buffer sizes › 16M
  improves the odds. Even then, run `adb logcat -d -v time -s ReactNativeJS:I > all.txt` as soon as possible after
  the sessions. Recovery is still not guaranteed (UNVERIFIED). The agent would then have to split that file by
  hand: each `pm clear` starts a new app process ID.

## (c) One-page no-coaching script

**Before (read this aloud, then nothing else):**
> "This is a puzzle game I'm testing. The game is being tested, not you. Please play the way you would if you'd
> just downloaded it. I won't answer questions or help while you play; that's part of the test, not me being
> rude. You can say what you're thinking if you like, but you don't have to. I'll stop you after about ten
> minutes. Ready? It's open at the menu."

**During:**
- Stay silent and keep your face neutral. Sit beside or behind them, not opposite them.
- Write down the time at start, at every loss panel, and at stop. Note anything they say out loud and every
  visible hesitation (for example "stared 20 s, then tapped").
- If they ask anything ("What do I do?", "Is that bad?", "Do I watch the ad?"), say only:
  > "I can't help during the test. Do whatever you'd do at home."
- If an ad appears, say nothing. If they want to quit, let them, and note the time and the board.
- If the app crashes or the phone locks, note the time and board. Reopen it once, without comment.

**Stop rule:** stop at **about 10 minutes** of play, or as soon as the **level 5 win panel** ("Cleared!" on Level 5)
appears, whichever comes first. Do not stop in the middle of a loss panel. Let them press Retry, Continue or Home
first.

**After (one question only):**
> "What was confusing?"

Write the answer down word for word. Don't follow up, explain, or tell them how it works, even after.

**You must not:**
- explain the rules, or say "arrows", "slide", "blocked", "hearts" or "tap";
- point at, touch or demonstrate on the screen;
- react to a mistake or a loss (no sighs, "oops" or "almost");
- praise or encourage ("nice", "you've got it");
- say how many levels there are, that there are two versions, or which one this is;
- let the next participant watch someone else's session;
- reuse a participant who has played Arrows before (they are not first-time players).

## (d) Order and counterbalancing (OPTIONAL)

**Owner's choice. Run V2 only, or run the V2-vs-V1 comparison:**
- **V2 only (minimum).** Every participant plays one session on V2. Name the files `P1-1-V2.txt` … `P5-1-V2.txt`.
  About 10 minutes each.
- **Comparison.** Every participant plays both APKs, alternating which comes first, with a full reset (install
  plus `pm clear`, section (b) step 7) between the two sessions. About 20–25 minutes each.

  | Participant | Session 1 | Session 2 |
  |---|---|---|
  | P1 | V2 (`P1-1-V2.txt`) | V1 (`P1-2-V1.txt`) |
  | P2 | V1 (`P2-1-V1.txt`) | V2 (`P2-2-V2.txt`) |
  | P3 | V2 | V1 |
  | P4 | V1 | V2 |
  | P5 | V2 | V1 |

  A second session is **not** first-time play: the participant has just learnt the game. So:
  - the tables report "first session only" separately;
  - with five participants that is 3 V2-first and 2 V1-first sessions;
  - read the comparison as direction, not proof.
  Use the same script for session 2, without re-reading the intro. The one question comes after the last session.

W1-09 (the tutorial playtest) may use the same recruits and the same logs. Its data goes in its own doc
(`docs/ftue-playtest-<date>.md`). The parser prints a W1-09 section for that doc separately.

## (e) Pass rule, chosen BEFORE the sessions

**The sessions must not start until the OWNER-PICKED line below is filled in.** A rule picked after seeing the data
is not a pass rule.

- **Draft 1's rule (prefilled, the owner may keep or replace it):** the largest board at which **at least 4 of 5**
  participants clear level 1 without losing all hearts.
  - In this kit, "the board" is level 1 of each APK: V2 = Diamond, 24 arrows; V1 = Circle, 60 arrows.
  - "Without losing all hearts" means the level-1 board was cleared and the lose panel never appeared on level 1.
  - The parser reports this per build, for first sessions and for all sessions ("Pass-rule inputs").
  - **RULING (agent):** if only V2 is run, there is one board size. The rule then reads "V2's level 1 passes if at
    least 4 of 5 first sessions clear it without losing all hearts".
- **Too-easy signal (reported, not a pass/fail gate unless the owner makes it one):** any participant who clears
  levels 1–5 with **zero blocked taps** on those five boards. "Blocked taps" includes the free (assisted) ones.

**OWNER-PICKED: ___________________________________________ (date: __________)**

## (f) Results tables (empty)

Regenerate the tables with:

```sh
node scripts/analysis/ftue-playtest-tables.mjs --out artifacts/W3-17/results/tables.md P1-1-V2.txt P1-2-V1.txt ...
```

The command exits 0 when the tables are complete, and 1 when a file is malformed (no tables are written).

It exits 3 when an integrity check fails. The tables are still written, with `MISMATCH` or **FAIL** lines. An
integrity failure is one of:
- a removal count that does not match `arrowCount` on a cleared board;
- a heart count that disagrees with the clear line;
- a build label that disagrees with the log's `gen=`;
- a restart that the code cannot produce.

No number from a session with an integrity failure is quoted until it is explained.

### Per participant and board attempt

One row per board mount: a Retry or a tutorial re-deal is a new attempt.
- taps = removals + blocked taps;
- hearts lost = blocked taps that charged a heart;
- times are seconds since that board appeared;
- the reconciliation column checks the removal count against `arrowCount`. On a cleared board they must be
  equal.

| participant | session | build | # | board | shape | arrowCount | gen | taps | blocked (charged / grace, assist, repeat) | removals | hearts lost | first removal (s) | time to clear (s) | outcome | removals vs arrowCount |
|---|---:|---|---:|---|---|---:|---:|---:|---|---:|---:|---:|---:|---|---|
| | | | | | | | | | | | | | | | |

### Summary (n, median and max only; no percentiles)

The tool prints this table twice: once for all sessions, and once for first sessions only.

| build | board | n reached | n cleared | n clean clear | taps median / max | blocked median / max | hearts lost median / max | time to clear (s) median / max (n) |
|---|---|---:|---:|---:|---|---|---|---|
| | | | | | | | | |

### Pass rule and too-easy signal

- Pass rule as OWNER-PICKED in (e): ___
- Level 1 cleared without losing all hearts. V2: _ of _; V1: _ of _ (first sessions), _ of _ (all sessions).
- Participants who cleared levels 1–5 with zero blocked taps: ___
- Answers to "What was confusing?" (verbatim, per participant): ___

### What the log cannot fill

The log has no line for these, so these columns stay empty or are derived. No product logging was added.
- **Taps on empty cells, pans and pinches.** Not logged. "taps" counts only taps that hit an arrow.
- **💡 hint use and ads shown.** Not logged. They come from the owner's notes, if at all.
- **Rewarded continue.** Not logged. It is **inferred** when taps continue on a board after its hearts reached 0.
  The outcome then says "(inferred)".
- **Starting hearts.** Not logged. Every board starts with 3 (source); each clear line's hearts-left checks it.
- **Time.** Measured only within a board, from its mount to its clear. Time on menus, panels and ads between
  boards is not in the log, and neither is total session time. Use the owner's notes for that.
- **Build.** Comes from the file name. Tutorials print `gen=1` on both APKs; campaign boards confirm the build.

## (g) Raw logs (appendix placeholders)

The parser appends every session's raw `[ftue]` lines ("Raw [ftue] lines"). Paste them here unedited, one block per
file. The original `P*.txt` files are kept in `artifacts/W3-17/results/` (gitignored).

### P1-1-___.txt
```
(pending)
```
### P1-2-___.txt
```
(pending)
```
### P2-1-___.txt
```
(pending)
```
### P2-2-___.txt
```
(pending)
```
### P3-1-___.txt
```
(pending)
```
### P3-2-___.txt
```
(pending)
```
### P4-1-___.txt
```
(pending)
```
### P4-2-___.txt
```
(pending)
```
### P5-1-___.txt
```
(pending)
```
### P5-2-___.txt
```
(pending)
```

## (h) Device note

The sessions run on **real phones in people's hands**, not on the emulator.

The only run so far is the agent's emulator dry run. It used emulator-5556 (`fleet_floor_api31`, API 31) with
`adb input tap` at computed cell centres. It proved four things:
- the two APKs log every board;
- the parser's numbers match the screen (win-panel arrow counts, header hearts and win stars);
- the reset and capture commands above work;
- the capture command produces a file the parser accepts.

The dry run is **UNVERIFIED-DEVICE**. It says nothing about:
- touch on a phone;
- a first-time player;
- the owner's phone model, screen size or Android version;
- whether these APKs install on that phone.

Details are in [W3-17-prep](next-level/reports/W3-17-prep.md).
