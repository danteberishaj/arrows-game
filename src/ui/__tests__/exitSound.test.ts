/**
 * Owner pick 2026-10-18: the arrow-exit pop plays again (a real CC0 recording, after the
 * 2026-10-06 mute of the synthesized one). It follows the player's sound setting like every
 * other sound, and the exit haptic plays either way.
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

test('the exit pop is switched on', () => {
  expect(EXIT_POP_ENABLED).toBe(true);
});

describe('fallback path (iOS / web / Expo Go)', () => {
  const { feedback } = require('../feedbackFallback') as typeof import('../feedbackFallback');

  test('exit plays the pop at its combo step and keeps its haptic', () => {
    feedback('exit', true, 3);
    expect(mockSfx.playSuccess).toHaveBeenCalledWith(3);
    expect(mockHaptic.exit).toHaveBeenCalledTimes(1);
  });

  test('exit is silent when the player turned sound off', () => {
    feedback('exit', false, 3);
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
  test('exit reaches the native module with the player sound setting', () => {
    mockNative = { feedback: mockNativeFeedback, prepare: jest.fn(), release: jest.fn() };
    const { feedback } = require(`../feedback.${platform}`) as typeof import('../feedback.android');
    feedback('exit', true, 5);
    feedback('exit', false, 6);
    expect(mockNativeFeedback.mock.calls).toEqual([
      ['exit', true, 5],
      ['exit', false, 6],
    ]);
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
