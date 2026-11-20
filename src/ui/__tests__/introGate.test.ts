import { AFTER_INTRO_MS, INTRO_FALLBACK_MS, afterIntro, introOver, resetIntroGateForTests } from '../introGate';

beforeEach(() => {
  jest.useFakeTimers();
  resetIntroGateForTests();
});
afterEach(() => jest.useRealTimers());

test('work waits for the intro, then runs once, AFTER_INTRO_MS after the hand-over', () => {
  const fn = jest.fn();
  afterIntro(fn);
  jest.advanceTimersByTime(3000);
  expect(fn).not.toHaveBeenCalled();
  introOver();
  jest.advanceTimersByTime(AFTER_INTRO_MS - 1);
  expect(fn).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  expect(fn).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(INTRO_FALLBACK_MS);
  expect(fn).toHaveBeenCalledTimes(1);
});

test('a splash that never reports still releases the work at INTRO_FALLBACK_MS', () => {
  const fn = jest.fn();
  afterIntro(fn);
  jest.advanceTimersByTime(INTRO_FALLBACK_MS);
  expect(fn).toHaveBeenCalledTimes(1);
});

test('work queued after the intro runs at once', () => {
  introOver();
  jest.advanceTimersByTime(AFTER_INTRO_MS);
  const fn = jest.fn();
  afterIntro(fn);
  expect(fn).toHaveBeenCalledTimes(1);
});
