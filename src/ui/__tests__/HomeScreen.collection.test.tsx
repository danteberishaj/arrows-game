/**
 * W4-07: the menu is where the collection catches up (no board, no gameplay
 * frame budget). The fold must stay off the mount and the menu's opening
 * seconds (COLLECTION_SYNC_START_DELAY_MS), run in bounded chunks after that,
 * stop when the menu unmounts, and do nothing with the kill constant off. Frame times close only on the emulator
 * measurement in artifacts/W4-07/.
 */
import { act, render } from '@testing-library/react-native';
import React from 'react';
import { SaveSystem, type IntStore } from '../../core/saveSystem';
import {
  COLLECTION_SYNC_BUDGET_STEPS,
  COLLECTION_SYNC_CHUNK_STEPS,
  COLLECTION_SYNC_SLICE_MS,
  COLLECTION_SYNC_START_DELAY_MS,
} from '../collectionSync';
import { HomeScreen } from '../HomeScreen';
import { ScreenSlot } from '../screenHandoff';
import { Daylight } from '../theme';

const mockFlags = { COLLECTION_SYNC_ENABLED: true };
jest.mock('../../featureFlags', () =>
  Object.defineProperties(
    { ...jest.requireActual('../../featureFlags') },
    {
      COLLECTION_SYNC_ENABLED: { get: () => mockFlags.COLLECTION_SYNC_ENABLED, enumerable: true },
    },
  ));

class MapStore implements IntStore {
  readonly map = new Map<string, number>();
  getInt(key: string, defaultValue: number): number {
    return this.map.get(key) ?? defaultValue;
  }
  setInt(key: string, value: number): void {
    this.map.set(key, value);
  }
  deleteKey(key: string): void {
    this.map.delete(key);
  }
}

let store: MapStore;
let previousStore: IntStore;
let previousHealthy: boolean;

const renderMenu = () =>
  render(
    <HomeScreen
      palette={Daylight}
      dark={false}
      soundOn
      onPlay={jest.fn()}
      onToggleSound={jest.fn()}
      onToggleTheme={jest.fn()}
    />,
  );

/** The menu's opening seconds: the fold has not started yet. */
function waitForFoldStart() {
  act(() => {
    jest.advanceTimersByTime(COLLECTION_SYNC_START_DELAY_MS);
  });
}

/**
 * One 16 ms frame. The RN jest environment's requestAnimationFrame is a 0 ms
 * timer (not frame-aligned), so it is replaced by a 16 ms one here: each
 * frame() then runs at most one rAF and its follow-up macrotask.
 */
function frame() {
  act(() => {
    jest.advanceTimersByTime(16);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest
    .spyOn(global, 'requestAnimationFrame')
    .mockImplementation((cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16) as unknown as number);
  jest
    .spyOn(global, 'cancelAnimationFrame')
    .mockImplementation((id) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>));
  // A clock that never moves: each slice then ends at the level cap (deterministic).
  jest.spyOn(performance, 'now').mockReturnValue(0);
  mockFlags.COLLECTION_SYNC_ENABLED = true;
  store = new MapStore();
  previousStore = SaveSystem.useStore(store);
  previousHealthy = SaveSystem.persistenceHealthy;
  SaveSystem.setPersistenceHealthy(true);
});

afterEach(() => {
  SaveSystem.useStore(previousStore);
  SaveSystem.setPersistenceHealthy(previousHealthy);
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('the mount and the opening seconds write nothing; then the fold catches up one chunk per frame', () => {
  const behind = COLLECTION_SYNC_CHUNK_STEPS * 2 + 7;
  store.setInt('arrows_current_level', behind);

  const sync = jest.spyOn(SaveSystem, 'syncCollection');
  const menu = renderMenu();
  expect(menu.getByText(`Level ${behind + 1}`)).toBeTruthy();
  expect(sync).not.toHaveBeenCalled();
  act(() => {
    jest.advanceTimersByTime(COLLECTION_SYNC_START_DELAY_MS - 1);
  });
  expect(sync).not.toHaveBeenCalled();
  expect(store.map.has('arrows_shapes_through_level')).toBe(false);
  act(() => {
    jest.advanceTimersByTime(1);
  });

  const seen: number[] = [];
  for (let i = 0; i < 20 && SaveSystem.shapesThroughLevel < behind; i += 1) {
    frame();
    seen.push(SaveSystem.shapesThroughLevel);
  }

  expect(SaveSystem.shapesThroughLevel).toBe(behind);
  // Never more than one chunk per frame, and every call is capped at one chunk.
  let previous = 0;
  for (const through of seen) {
    expect(through - previous).toBeLessThanOrEqual(COLLECTION_SYNC_CHUNK_STEPS);
    previous = through;
  }
  expect(seen.length).toBeGreaterThanOrEqual(3); // three chunks need three frames at least
  expect(sync.mock.calls.map(([steps]) => steps)).toEqual([
    COLLECTION_SYNC_CHUNK_STEPS,
    COLLECTION_SYNC_CHUNK_STEPS,
    COLLECTION_SYNC_CHUNK_STEPS,
  ]);
});

test('with the real SaveSystem, each frame\'s slice ends when the time budget is used', () => {
  // Every performance.now() read advances 1 ms: a slice then folds exactly
  // COLLECTION_SYNC_SLICE_MS levels (the first unconditionally, then one per check).
  let t = 0;
  jest.spyOn(performance, 'now').mockImplementation(() => {
    t += 1;
    return t;
  });
  store.setInt('arrows_current_level', 40);
  renderMenu();
  waitForFoldStart();

  const seen: number[] = [];
  for (let i = 0; i < 40 && SaveSystem.shapesThroughLevel < 40; i += 1) {
    frame();
    seen.push(SaveSystem.shapesThroughLevel);
  }

  const steps = seen.map((through, i) => through - (i === 0 ? 0 : seen[i - 1]));
  expect(SaveSystem.shapesThroughLevel).toBe(40);
  expect(Math.max(...steps)).toBe(COLLECTION_SYNC_SLICE_MS);
  expect(steps.filter((n) => n > 0).slice(0, -1).every((n) => n === COLLECTION_SYNC_SLICE_MS)).toBe(true);
});

test('one menu mount folds at most the per-mount budget', () => {
  store.setInt('arrows_current_level', COLLECTION_SYNC_BUDGET_STEPS + 1000);
  renderMenu();
  waitForFoldStart();

  for (let i = 0; i < 200; i += 1) frame();

  expect(SaveSystem.shapesThroughLevel).toBe(COLLECTION_SYNC_BUDGET_STEPS);
});

test('unmounting the menu stops the fold', () => {
  store.setInt('arrows_current_level', COLLECTION_SYNC_BUDGET_STEPS);
  const menu = renderMenu();
  waitForFoldStart();
  frame();
  frame();
  const atUnmount = SaveSystem.shapesThroughLevel;
  menu.unmount();

  for (let i = 0; i < 200; i += 1) frame();

  expect(atUnmount).toBeGreaterThan(0);
  expect(SaveSystem.shapesThroughLevel).toBe(atUnmount);
});

test('leaving the menu during its opening seconds cancels the fold before it starts', () => {
  store.setInt('arrows_current_level', 50);
  const sync = jest.spyOn(SaveSystem, 'syncCollection');
  const menu = renderMenu();
  act(() => {
    jest.advanceTimersByTime(COLLECTION_SYNC_START_DELAY_MS / 2);
  });
  menu.unmount();

  act(() => {
    jest.advanceTimersByTime(COLLECTION_SYNC_START_DELAY_MS * 2);
  });

  expect(sync).not.toHaveBeenCalled();
  expect(store.map.has('arrows_shapes_through_level')).toBe(false);
});

test('kill constant off: the menu never folds', () => {
  mockFlags.COLLECTION_SYNC_ENABLED = false;
  store.setInt('arrows_current_level', 50);
  renderMenu();
  waitForFoldStart();

  for (let i = 0; i < 20; i += 1) frame();

  expect([...store.map.keys()]).toEqual(['arrows_current_level']);
});

test('FINAL-FIX (finding 14): the fold stops when the menu STARTS leaving, not only at its removal two UI frames later', () => {
  store.setInt('arrows_current_level', COLLECTION_SYNC_BUDGET_STEPS);
  const menu = (leaving: boolean) => (
    <ScreenSlot leaving={leaving}>
      <HomeScreen
        palette={Daylight}
        dark={false}
        soundOn
        onPlay={jest.fn()}
        onToggleSound={jest.fn()}
        onToggleTheme={jest.fn()}
      />
    </ScreenSlot>
  );
  const view = render(menu(false));
  waitForFoldStart();
  frame();
  frame();
  const atLeave = SaveSystem.shapesThroughLevel;
  expect(atLeave).toBeGreaterThan(0);

  // Play pressed: the hand-off keeps the menu mounted, invisible, while the game mounts.
  view.rerender(menu(true));
  const sync = jest.spyOn(SaveSystem, 'syncCollection');
  for (let i = 0; i < 20; i += 1) frame();

  expect(sync).not.toHaveBeenCalled();
  expect(SaveSystem.shapesThroughLevel).toBe(atLeave);
  view.unmount();
});
