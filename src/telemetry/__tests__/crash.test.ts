import {
  drainFatals,
  installFatalHandler,
  type ErrorUtilsLike,
  type FatalStore,
} from '../crash';
import { fnv1a32 } from '../hash';
import { SaveSystem, type IntStore } from '../../core/saveSystem';

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;

class FakeErrorUtils implements ErrorUtilsLike {
  handler: GlobalHandler;

  constructor(previousHandler: GlobalHandler) {
    this.handler = previousHandler;
  }

  getGlobalHandler(): GlobalHandler {
    return this.handler;
  }

  setGlobalHandler(handler: GlobalHandler): void {
    this.handler = handler;
  }
}

class MemoryStore implements FatalStore {
  telFatalPending = 0;
  telFatalHash = 0;
  telFatalScreen = 0;
  readonly writes: Array<{ field: string; value: number }> = [];

  constructor(seed: Partial<Pick<FatalStore, 'telFatalPending' | 'telFatalHash' | 'telFatalScreen'>> = {}) {
    Object.assign(this, seed);
  }

  setTelFatalPending(value: number): void {
    this.telFatalPending = value;
    this.writes.push({ field: 'telFatalPending', value });
  }

  setTelFatalHash(value: number): void {
    this.telFatalHash = value;
    this.writes.push({ field: 'telFatalHash', value });
  }

  setTelFatalScreen(value: number): void {
    this.telFatalScreen = value;
    this.writes.push({ field: 'telFatalScreen', value });
  }
}

test('the previous handler is called exactly once with the original arguments', () => {
  const previousHandler = jest.fn<void, Parameters<GlobalHandler>>();
  const errorUtils = new FakeErrorUtils(previousHandler);
  const error = new Error('boom');

  installFatalHandler({
    errorUtils,
    save: new MemoryStore(),
    currentScreen: () => 'menu',
  });
  errorUtils.handler(error, true);

  expect(previousHandler).toHaveBeenCalledTimes(1);
  expect(previousHandler).toHaveBeenCalledWith(error, true);
});

test('the handler does not throw when the save throws, and still delegates', () => {
  const previousHandler = jest.fn<void, Parameters<GlobalHandler>>();
  const errorUtils = new FakeErrorUtils(previousHandler);
  const save: FatalStore = {
    telFatalPending: 0,
    telFatalHash: 0,
    telFatalScreen: 0,
    setTelFatalPending: () => {
      throw new Error('write failed');
    },
    setTelFatalHash: () => {
      throw new Error('write failed');
    },
    setTelFatalScreen: () => {
      throw new Error('write failed');
    },
  };
  const error = new Error('boom');

  installFatalHandler({ errorUtils, save, currentScreen: () => 'game' });

  expect(() => errorUtils.handler(error, true)).not.toThrow();
  expect(previousHandler).toHaveBeenCalledTimes(1);
  expect(previousHandler).toHaveBeenCalledWith(error, true);
});

test('a non-fatal error changes no save value', () => {
  const previousHandler = jest.fn<void, Parameters<GlobalHandler>>();
  const errorUtils = new FakeErrorUtils(previousHandler);
  const save = new MemoryStore();

  installFatalHandler({ errorUtils, save, currentScreen: () => 'menu' });
  errorUtils.handler(new Error('recoverable'), false);

  expect(save.writes).toEqual([]);
  expect(save.telFatalPending).toBe(0);
  expect(save.telFatalHash).toBe(0);
  expect(save.telFatalScreen).toBe(0);
  expect(previousHandler).toHaveBeenCalledTimes(1);
});

test("a fatal persists fnv1a32('Error:secret-xyz') and the menu screen enum", () => {
  const errorUtils = new FakeErrorUtils(jest.fn());
  const save = new MemoryStore({ telFatalPending: 2 });

  installFatalHandler({ errorUtils, save, currentScreen: () => 'menu' });
  errorUtils.handler(new Error('secret-xyz'), true);

  expect(save.telFatalPending).toBe(3);
  expect(save.telFatalHash).toBe(fnv1a32('Error:secret-xyz'));
  expect(save.telFatalScreen).toBe(2);
});

test('neither persisted keys nor the emitted event contain the fatal message', () => {
  const errorUtils = new FakeErrorUtils(jest.fn());
  const save = new MemoryStore();
  const emitError = jest.fn();

  installFatalHandler({ errorUtils, save, currentScreen: () => 'game' });
  errorUtils.handler(new Error('secret-xyz'), true);
  drainFatals({ save, emitError });

  expect(JSON.stringify({ save, emitted: emitError.mock.calls })).not.toContain('secret-xyz');
});

test('drainFatals emits one aggregate for three pending fatals and resets pending', () => {
  const save = new MemoryStore({
    telFatalPending: 3,
    telFatalHash: 0xfeedbeef,
    telFatalScreen: 3,
  });
  const emitError = jest.fn();

  drainFatals({ save, emitError });

  expect(emitError).toHaveBeenCalledTimes(1);
  expect(emitError).toHaveBeenCalledWith({
    kind: 'js_fatal',
    nameMessageHash: 0xfeedbeef,
    screen: 'game',
    count: 3,
  });
  expect(save.telFatalPending).toBe(0);
});

test('drainFatals emits nothing and writes nothing when pending is zero', () => {
  const save = new MemoryStore();
  const emitError = jest.fn();

  drainFatals({ save, emitError });

  expect(emitError).not.toHaveBeenCalled();
  expect(save.writes).toEqual([]);
});

test('the real SaveSystem accessors use the three registered fatal keys and sanitize their contracts', () => {
  class RecordingIntStore implements IntStore {
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

  const store = new RecordingIntStore();
  SaveSystem.useStore(store);
  SaveSystem.setTelFatalPending(4);
  SaveSystem.setTelFatalHash(0xffffffff);
  SaveSystem.setTelFatalScreen(2);

  expect(store.map).toEqual(new Map([
    ['arrows_tel_fatal_pending', 4],
    ['arrows_tel_fatal_hash', 0xffffffff],
    ['arrows_tel_fatal_screen', 2],
  ]));
  expect(SaveSystem.telFatalPending).toBe(4);
  expect(SaveSystem.telFatalHash).toBe(0xffffffff);
  expect(SaveSystem.telFatalScreen).toBe(2);

  store.map.set('arrows_tel_fatal_pending', -3);
  store.map.set('arrows_tel_fatal_screen', 99);
  expect(SaveSystem.telFatalPending).toBe(0);
  expect(SaveSystem.telFatalScreen).toBe(0);
});
