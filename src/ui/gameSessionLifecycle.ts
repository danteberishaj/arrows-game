import {
  buildTutorialLevel,
  LevelGenerator,
  SaveSystem,
  type GeneratedLevel,
  type TutorialId,
} from '../core';
import type { LevelMode } from '../telemetry/levelAggregator';

export type GamePhase = 'playing' | 'won' | 'lost';
export type TerminalPhase = Exclude<GamePhase, 'playing'>;

export interface LevelSession {
  index: number;
  revision: number;
  level: GeneratedLevel;
  mode: LevelMode;
  tutorialId?: TutorialId;
}

/**
 * Generate the level before publishing the next session to React. Keeping the
 * generator outside a state-updater callback prevents React from replaying an
 * expensive generation when it verifies updater purity in development.
 */
export function createLevelSession(index: number, revision: number): LevelSession {
  return {
    index,
    revision,
    level: LevelGenerator.generate(index),
    mode: 'campaign',
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
