/**
 * MediaWatcher — polls AudioManager every 30 s (foreground) and via
 * expo-background-fetch every 15 min (background).
 *
 * Detected state changes are written to the zustand store and trigger BLE commands.
 */

import { AppState, AppStateStatus } from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { MediaState } from '../native/MediaState';
import { sendMediaDetectedNotification } from './Notifications';

export const MEDIA_TASK = 'EVA_MEDIA_CHECK';

// ── Background task (runs even when app is suspended) ────────────────────────

// This callback is set by MediaWatcher.init() so the background task can
// update the store without importing it directly (circular deps).
type OnMediaChange = (mode: 'none' | 'music' | 'video') => void;
let _onMediaChange: OnMediaChange = () => {};

TaskManager.defineTask(MEDIA_TASK, async () => {
  try {
    const active = await MediaState.isMusicActive();
    const mode: 'none' | 'music' = active ? 'music' : 'none';
    _onMediaChange(mode);
    if (active) await sendMediaDetectedNotification('music');
    return active
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ── Foreground polling ────────────────────────────────────────────────────────

let _pollTimer: ReturnType<typeof setInterval> | null = null;
let _lastMode: 'none' | 'music' | 'video' = 'none';
let _appState: AppStateStatus = AppState.currentState;

async function poll(onMediaChange: OnMediaChange): Promise<void> {
  const active = await MediaState.isMusicActive();
  const newMode: 'none' | 'music' = active ? 'music' : 'none';

  if (newMode !== _lastMode && newMode !== 'none') {
    await sendMediaDetectedNotification('music');
  }
  if (newMode !== _lastMode) {
    _lastMode = newMode;
    onMediaChange(newMode);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function initMediaWatcher(onMediaChange: OnMediaChange): () => void {
  _onMediaChange = onMediaChange;

  // Register background task
  BackgroundFetch.registerTaskAsync(MEDIA_TASK, {
    minimumInterval:       15 * 60, // Android minimum is 15 min
    stopOnTerminate:       false,
    startOnBoot:           true,
  }).catch(() => {/* already registered */});

  // Foreground polling
  const startPoll = () => {
    if (_pollTimer) return;
    _pollTimer = setInterval(() => poll(onMediaChange), 30_000);
    poll(onMediaChange); // immediate first check
  };

  const stopPoll = () => {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  };

  if (_appState === 'active') startPoll();

  const sub = AppState.addEventListener('change', (next) => {
    _appState = next;
    if (next === 'active')  startPoll();
    else                    stopPoll();
  });

  return () => {
    stopPoll();
    sub.remove();
    BackgroundFetch.unregisterTaskAsync(MEDIA_TASK).catch(() => {});
  };
}

/** Call when user manually selects a media mode (e.g. taps "Film modu"). */
export function setManualMediaMode(
  mode: 'none' | 'music' | 'video',
  onMediaChange: OnMediaChange,
): void {
  _lastMode = mode === 'video' ? 'video' : mode;
  onMediaChange(mode);
}
