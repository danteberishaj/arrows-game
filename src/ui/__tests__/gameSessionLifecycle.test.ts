import { LevelGenerator } from '../../core';
import {
  createLevelSession,
  TerminalTransitionGuard,
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
