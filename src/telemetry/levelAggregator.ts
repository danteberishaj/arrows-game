import type { EventProps } from './events';
import { Telemetry } from './telemetry';

export type TapOutcome = 'exit' | 'blocked' | 'ghost' | 'miss';
export type LevelOutcome = EventProps<'level_end'>['outcome'];
export type LevelMode = EventProps<'level_start'>['mode'];

/**
 * Aggregates the hot tap path into plain counters. A tap only increments one
 * number; event construction happens only at terminal boundaries. An earned
 * continue can resume an out-of-hearts level without resetting its counters.
 */
export class LevelAggregator {
  private state: 'idle' | 'active' | 'resumable' = 'idle';
  private levelIndex = 0;
  private heartsMax = 0;
  private levelStartedAt = 0;
  private mode: LevelMode = 'campaign';

  private tapsExit = 0;
  private tapsBlocked = 0;
  private tapsGhost = 0;
  private tapsMiss = 0;
  private heartsLost = 0;
  private hintsUsed = 0;
  private continuesUsed = 0;

  private readonly sessionStartedAt: number;
  private levelsStarted = 0;
  private levelsCleared = 0;
  // A session that never opens a level reports the campaign's first index.
  private lastLevelIndex = 0; // OWNER-PICKED STARTING VALUE

  constructor(sessionStartedAt: number = Date.now()) {
    this.sessionStartedAt = sessionStartedAt;
  }

  start(
    levelIndex: number,
    arrowCount: number,
    shapeName: string,
    heartsMax: number,
    mode: LevelMode,
    now: number,
  ): void {
    this.state = 'active';
    this.levelIndex = levelIndex;
    this.heartsMax = heartsMax;
    this.levelStartedAt = now;
    this.mode = mode;
    this.tapsExit = 0;
    this.tapsBlocked = 0;
    this.tapsGhost = 0;
    this.tapsMiss = 0;
    this.heartsLost = 0;
    this.hintsUsed = 0;
    this.continuesUsed = 0;

    this.levelsStarted += 1;
    this.lastLevelIndex = levelIndex;
    Telemetry.emit('level_start', {
      levelIndex,
      arrowCount,
      shapeName,
      heartsMax,
      mode,
    });
  }

  tap(outcome: TapOutcome): void {
    if (this.state !== 'active') return;
    switch (outcome) {
      case 'exit':
        this.tapsExit += 1;
        break;
      case 'blocked':
        this.tapsBlocked += 1;
        break;
      case 'ghost':
        this.tapsGhost += 1;
        break;
      case 'miss':
        this.tapsMiss += 1;
        break;
    }
  }

  heartLost(): void {
    if (this.state === 'active') this.heartsLost += 1;
  }

  hintUsed(): void {
    if (this.state === 'active') this.hintsUsed += 1;
  }

  /** Reopens the same counters after an earned continue from an out-of-hearts end. */
  resume(): void {
    if (this.state !== 'resumable') return;
    this.state = 'active';
    this.continuesUsed += 1;
  }

  end(outcome: LevelOutcome, heartsLeft: number, now: number): void {
    if (this.state !== 'active') return;
    this.state = outcome === 'out_of_hearts' ? 'resumable' : 'idle';
    if (outcome === 'cleared') this.levelsCleared += 1;

    const taps = this.tapsExit + this.tapsBlocked + this.tapsGhost + this.tapsMiss;
    Telemetry.emit('level_end', {
      levelIndex: this.levelIndex,
      mode: this.mode,
      outcome,
      taps,
      tapsExit: this.tapsExit,
      tapsBlocked: this.tapsBlocked,
      tapsGhost: this.tapsGhost,
      tapsMiss: this.tapsMiss,
      heartsLost: this.heartsLost,
      heartsLeft,
      heartsMax: this.heartsMax,
      durationMs: Math.max(0, now - this.levelStartedAt),
      hintsUsed: this.hintsUsed,
      continuesUsed: this.continuesUsed,
    });
  }

  sessionEnd(now: number): void {
    Telemetry.emit('session_end', {
      durationMs: Math.max(0, now - this.sessionStartedAt),
      levelsStarted: this.levelsStarted,
      levelsCleared: this.levelsCleared,
      lastLevelIndex: this.lastLevelIndex,
    });
  }
}

/** The app-wide instance lets App report the tally owned by GameScreen. */
export const appLevelAggregator = new LevelAggregator();
