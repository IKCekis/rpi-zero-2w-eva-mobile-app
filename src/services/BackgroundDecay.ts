/**
 * BackgroundDecay — keeps Eva's persisted state decaying and fires reminder /
 * death notifications while the app is backgrounded or suspended.
 *
 * Platform note: when the app is fully terminated (especially iOS) the OS will
 * not run this task. This maximizes what is possible within those limits — it
 * does not work around a hard-killed app.
 */

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadAndDecay, saveState, isDead } from './StatDecay';
import { checkAndSendStatReminders, sendDeathNotification } from './Notifications';

export const DECAY_TASK = 'EVA_STAT_DECAY';
const DEATH_FLAG = 'eva.deathNotified';

TaskManager.defineTask(DECAY_TASK, async () => {
  try {
    const result = await loadAndDecay();
    if (!result) return BackgroundFetch.BackgroundFetchResult.NoData;

    const decayed = result.state.stats;
    // Persist the decayed snapshot so the next run continues from here.
    await saveState({
      stats:       decayed,
      coins:       result.state.coins,
      mediaMode:   'none',
      level:       result.state.level,
      xp:          result.state.xp,
      inventory:   result.state.inventory,
      cookedItems: result.state.cookedItems,
    });

    if (isDead(decayed)) {
      // Notify once per death until the pet is revived.
      const already = await AsyncStorage.getItem(DEATH_FLAG);
      if (already !== 'true') {
        await sendDeathNotification();
        await AsyncStorage.setItem(DEATH_FLAG, 'true');
      }
    } else {
      await AsyncStorage.removeItem(DEATH_FLAG);
      await checkAndSendStatReminders(decayed);
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundDecay(): Promise<void> {
  try {
    await BackgroundFetch.registerTaskAsync(DECAY_TASK, {
      minimumInterval: 15 * 60,   // Android floor is 15 min
      stopOnTerminate: false,
      startOnBoot:     true,
    });
  } catch { /* already registered */ }
}
