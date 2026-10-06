import {
  buildTutorialLevel,
  generateDaily,
  LevelGenerator,
  resolveGenVersion,
  SaveSystem,
  type GeneratedLevel,
  type GenVersion,
  type TutorialId,
} from '../core';
import { DEV_GEN_VERSION, PERF_GEN_VERSION, PERF_MODE } from '../perfMode';
import type { LevelMode } from '../telemetry/levelAggregator';
import {
  BLOCKER_FLASH_MS,
  FEEDBACK_CLEANUP_MARGIN_MS,
} from './feedbackCurves';

export const LOSE_PANEL_DELAY_MS = BLOCKER_FLASH_MS + FEEDBACK_CLEANUP_MARGIN_MS;
export const WON_PANEL_DELAY_MS = 450; // OWNER-PICKED STARTING VALUE

/**
 * W2-06 (META_POST_CLEAR_TIMELINE): the empty board is held for this long after the final exit's last pixel is gone,
 * whatever that exit did. OFF, the flat WON_PANEL_DELAY_MS left 130..270 ms (the board-edge exits) or ~265..362 ms
 * (POLISH-T10's screen-edge exits, computed from exitOnScreenMs' 88..185 ms band) of empty board, depending on how far the last arrow travelled on screen.
 * Owner set B, 2026-10-06 (docs/owner-rulings-2026-10-06.md Q3): 250 ms, then the W5-17 outline for CLEAR_REVEAL_MS.
 * Since the owner's follow-up ruling the same day, the hold before a DRAWN outline is CLEAR_REVEAL_HOLD_MS (150 ms);
 * this 250 ms stays for W2-06 alone and for any clear without an outline (emptyBoardHoldMs).
 */
export const EMPTY_BOARD_HOLD_MS = 250; // OWNER-PICKED 2026-10-06 (set B)
/**
 * W5-17 follow-up (owner ruling 2026-10-06, "yes do both"): the empty-board pause before the outline when one is
 * drawn, so the panel lands about 0.8 s after the last tap on the default board-edge exit (244 + 150 + 400 = 794 ms).
 */
export const CLEAR_REVEAL_HOLD_MS = 150; // OWNER-PICKED 2026-10-06 (follow-up to set B)
/**
 * W5-17 (ART_CLEAR_REVEAL_ENABLED): the slot the cleared board's outline takes between the hold and the panel, owner
 * set B (150 ms fade-in, then held). Only spent when an outline is actually drawn: see clearRevealSlotMs.
 */
export const CLEAR_REVEAL_MS = 400; // OWNER-PICKED 2026-10-06 (set B)

/**
 * W5-17: the reveal slot for one clear: CLEAR_REVEAL_MS when the outline is drawn, else 0, so the panel never waits
 * for an outline nobody sees (flag OFF; reduced motion, where nothing is mounted; a tutorial board's empty mask).
 */
export function clearRevealSlotMs({ enabled, reducedMotion, mask }: {
  enabled: boolean;
  reducedMotion: boolean;
  mask: readonly (readonly boolean[])[];
}): number {
  return enabled && !reducedMotion && mask.some((row) => row.some(Boolean)) ? CLEAR_REVEAL_MS : 0;
}

/** The empty-board hold for one clear: CLEAR_REVEAL_HOLD_MS before a drawn outline (revealMs > 0), else W2-06's
 * EMPTY_BOARD_HOLD_MS. */
export function emptyBoardHoldMs(revealMs: number): number {
  return revealMs > 0 ? CLEAR_REVEAL_HOLD_MS : EMPTY_BOARD_HOLD_MS;
}

/** W5-17: when the outline starts, from the clearing tap: the exit's visible time (non-finite or negative = 0) + the
 * reveal's hold. GameScreen's panel lands CLEAR_REVEAL_MS after it (wonPanelDelayMs with emptyBoardHoldMs). */
export function clearRevealStartMs(exitVisibleMs: number): number {
  return (Number.isFinite(exitVisibleMs) ? Math.max(0, exitVisibleMs) : 0) + CLEAR_REVEAL_HOLD_MS;
}

/**
 * W2-06: the won panel's delay after the clearing tap = the final exit's visible time (when its last pixel is gone,
 * exitToScreenEdge.ts `visibleMs`) + the empty-board hold + the reveal slot. A non-finite or negative exit time
 * counts as 0.
 */
export function wonPanelDelayMs(exitVisibleMs: number, holdMs: number, revealMs: number): number {
  const exit = Number.isFinite(exitVisibleMs) ? Math.max(0, exitVisibleMs) : 0;
  return exit + holdMs + revealMs;
}

export type GamePhase = 'playing' | 'won' | 'lost';
export type TerminalPhase = Exclude<GamePhase, 'playing'>;

export interface LevelSession {
  /**
   * Campaign: the level index. Tutorial: the campaign level it returns to.
   * Daily: the day number, which is also the board's telemetry `levelIndex`
   * (ruling F09). Daily code paths never read it as a campaign index.
   */
  index: number;
  revision: number;
  level: GeneratedLevel;
  /** 'campaign' | 'tutorial' | 'daily' (ruling F08). */
  mode: LevelMode;
  tutorialId?: TutorialId;
  /** W4-06: the daily board's own day number (fixed at entry); null otherwise. */
  day: number | null;
  /**
   * W3-06: the generator version this session's board was actually dealt
   * with (the exact value passed to `LevelGenerator.generate`, not one
   * recomputed later from state that may have moved on). Tutorial and daily
   * boards are unversioned and always 1. `board_mount`'s `gen=` field.
   */
  genVersion: GenVersion;
}

/**
 * W3-05/W3-06: the generator version that deals campaign level `index` in
 * this app.
 * - EXPO_PUBLIC_DEV_GEN_VERSION (W3-06), if set, wins outright: it forces the
 *   version for every index, for a playtest build that needs a specific
 *   version regardless of PERF_MODE or the stamped switch level.
 * - Otherwise PERF_MODE: EXPO_PUBLIC_PERF_GEN_VERSION (2 selects v2, else 1).
 *   A PERF build never hydrates a save, so it has no switch level.
 * - Otherwise: core `resolveGenVersion(index, SaveSystem.genSwitchLevel)`,
 *   which is 1 while GEN_V2_ENABLED is false.
 * The collection fold resolves versions in core without the PERF/DEV branches
 * (ruling F11). A PERF (benchmarkMode) run records no collection bits, but a
 * DEV_LEVEL or DEV_GEN_VERSION run does: GameScreen gates the clear's writes
 * on benchmarkMode only. A DEV_LEVEL clear stores currentLevel = that index +
 * 1, so the next menu fold marks every level below it as played, and with
 * DEV_GEN_VERSION=2 the board dealt is v2 while the fold records the shape
 * the install's own version resolves to (v1 while GEN_V2_ENABLED is false).
 * Dev builds only: never run one over a save you care about, and no release
 * profile may set these variables.
 */
export function levelGenVersion(index: number): GenVersion {
  if (DEV_GEN_VERSION !== null) return DEV_GEN_VERSION;
  if (PERF_MODE) return PERF_GEN_VERSION;
  return resolveGenVersion(index, SaveSystem.genSwitchLevel);
}

/**
 * W3-15: one line per campaign deal in a PERF build, read from logcat by
 * scripts/perf/android/benchmark.mjs (parseGenerationLines). The timed span is
 * the `LevelGenerator.generate` call alone.
 */
function logPerfGeneration(index: number, version: GenVersion, level: GeneratedLevel, elapsedMs: number): void {
  console.log(
    `[gen] index=${index} version=${version} arrows=${level.arrowCount} ` +
    `rows=${level.board.rows} cols=${level.board.cols} ms=${elapsedMs.toFixed(3)}`,
  );
}

/**
 * Generate the level before publishing the next session to React. Keeping the
 * generator outside a state-updater callback prevents React from replaying an
 * expensive generation when it verifies updater purity in development.
 * `version` is required (W3-05) so no campaign caller silently gets v1:
 * GameScreen passes `levelGenVersion(index)`.
 *
 * V2-WIRE (closes V2-FINISH Concern 3): a v2 deal always carries this
 * install's stamped switch level, whatever selected version 2 — the resolver
 * (GEN_V2_ENABLED), the W3-06 dev jump (EXPO_PUBLIC_DEV_GEN_VERSION=2), or a
 * PERF build. `SaveSystem.genSwitchLevel` is null when unstamped (a PERF
 * build never hydrates a save, so it is always null there); `V2Knobs`
 * documents null/unset as "a fresh install's curve", so an unstamped install
 * deals exactly the board it dealt before this wiring. v1 is frozen and
 * refuses knobs (`LevelGenerator.generate` throws on a v1 call carrying
 * `curve`/`clearableBias`), so a v1 session passes nothing.
 */
export function createLevelSession(index: number, revision: number, version: GenVersion): LevelSession {
  // W3-15: PERF builds time the deal on device (Hermes). PERF_MODE is false in every
  // player build (EXPO_PUBLIC_PERF_LEVEL unset), so neither the clock reads nor the log run there.
  const generationStart = PERF_MODE ? performance.now() : 0;
  const level = generateCampaignLevel(index, version);
  if (PERF_MODE) logPerfGeneration(index, version, level, performance.now() - generationStart);
  return {
    index,
    revision,
    level,
    mode: 'campaign',
    day: null,
    genVersion: version,
  };
}

/**
 * The campaign board `createLevelSession` deals for (index, version): the one generate call, shared with
 * the menu's W3-20 tier (src/ui/tierLabel.ts) so the menu can never describe a different board than Play
 * deals. A v2 deal carries this install's stamped switch level (V2-WIRE); v1 passes no knobs.
 */
export function generateCampaignLevel(index: number, version: GenVersion): GeneratedLevel {
  return version === 2
    ? LevelGenerator.generate(index, version, { switchLevel: SaveSystem.genSwitchLevel })
    : LevelGenerator.generate(index, version);
}

/** Build an authored tutorial board without advancing or generating campaign progress. */
export function createTutorialSession(id: TutorialId, revision: number): LevelSession {
  return {
    index: SaveSystem.currentLevel,
    revision,
    level: buildTutorialLevel(id),
    mode: 'tutorial',
    tutorialId: id,
    day: null,
    // Authored, not generated: there is no v2 tutorial content (non-goal).
    genVersion: 1,
  };
}

/**
 * W4-06: the shared board for `day` (SaveSystem.today()'s unit). Pure: the
 * first load and every Retry of the same day build the identical board, and
 * nothing here reads or writes campaign progress.
 */
export function createDailySession(day: number, revision: number): LevelSession {
  return {
    index: day,
    revision,
    level: generateDaily(day),
    mode: 'daily',
    day,
    // generateDaily is unversioned (always the v1-equivalent buildFromShape path).
    genVersion: 1,
  };
}

/**
 * Owns the immediate terminal lock and its delayed phase update. The lock is
 * synchronous, so a second board callback in the same React frame is ignored.
 */
export class TerminalTransitionGuard {
  private pending = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private token = 0;

  get isPending(): boolean {
    return this.pending;
  }

  begin(
    nextPhase: TerminalPhase,
    delayMs: number,
    commit: (phase: TerminalPhase) => void,
  ): boolean {
    if (this.pending) return false;

    this.cancelTimer();
    this.pending = true;
    const token = this.token;
    this.timer = setTimeout(() => {
      if (this.token !== token) return;
      this.timer = null;
      commit(nextPhase);
    }, delayMs);
    return true;
  }

  /** Cancel any delayed phase update and unlock the next level/session. */
  reset(): void {
    this.cancelTimer();
    this.pending = false;
  }

  /** Cancel on unmount without publishing any more React state. */
  dispose(): void {
    this.cancelTimer();
  }

  private cancelTimer(): void {
    this.token += 1;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
