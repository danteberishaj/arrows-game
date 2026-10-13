/**
 * TF-02 A (META_HIGH_CONTRAST): `useSystemHighContrast` follows the phone's own high-contrast setting, live.
 * Android: AccessibilityInfo.isHighTextContrastEnabled() + 'highTextContrastChanged'; iOS: isDarkerSystemColorsEnabled()
 * + 'darkerSystemColorsChanged' (RN 0.86 AccessibilityInfo.js). The event is mocked; the device swap closes on the
 * emulator capture (artifacts/TF-02/hc-*.png, `settings put secure high_text_contrast_enabled`).
 */
import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { highContrastApi, useSystemHighContrast } from '../highContrast';
import { paletteFor } from '../theme';

type Handler = (on: boolean) => void;
let handlers: Record<string, Handler[]>;
let removed: string[];

beforeEach(() => {
  handlers = {};
  removed = [];
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((name: string, h: Handler) => {
    (handlers[name] ??= []).push(h);
    return { remove: () => removed.push(name) };
  }) as never);
});
afterEach(() => jest.restoreAllMocks());

function Probe({ enabled, os }: { enabled: boolean; os?: 'android' | 'ios' | 'web' }) {
  const hc = useSystemHighContrast(enabled, os);
  // The palette App draws: the one pure choice, with the hook's value.
  return <Text testID="probe">{`${hc ? 'hc' : 'normal'} ${paletteFor(false, hc).accent}`}</Text>;
}
const text = (r: ReturnType<typeof render>) => r.getByTestId('probe').props.children as string;

describe('highContrastApi: which setting each platform reads', () => {
  it('android: high text contrast', () => {
    expect(highContrastApi('android')?.event).toBe('highTextContrastChanged');
  });
  it('ios: increase contrast (darker system colours)', () => {
    expect(highContrastApi('ios')?.event).toBe('darkerSystemColorsChanged');
  });
  it('web and others: none', () => {
    expect(highContrastApi('web')).toBeNull();
  });
});

describe('useSystemHighContrast', () => {
  it('flag OFF: never reads the setting nor listens, and the palette is the normal one', async () => {
    const query = jest.spyOn(AccessibilityInfo, 'isHighTextContrastEnabled').mockResolvedValue(true);
    const r = render(<Probe enabled={false} os="android" />);
    await act(async () => { await Promise.resolve(); });
    expect(query).not.toHaveBeenCalled();
    expect(AccessibilityInfo.addEventListener).not.toHaveBeenCalled();
    expect(text(r)).toBe('normal #6D4AEF');
  });

  it('android, ON: reads the setting at mount, then swaps live on the event (no remount), both ways', async () => {
    jest.spyOn(AccessibilityInfo, 'isHighTextContrastEnabled').mockResolvedValue(false);
    const r = render(<Probe enabled os="android" />);
    await act(async () => { await Promise.resolve(); });
    expect(text(r)).toBe('normal #6D4AEF');
    expect(handlers.highTextContrastChanged).toHaveLength(1);
    act(() => handlers.highTextContrastChanged[0](true));
    expect(text(r)).toBe('hc #4518EB');
    act(() => handlers.highTextContrastChanged[0](false));
    expect(text(r)).toBe('normal #6D4AEF');
  });

  it('android, ON: a phone already in high contrast starts in high contrast', async () => {
    jest.spyOn(AccessibilityInfo, 'isHighTextContrastEnabled').mockResolvedValue(true);
    const r = render(<Probe enabled os="android" />);
    await act(async () => { await Promise.resolve(); });
    expect(text(r)).toBe('hc #4518EB');
  });

  it('an event that lands before the first read answers wins over the stale read', async () => {
    let resolve: (v: boolean) => void = () => undefined;
    jest.spyOn(AccessibilityInfo, 'isHighTextContrastEnabled').mockReturnValue(new Promise((res) => { resolve = res; }));
    const r = render(<Probe enabled os="android" />);
    act(() => handlers.highTextContrastChanged[0](true));
    await act(async () => { resolve(false); await Promise.resolve(); });
    expect(text(r)).toBe('hc #4518EB');
  });

  it('a failed read is "off" (no throw)', async () => {
    jest.spyOn(AccessibilityInfo, 'isHighTextContrastEnabled').mockRejectedValue(new Error('not available'));
    const r = render(<Probe enabled os="android" />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(text(r)).toBe('normal #6D4AEF');
  });

  it('ios, ON: darker system colours', async () => {
    jest.spyOn(AccessibilityInfo, 'isDarkerSystemColorsEnabled').mockResolvedValue(false);
    const r = render(<Probe enabled os="ios" />);
    await act(async () => { await Promise.resolve(); });
    act(() => handlers.darkerSystemColorsChanged[0](true));
    expect(text(r)).toBe('hc #4518EB');
  });

  it('unmount removes the listener', async () => {
    jest.spyOn(AccessibilityInfo, 'isHighTextContrastEnabled').mockResolvedValue(false);
    const r = render(<Probe enabled os="android" />);
    await act(async () => { await Promise.resolve(); });
    r.unmount();
    expect(removed).toEqual(['highTextContrastChanged']);
  });
});
