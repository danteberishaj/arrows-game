/**
 * Owner ruling 2026-10-06: the arrow-exit pop is not played at all. Every other sound
 * (blocked, cleared, star) and every haptic, the exit haptic included, stays.
 */
const mockNativeFeedback = jest.fn();
let mockNative: { feedback: jest.Mock; prepare: jest.Mock; release: jest.Mock } | null = null;

jest.mock('../../../modules/arrows-feedback', () => ({
  get ArrowsFeedback() {
    return mockNative;
  },
}));

const mockSfx = { playSuccess: jest.fn(), playFail: jest.fn(), playWin: jest.fn(), playStar: jest.fn() };
jest.mock('../audio', () => ({ Sfx: mockSfx }));

const mockHaptic = { exit: jest.fn(), blocked: jest.fn(), cleared: jest.fn(), nudge: jest.fn() };
jest.mock('../haptics', () => ({ Haptic: mockHaptic }));

import { EXIT_POP_ENABLED } from '../exitCombo';

beforeEach(() => {
  jest.clearAllMocks();
  mockNative = null;
});

test('the exit pop is switched off', () => {
  expect(EXIT_POP_ENABLED).toBe(false);
});

describe('fallback path (iOS / web / Expo Go)', () => {
  const { feedback } = require('../feedbackFallback') as typeof import('../feedbackFallback');

  test('exit plays no sound but keeps its haptic', () => {
    feedback('exit', true, 3);
    expect(mockSfx.playSuccess).not.toHaveBeenCalled();
    expect(mockHaptic.exit).toHaveBeenCalledTimes(1);
  });

  test('the other sounds still play', () => {
    feedback('blocked', true);
    feedback('cleared', true);
    feedback('star', true);
    expect(mockSfx.playFail).toHaveBeenCalledTimes(1);
    expect(mockSfx.playWin).toHaveBeenCalledTimes(1);
    expect(mockSfx.playStar).toHaveBeenCalledTimes(1);
  });
});

describe.each(['android', 'ios'])('native path (feedback.%s)', (platform) => {
  test('exit reaches the native module with sound off, so only its haptic runs', () => {
    mockNative = { feedback: mockNativeFeedback, prepare: jest.fn(), release: jest.fn() };
    const { feedback } = require(`../feedback.${platform}`) as typeof import('../feedback.android');
    feedback('exit', true, 5);
    expect(mockNativeFeedback).toHaveBeenCalledWith('exit', false, 5);
  });

  test('the other events keep the player sound setting', () => {
    mockNative = { feedback: mockNativeFeedback, prepare: jest.fn(), release: jest.fn() };
    const { feedback } = require(`../feedback.${platform}`) as typeof import('../feedback.android');
    feedback('blocked', true, 0);
    feedback('cleared', true, 0);
    feedback('star', false, 0);
    expect(mockNativeFeedback.mock.calls).toEqual([
      ['blocked', true, 0],
      ['cleared', true, 0],
      ['star', false, 0],
    ]);
  });
});
