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
import { PERF_GEN_VERSION, PERF_MODE } from '../perfMode';
import type { LevelMode } from '../telemetry/levelAggregator';
import {
  BLOCKER_FLASH_MS,
  FEEDBACK_CLEANUP_MARGIN_MS,
} from './feedbackCurves';

export const LOSE_PANEL_DELAY_MS = BLOCKER_FLASH_MS + FEEDBACK_CLEANUP_MARGIN_MS;
export const WON_PANEL_DELAY_MS = 450; // OWNER-PICKED STARTING VALUE

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
}

/**
 * W3-05: the generator version that deals campaign level `index` in this app.
 * - PERF_MODE: EXPO_PUBLIC_PERF_GEN_VERSION (2 selects v2, else 1). A PERF
 *   build never hydrates a save, so it has no switch level.
 * - Otherwise: core `resolveGenVersion(index, SaveSystem.genSwitchLevel)`,
 *   which is 1 while GEN_V2_ENABLED is false.
 * The collection fold resolves versions in core without the PERF branch
 * (ruling F11); PERF runs record no collection bits.
 */
export function levelGenVersion(index: number): GenVersion {
  if (PERF_MODE) return PERF_GEN_VERSION;
  return resolveGenVersion(index, SaveSystem.genSwitchLevel);
}

/**
 * Generate the level before publishing the next session to React. Keeping the
 * generator outside a state-updater callback prevents React from replaying an
 * expensive generation when it verifies updater purity in development.
 * `version` is required (W3-05) so no campaign caller silently gets v1:
 * GameScreen passes `levelGenVersion(index)`.
 */
export function createLevelSession(index: number, revision: number, version: GenVersion): LevelSession {
  return {
    index,
    revision,
    level: LevelGenerator.generate(index, version),
    mode: 'campaign',
    day: null,
  };
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
