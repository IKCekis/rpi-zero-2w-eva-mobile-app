/**
 * Haptics — thin semantic wrapper over expo-haptics.
 *
 * The user opted for vibration feedback instead of sound effects. Every call is
 * fire-and-forget and guarded: on web / unsupported devices it silently no-ops.
 */

import * as ExpoHaptics from 'expo-haptics';
import { Platform } from 'react-native';

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

function safe(fn: () => Promise<unknown>): void {
  if (!enabled) return;
  try { fn().catch(() => {}); } catch { /* ignore */ }
}

export const Haptics = {
  /** Light tick for taps / button presses. */
  tap() {
    safe(() => ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light));
  },
  /** Selection change (toggles, picking an option). */
  selection() {
    safe(() => ExpoHaptics.selectionAsync());
  },
  /** Positive outcome (cook success, item used, game won). */
  success() {
    safe(() => ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success));
  },
  /** Negative outcome (burned, wrong PIN, game lost). */
  error() {
    safe(() => ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Error));
  },
  /** Celebratory double-tap for level-ups. */
  levelUp() {
    safe(() => ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success));
    setTimeout(() => safe(() => ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Heavy)), 140);
  },
};
