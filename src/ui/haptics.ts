import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Tactile feedback for the three gameplay beats (trending arrow-puzzle games
 * live on this): a light tick when an arrow slides out, a firm bump when one
 * is blocked, a success tap on a clear. No-ops on web and never throws —
 * haptics are seasoning, not gameplay.
 */
const on = Platform.OS !== 'web';

export const Haptic = {
  exit(): void {
    if (on) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  blocked(): void {
    if (on) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  },
  cleared(): void {
    if (on) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
};
