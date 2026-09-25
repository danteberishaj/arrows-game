import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildTutorialLevel, generateDaily, LevelGenerator, SaveSystem, type GeneratedLevel } from '../../core';
import {
  BLOCKER_FLASH_MS,
  FEEDBACK_CLEANUP_MARGIN_MS,
} from '../feedbackCurves';
import {
  createDailySession,
  createLevelSession,
  createTutorialSession,
  LOSE_PANEL_DELAY_MS,
  TerminalTransitionGuard,
  WON_PANEL_DELAY_MS,
} from '../gameSessionLifecycle';

describe('game session lifecycle', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('generates exactly once for initial load, Retry, and Next', () => {
    const generate = jest.spyOn(LevelGenerator, 'generate');

    const initial = createLevelSession(18, 0);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenLastCalledWith(18);

    const retry = createLevelSession(initial.index, initial.revision + 1);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate).toHaveBeenLastCalledWith(18);
    expect(retry.level.board).not.toBe(initial.level.board);

    const next = createLevelSession(retry.index + 1, retry.revision + 1);
    expect(generate).toHaveBeenCalledTimes(3);
    expect(generate).toHaveBeenLastCalledWith(19);
    expect([initial.revision, retry.revision, next.revision]).toEqual([0, 1, 2]);
    expect([initial.mode, retry.mode, next.mode]).toEqual([
      'campaign',
      'campaign',
      'campaign',
    ]);
  });

  it('creates T1 without calling the campaign generator', () => {
    const generate = jest.spyOn(LevelGenerator, 'generate');

    const tutorial = createTutorialSession('T1', 0);

    expect(generate).not.toHaveBeenCalled();
    expect(tutorial.tutorialId).toBe('T1');
    expect(tutorial.mode).toBe('tutorial');
    expect(tutorial.level.arrowCount).toBe(buildTutorialLevel('T1').arrowCount);
  });

  it('W4-06: a daily session is generateDaily(day), and a Retry rebuilds the identical board', () => {
    const generate = jest.spyOn(LevelGenerator, 'generate');
    const setCurrentLevel = jest.spyOn(SaveSystem, 'setCurrentLevel');
    const expected = generateDaily(2450);

    const first = createDailySession(2450, 3);
    const retry = createDailySession(2450, 4);

    for (const session of [first, retry]) {
      expect(session.mode).toBe('daily');
      expect(session.day).toBe(2450);
      // The day is the board's telemetry levelIndex (ruling F09).
      expect(session.index).toBe(2450);
      expect(session.tutorialId).toBeUndefined();
      expect(session.level.shapeName).toBe(expected.shapeName);
      expect(session.level.arrowCount).toBe(expected.arrowCount);
      expect(serializeBoard(session.level)).toEqual(serializeBoard(expected));
    }
    expect([first.revision, retry.revision]).toEqual([3, 4]);
    // A fresh board each time: a Retry must not reuse the emptied one.
    expect(retry.level.board).not.toBe(first.level.board);
    // Never the campaign generator, never the campaign pointer.
    expect(generate).not.toHaveBeenCalled();
    expect(setCurrentLevel).not.toHaveBeenCalled();
  });

  it('W4-06: campaign and tutorial sessions carry no day', () => {
    expect(createLevelSession(4, 0).day).toBeNull();
    expect(createTutorialSession('T2', 0).day).toBeNull();
  });

  it('waits for fatal feedback cleanup before showing the lose panel', () => {
    expect(LOSE_PANEL_DELAY_MS).toBe(BLOCKER_FLASH_MS + FEEDBACK_CLEANUP_MARGIN_MS);
    expect(LOSE_PANEL_DELAY_MS).toBeGreaterThan(WON_PANEL_DELAY_MS);
  });

  it('names every GameScreen terminal-transition delay', () => {
    const source = readFileSync(join(__dirname, '..', 'GameScreen.tsx'), 'utf8');

    expect(source).not.toMatch(
      /beginTerminalTransition\(\s*['"](?:won|lost)['"]\s*,\s*\d/,
    );
  });

  it('accepts only the first terminal event until the session resets', () => {
    jest.useFakeTimers();
    const guard = new TerminalTransitionGuard();
    const commit = jest.fn();

    expect(guard.begin('won', 450, commit)).toBe(true);
    expect(guard.isPending).toBe(true);
    expect(guard.begin('lost', 350, commit)).toBe(false);

    jest.advanceTimersByTime(450);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('won');
    expect(guard.begin('lost', 350, commit)).toBe(false);

    guard.reset();
    expect(guard.isPending).toBe(false);
    expect(guard.begin('lost', 350, commit)).toBe(true);
    jest.advanceTimersByTime(350);
    expect(commit).toHaveBeenLastCalledWith('lost');
    expect(commit).toHaveBeenCalledTimes(2);
  });

  it('cancels the delayed state callback when its owner unmounts', () => {
    jest.useFakeTimers();
    const guard = new TerminalTransitionGuard();
    const commit = jest.fn();

    expect(guard.begin('won', 450, commit)).toBe(true);
    guard.dispose();
    jest.runAllTimers();

    expect(commit).not.toHaveBeenCalled();
  });

  it('cannot publish a stale phase after a level reset', () => {
    jest.useFakeTimers();
    const guard = new TerminalTransitionGuard();
    const commit = jest.fn();

    guard.begin('won', 450, commit);
    guard.reset();
    guard.begin('lost', 350, commit);
    jest.runAllTimers();

    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('lost');
  });
});

/** Everything a player can see about a board, as text (dailyBoard.test.ts's serializer). */
function serializeBoard(level: GeneratedLevel): string[] {
  const lines = [
    level.shapeName,
    String(level.board.rows),
    String(level.board.cols),
    String(level.arrowCount),
    String(level.hearts),
    String(level.difficulty),
  ];
  for (const arrow of level.board.arrows()) lines.push(arrow.toLine());
  return lines;
}
