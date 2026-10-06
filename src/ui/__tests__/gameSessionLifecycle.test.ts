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
  CLEAR_REVEAL_HOLD_MS,
  CLEAR_REVEAL_MS,
  createDailySession,
  createLevelSession,
  createTutorialSession,
  EMPTY_BOARD_HOLD_MS,
  emptyBoardHoldMs,
  levelGenVersion,
  LOSE_PANEL_DELAY_MS,
  TerminalTransitionGuard,
  WON_PANEL_DELAY_MS,
  wonPanelDelayMs,
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
    // V2-WIRE: pin the ambient switch level so this test does not depend on
    // execution order against the store-mutating tests below.
    const previous = SaveSystem.useStore(mapStore([]));
    try {
      const generate = jest.spyOn(LevelGenerator, 'generate');

      const v1 = createLevelSession(18, 0, 1);
      const v2 = createLevelSession(7, 0, 2);

      expect(generate).toHaveBeenCalledTimes(2);
      // v1 refuses knobs: no third argument at all.
      expect(generate).toHaveBeenNthCalledWith(1, 18, 1);
      // V2-WIRE: v2 always carries the install's switch level (unstamped => null).
      expect(SaveSystem.genSwitchLevel).toBeNull();
      expect(generate).toHaveBeenNthCalledWith(2, 7, 2, { switchLevel: null });
      // W3-10 retired "v2 delegates to v1": the session holds v2's own board,
      // which is not the v1 board of the same index.
      expect(serializeBoard(v2.level)).toEqual(serializeBoard(LevelGenerator.generate(7, 2, { switchLevel: null })));
      expect(serializeBoard(v2.level)).not.toEqual(serializeBoard(LevelGenerator.generate(7, 1)));
      // W3-06: board_mount tags each session with the version it was actually
      // dealt with, not a value recomputed later (avoids drift once W3-10 lands).
      expect(v1.genVersion).toBe(1);
      expect(v2.genVersion).toBe(2);
    } finally {
      SaveSystem.useStore(previous);
    }
  });

  describe('V2-WIRE: createLevelSession forwards the install\'s stamped switch level to v2 (closes V2-FINISH Concern 3)', () => {
    it('a fresh install (switch 0) and an existing install (switch 41) at the same level get different boards, each equal to generate(i, 2, { switchLevel })', () => {
      const generate = jest.spyOn(LevelGenerator, 'generate');
      const previous = SaveSystem.useStore(mapStore([['arrows_gen_switch_level', 0]]));
      let fresh: ReturnType<typeof createLevelSession>;
      try {
        expect(SaveSystem.genSwitchLevel).toBe(0);
        fresh = createLevelSession(50, 0, 2);
        expect(generate).toHaveBeenLastCalledWith(50, 2, { switchLevel: 0 });
      } finally {
        SaveSystem.useStore(previous);
      }

      const previous2 = SaveSystem.useStore(mapStore([['arrows_gen_switch_level', 41]]));
      let existing: ReturnType<typeof createLevelSession>;
      try {
        expect(SaveSystem.genSwitchLevel).toBe(41);
        existing = createLevelSession(50, 0, 2);
        expect(generate).toHaveBeenLastCalledWith(50, 2, { switchLevel: 41 });
      } finally {
        SaveSystem.useStore(previous2);
      }

      expect(serializeBoard(fresh.level)).toEqual(
        serializeBoard(LevelGenerator.generate(50, 2, { switchLevel: 0 })),
      );
      expect(serializeBoard(existing.level)).toEqual(
        serializeBoard(LevelGenerator.generate(50, 2, { switchLevel: 41 })),
      );
      // V2-FINISH's floor makes these genuinely different boards, not the
      // same board relabelled.
      expect(serializeBoard(fresh.level)).not.toEqual(serializeBoard(existing.level));
    });

    it('an unstamped install (null) deals the same board as an explicit switch 0 (both "a fresh install\'s curve", V2Knobs\' documented default)', () => {
      const previous = SaveSystem.useStore(mapStore([]));
      try {
        expect(SaveSystem.genSwitchLevel).toBeNull();
        const unstamped = createLevelSession(50, 0, 2);
        const freshZero = LevelGenerator.generate(50, 2, { switchLevel: 0 });
        expect(serializeBoard(unstamped.level)).toEqual(serializeBoard(freshZero));
        // Also equal to the no-knobs call: null and 0 both mean "no v1 floor".
        expect(serializeBoard(unstamped.level)).toEqual(serializeBoard(LevelGenerator.generate(50, 2)));
      } finally {
        SaveSystem.useStore(previous);
      }
    });

    it('a corrupt stored value (-5) reads as null and deals the fresh curve, never a thrown switchLevel', () => {
      const previous = SaveSystem.useStore(mapStore([['arrows_gen_switch_level', -5]]));
      try {
        expect(SaveSystem.genSwitchLevel).toBeNull(); // SaveSystem itself sanitizes -5 to null
        const session = createLevelSession(50, 0, 2);
        expect(serializeBoard(session.level)).toEqual(serializeBoard(LevelGenerator.generate(50, 2, { switchLevel: null })));
      } finally {
        SaveSystem.useStore(previous);
      }
    });

    it('v1 sessions pass nothing regardless of the stamped switch level (v1 is frozen and refuses knobs)', () => {
      const generate = jest.spyOn(LevelGenerator, 'generate');
      const previous = SaveSystem.useStore(mapStore([['arrows_gen_switch_level', 41]]));
      try {
        const session = createLevelSession(18, 0, 1);
        expect(generate).toHaveBeenLastCalledWith(18, 1);
        expect(serializeBoard(session.level)).toEqual(serializeBoard(LevelGenerator.generate(18, 1)));
      } finally {
        SaveSystem.useStore(previous);
      }
    });
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

    // W3-15: a PERF build logs one generation-time line per campaign deal, read by benchmark.mjs.
    it('W3-15: a PERF build logs the deal of its level with its version, size and generation time', () => {
      const { lifecycle } = perfLifecycle({ EXPO_PUBLIC_PERF_LEVEL: '5363', EXPO_PUBLIC_PERF_GEN_VERSION: undefined });
      const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      try {
        const session = lifecycle.createLevelSession(5363, 0, lifecycle.levelGenVersion(5363));
        const lines = log.mock.calls.map((call) => String(call[0])).filter((line) => line.startsWith('[gen]'));
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatch(/^\[gen\] index=5363 version=1 arrows=\d+ rows=34 cols=37 ms=\d+\.\d{3}$/);
        expect(lines[0]).toContain(`arrows=${session.level.arrowCount} `);
      } finally {
        log.mockRestore();
      }
    });

    it('W3-15: the v2 PERF deal logs version 2', () => {
      const { lifecycle } = perfLifecycle({ EXPO_PUBLIC_PERF_LEVEL: '2705', EXPO_PUBLIC_PERF_GEN_VERSION: '2' });
      const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      try {
        lifecycle.createLevelSession(2705, 0, lifecycle.levelGenVersion(2705));
        const lines = log.mock.calls.map((call) => String(call[0])).filter((line) => line.startsWith('[gen]'));
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatch(/^\[gen\] index=2705 version=2 /);
      } finally {
        log.mockRestore();
      }
    });

    it('W3-15: a non-PERF build logs no generation line', () => {
      const { perf, lifecycle } = perfLifecycle({ EXPO_PUBLIC_PERF_LEVEL: undefined });
      expect(perf.PERF_MODE).toBe(false);
      const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      try {
        lifecycle.createLevelSession(5363, 0, 1);
        expect(log.mock.calls.filter((call) => String(call[0]).startsWith('[gen]'))).toHaveLength(0);
      } finally {
        log.mockRestore();
      }
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
        // V2-WIRE: the isolated registry's own '../../core', so a test can spy
        // on ITS LevelGenerator/SaveSystem (the outer, top-of-file imports are
        // different module instances under jest.isolateModules).
        core: typeof import('../../core');
      };
      jest.isolateModules(() => {
        result = {
          perf: require('../../perfMode') as typeof import('../../perfMode'),
          lifecycle: require('../gameSessionLifecycle') as typeof import('../gameSessionLifecycle'),
          core: require('../../core') as typeof import('../../core'),
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

    it('V2-WIRE: forcing v2 via EXPO_PUBLIC_DEV_GEN_VERSION still routes the install\'s stamped switch level into createLevelSession, consistently with the resolver path', () => {
      const { lifecycle, core } = devLifecycle({ EXPO_PUBLIC_DEV_GEN_VERSION: '2' });
      // DEV_LEVEL (unlike PERF_MODE) leaves persistence running normally
      // (perfMode.ts), so this install can carry a real stamped switch level.
      const previousStore = core.SaveSystem.useStore(mapStore([['arrows_gen_switch_level', 41]]));
      try {
        const generate = jest.spyOn(core.LevelGenerator, 'generate');
        const version = lifecycle.levelGenVersion(3827);
        expect(version).toBe(2); // forced, independent of the switch level
        const session = lifecycle.createLevelSession(3827, 0, version);
        expect(generate).toHaveBeenLastCalledWith(3827, 2, { switchLevel: 41 });
        expect(serializeBoard(session.level)).toEqual(
          serializeBoard(core.LevelGenerator.generate(3827, 2, { switchLevel: 41 })),
        );
      } finally {
        core.SaveSystem.useStore(previousStore);
      }
    });

    it('V2-WIRE: an unstamped install under the dev jump deals the fresh curve (null switch level), not a thrown/omitted knob', () => {
      const { lifecycle, core } = devLifecycle({ EXPO_PUBLIC_DEV_GEN_VERSION: '2' });
      const previousStore = core.SaveSystem.useStore(mapStore([]));
      try {
        const generate = jest.spyOn(core.LevelGenerator, 'generate');
        const version = lifecycle.levelGenVersion(3827);
        const session = lifecycle.createLevelSession(3827, 0, version);
        expect(generate).toHaveBeenLastCalledWith(3827, 2, { switchLevel: null });
        expect(serializeBoard(session.level)).toEqual(
          serializeBoard(core.LevelGenerator.generate(3827, 2)),
        );
      } finally {
        core.SaveSystem.useStore(previousStore);
      }
    });
  });

  it('W3-05: App stamps the switch level after hydration and before the first screen (source order)', () => {
    // App.tsx cannot run under node jest; the stamp itself is tested over the
    // real initSaveSystem in storage.test.ts. This guards only its placement.
    const source = readFileSync(join(__dirname, '..', '..', '..', 'App.tsx'), 'utf8');
    const init = source.indexOf('initSaveSystem(skinPickerEnabled(), rewardPathEnabled(), rewardBookEnabled(), seasonsEnabled(), petalAdsEnabled())'); // PETAL-ADS-01 added the last argument
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

describe('W2-06 post-clear timeline (META_POST_CLEAR_TIMELINE)', () => {
  it('flag OFF keeps the flat won delay of W2-03: 450 ms after the last tap', () => {
    expect(WON_PANEL_DELAY_MS).toBe(450);
  });

  it('flag ON: won delay = the final exit\'s visible time + the empty-board hold + the reveal slot', () => {
    expect(wonPanelDelayMs(120, 350, 0)).toBe(470);
    expect(wonPanelDelayMs(185, 250, 40)).toBe(475);
    for (const exit of [0, 88, 132, 185, 278, 1000]) {
      for (const hold of [250, 350, 500]) {
        expect(wonPanelDelayMs(exit, hold, CLEAR_REVEAL_MS)).toBe(exit + hold + CLEAR_REVEAL_MS);
      }
    }
  });

  it('so the empty-board hold no longer depends on how far the last arrow travelled', () => {
    for (const exit of [88, 185, 320]) {
      expect(wonPanelDelayMs(exit, EMPTY_BOARD_HOLD_MS, CLEAR_REVEAL_MS) - exit).toBe(EMPTY_BOARD_HOLD_MS + CLEAR_REVEAL_MS);
    }
  });

  it('a non-finite or negative exit time counts as 0 (the panel can never be scheduled at NaN)', () => {
    expect(wonPanelDelayMs(Number.NaN, 350, 0)).toBe(350);
    expect(wonPanelDelayMs(-5, 350, 0)).toBe(350);
  });

  it('owner set B (2026-10-06): the hold is the 250 ms candidate and W5-17 takes a 400 ms reveal slot', () => {
    expect([250, 350, 500]).toContain(EMPTY_BOARD_HOLD_MS);
    expect(EMPTY_BOARD_HOLD_MS).toBe(250);
    expect(CLEAR_REVEAL_MS).toBe(400);
  });

  it('owner ruling 2026-10-06 (a): the pause before a drawn outline is 150 ms; with no outline the 250 ms hold stays', () => {
    expect(CLEAR_REVEAL_HOLD_MS).toBe(150);
    expect(emptyBoardHoldMs(CLEAR_REVEAL_MS)).toBe(CLEAR_REVEAL_HOLD_MS);
    expect(emptyBoardHoldMs(0)).toBe(EMPTY_BOARD_HOLD_MS);
    expect(wonPanelDelayMs(244, emptyBoardHoldMs(CLEAR_REVEAL_MS), CLEAR_REVEAL_MS)).toBe(794);
    expect(wonPanelDelayMs(244, emptyBoardHoldMs(0), 0)).toBe(494);
  });
});
