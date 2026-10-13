/**
 * TF-02 A (META_HIGH_CONTRAST): the phone's own high-contrast setting, followed live. App.tsx passes the result to
 * `paletteFor(dark, highContrast)` (theme.ts), the one function that picks the palette.
 *
 * React Native 0.86 (node_modules/react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo.js):
 *   - Android: `isHighTextContrastEnabled()` and the `highTextContrastChanged` event. The native module
 *     (AccessibilityInfoModule.kt) watches Settings.Secure `high_text_contrast_enabled` with a ContentObserver while the
 *     app is resumed, and re-reads it on resume, so a change made in the background also arrives.
 *   - iOS: "Increase Contrast" is `isDarkerSystemColorsEnabled()` and the `darkerSystemColorsChanged` event.
 *   - Web and others: no such setting; always false.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

export interface HighContrastApi {
  query: () => Promise<boolean>;
  event: 'highTextContrastChanged' | 'darkerSystemColorsChanged';
}

export function highContrastApi(os: string): HighContrastApi | null {
  if (os === 'android') {
    return { query: () => AccessibilityInfo.isHighTextContrastEnabled(), event: 'highTextContrastChanged' };
  }
  if (os === 'ios') {
    return { query: () => AccessibilityInfo.isDarkerSystemColorsEnabled(), event: 'darkerSystemColorsChanged' };
  }
  return null;
}

/**
 * Whether the phone's high-contrast setting is on. `enabled` false (META_HIGH_CONTRAST off): always false, and the
 * setting is never read nor listened to. An event that arrives before the first read answers wins over that read; a
 * failed read counts as off.
 */
export function useSystemHighContrast(enabled: boolean, os: string = Platform.OS): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const api = enabled ? highContrastApi(os) : null;
    if (!api) {
      setOn(false);
      return undefined;
    }
    let live = true;
    let heardEvent = false;
    const sub = AccessibilityInfo.addEventListener(api.event, (value: boolean) => {
      heardEvent = true;
      if (live) setOn(value === true);
    });
    api.query().then(
      (value) => {
        if (live && !heardEvent) setOn(value === true);
      },
      () => undefined,
    );
    return () => {
      live = false;
      sub.remove();
    };
  }, [enabled, os]);
  return enabled && on;
}
