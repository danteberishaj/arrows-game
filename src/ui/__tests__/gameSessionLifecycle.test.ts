import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildTutorialLevel,
  generateDaily,
  LevelGenerator,
  resolveGenVersion,
  SaveSystem,
  type GeneratedLevel,
  type IntStore,
} from '../../core';
import {
  BLOCKER_FLASH_MS,
  FEEDBACK_CLEANUP_MARGIN_MS,
} from '../feedbackCurves';
import {
  createDailySession,
  createLevelSession,
  createTutorialSession,
  levelGenVersion,
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

    const initial = createLevelSession(18, 0, 1);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenLastCalledWith(18, 1);

    const retry = createLevelSession(initial.index, initial.revision + 1, 1);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate).toHaveBeenLastCalledWith(18, 1);
    expect(retry.level.board).not.toBe(initial.level.board);

    const next = createLevelSession(retry.index + 1, retry.revision + 1, 1);
    expect(generate).toHaveBeenCalledTimes(3);
    expect(generate).toHaveBeenLastCalledWith(19, 1);
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
    // W3-06: tutorial boards are authored, not generated; board_mount tags them gen 1.
    expect(tutorial.genVersion).toBe(1);
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
    // W3-06: generateDaily is unversioned; board_mount tags daily boards gen 1.
    expect(first.genVersion).toBe(1);
    expect(retry.genVersion).toBe(1);
  });

  it('W4-06: campaign and tutorial sessions carry no day', () => {
    expect(createLevelSession(4, 0, 1).day).toBeNull();
    expect(createTutorialSession('T2', 0).day).toBeNull();
  });

  it('W3-05: a campaign session deals the generator version it is given', () => {
    const generate = jest.spyOn(LevelGenerator, 'generate');

    const v1 = createLevelSession(18, 0, 1);
    const v2 = createLevelSession(7, 0, 2);

    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate).toHaveBeenLastCalledWith(7, 2);
    // v2 delegates to v1 until W3-10: the same board either way.
    expect(serializeBoard(v2.level)).toEqual(serializeBoard(LevelGenerator.generate(7, 1)));
    // W3-06: board_mount tags each session with the version it was actually
    // dealt with, not a value recomputed later (avoids drift once W3-10 lands).
    expect(v1.genVersion).toBe(1);
    expect(v2.genVersion).toBe(2);
  });

  it('W3-05: outside PERF_MODE, levelGenVersion is the core resolver over the stamped switch level (flag OFF => 1)', () => {
    const previous = SaveSystem.useStore(mapStore([['arrows_gen_switch_level', 0]]));
    try {
      expect(SaveSystem.genSwitchLevel).toBe(0);
      for (const index of [0, 40, 41, 3827]) {
        expect(levelGenVersion(index)).toBe(resolveGenVersion(index, SaveSystem.genSwitchLevel));
        expect(levelGenVersion(index)).toBe(1);
      }
    } finally {
      SaveSystem.useStore(previous);
    }
  });

  it('W3-05: with the flag ON (forced), levelGenVersion switches at the stamped level', () => {
    try {
      jest.isolateModules(() => {
        jest.doMock('../../core/generatorVersion', () => {
          const actual = jest.requireActual('../../core/generatorVersion');
          return {
            ...actual,
            GEN_V2_ENABLED: true,
            resolveGenVersion: (index: number, switchLevel: number | null, enabled = true) =>
              actual.resolveGenVersion(index, switchLevel, enabled),
          };
        });
        const lifecycle = require('../gameSessionLifecycle') as typeof import('../gameSessionLifecycle');
        const core = require('../../core') as typeof import('../../core');
        core.SaveSystem.useStore(mapStore([['arrows_gen_switch_level', 41]]));
        expect([0, 40, 41, 42, 3827].map((index) => lifecycle.levelGenVersion(index))).toEqual([1, 1, 2, 2, 2]);

        core.SaveSystem.useStore(mapStore([]));
        expect(lifecycle.levelGenVersion(3827)).toBe(1); // never stamped
      });
    } finally {
      jest.dontMock('../../core/generatorVersion');
    }
  });

  describe('W3-05 PERF_MODE', () => {
    const saved = { ...process.env };

    afterEach(() => {
      process.env = { ...saved };
    });

    function perfLifecycle(env: Record<string, string | undefined>) {
      process.env = { ...saved, ...env };
      let result!: {
        perf: typeof import('../../perfMode');
        lifecycle: typeof import('../gameSessionLifecycle');
      };
      jest.isolateModules(() => {
        result = {
          perf: require('../../perfMode') as typeof import('../../perfMode'),
          lifecycle: require('../gameSessionLifecycle') as typeof import('../gameSessionLifecycle'),
        };
      });
      return result;
    }

    it('levelGenVersion(3827) returns 1 with no EXPO_PUBLIC_PERF_GEN_VERSION set', () => {
      const { perf, lifecycle } = perfLifecycle({
        EXPO_PUBLIC_PERF_LEVEL: '3827',
        EXPO_PUBLIC_PERF_GEN_VERSION: undefined,
      });
      expect(perf.PERF_MODE).toBe(true); // positive control: this really is a PERF build
      expect(lifecycle.levelGenVersion(3827)).toBe(1);
    });

    it('EXPO_PUBLIC_PERF_GEN_VERSION=2 selects v2 without the resolver (flag OFF, nothing stamped)', () => {
      const { perf, lifecycle } = perfLifecycle({
        EXPO_PUBLIC_PERF_LEVEL: '3827',
        EXPO_PUBLIC_PERF_GEN_VERSION: '2',
      });
      expect(perf.PERF_MODE).toBe(true);
      expect(lifecycle.levelGenVersion(3827)).toBe(2);
    });

    it.each(['1', '3', 'two', ''])('EXPO_PUBLIC_PERF_GEN_VERSION=%p reads as 1', (raw) => {
      const { lifecycle } = perfLifecycle({ EXPO_PUBLIC_PERF_LEVEL: '3827', EXPO_PUBLIC_PERF_GEN_VERSION: raw });
      expect(lifecycle.levelGenVersion(3827)).toBe(1);
    });
  });

  describe('W3-06 EXPO_PUBLIC_DEV_GEN_VERSION', () => {
    const saved = { ...process.env };

    afterEach(() => {
      process.env = { ...saved };
    });

    function devLifecycle(env: Record<string, string | undefined>) {
      process.env = { ...saved, ...env };
      let result!: {
        perf: typeof import('../../perfMode');
        lifecycle: typeof import('../gameSessionLifecycle');
      };
      jest.isolateModules(() => {
        result = {
          perf: require('../../perfMode') as typeof import('../../perfMode'),
          lifecycle: require('../gameSessionLifecycle') as typeof import('../gameSessionLifecycle'),
        };
      });
      return result;
    }

    it('forces the version for every index, independent of the stamped switch level', () => {
      const { lifecycle } = devLifecycle({ EXPO_PUBLIC_DEV_GEN_VERSION: '2' });
      expect([0, 40, 3827].map((index) => lifecycle.levelGenVersion(index))).toEqual([2, 2, 2]);
    });

    it('overrides EXPO_PUBLIC_PERF_GEN_VERSION under PERF_MODE too', () => {
      const { perf, lifecycle } = devLifecycle({
        EXPO_PUBLIC_PERF_LEVEL: '3827',
        EXPO_PUBLIC_PERF_GEN_VERSION: '2',
        EXPO_PUBLIC_DEV_GEN_VERSION: '1',
      });
      expect(perf.PERF_MODE).toBe(true);
      expect(lifecycle.levelGenVersion(3827)).toBe(1);
    });
  });

  it('W3-05: App stamps the switch level after hydration and before the first screen (source order)', () => {
    // App.tsx cannot run under node jest; the stamp itself is tested over the
    // real initSaveSystem in storage.test.ts. This guards only its placement.
    const source = readFileSync(join(__dirname, '..', '..', '..', 'App.tsx'), 'utf8');
    const init = source.indexOf('initSaveSystem()');
    const then = source.indexOf('.then(', init);
    const stamp = source.indexOf('stampGenSwitchLevel(SaveSystem)', then);
    const ready = source.indexOf('setReady(true)', then);
    const failed = source.indexOf('.catch(', then);
    expect(init).toBeGreaterThan(0);
    expect(then).toBeGreaterThan(init);
    expect(stamp).toBeGreaterThan(then);
    expect(stamp).toBeLessThan(ready);
    expect(ready).toBeLessThan(failed);
    // Called exactly once: never from the failed-hydrate branch.
    expect(source.split('stampGenSwitchLevel(').length - 1).toBe(1);
  });

  it('W3-06: EXPO_PUBLIC_DEV_LEVEL bypasses ftueRoute in onPlay instead of routing into a tutorial (ruling F28, source order)', () => {
    // App.tsx cannot run under node jest (see the stamp guard above); this
    // checks only that the bypass sits before the ftueRoute call it must skip.
    const source = readFileSync(join(__dirname, '..', '..', '..', 'App.tsx'), 'utf8');
    const onPlay = source.indexOf('const onPlay = useCallback(');
    const devCheck = source.indexOf('DEV_LEVEL_INDEX !== null', onPlay);
    const routeCall = source.indexOf('ftueRoute({', onPlay);
    expect(onPlay).toBeGreaterThan(0);
    expect(devCheck).toBeGreaterThan(onPlay);
    expect(devCheck).toBeLessThan(routeCall);
  });

  it('W3-06: the game screen opens EXPO_PUBLIC_DEV_LEVEL (falling back to PERF_LEVEL_INDEX) as its initial index', () => {
    const source = readFileSync(join(__dirname, '..', '..', '..', 'App.tsx'), 'utf8');
    expect(source).toContain('initialLevelIndex={DEV_LEVEL_INDEX ?? PERF_LEVEL_INDEX ?? undefined}');
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

/** Map-backed IntStore seeded with raw key/value pairs. */
function mapStore(seed: ReadonlyArray<[string, number]>): IntStore {
  const map = new Map<string, number>(seed);
  return {
    getInt: (key, defaultValue) => map.get(key) ?? defaultValue,
    setInt: (key, value) => {
      map.set(key, value);
    },
    deleteKey: (key) => {
      map.delete(key);
    },
  };
}
