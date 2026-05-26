/**
 * Notifications — stat-based reminders + media-detection alerts.
 * Uses expo-notifications (local only, no FCM needed).
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Stats } from '../store/types';

const CHANNEL_REMINDERS = 'eva-reminders';
const CHANNEL_MEDIA     = 'eva-media';

// Minimum interval between same-type notifications (ms)
const MIN_INTERVAL_MS = 90 * 60 * 1000; // 90 minutes

const lastSent: Record<string, number> = {};

function canSend(key: string): boolean {
  const now = Date.now();
  if ((now - (lastSent[key] ?? 0)) < MIN_INTERVAL_MS) return false;
  lastSent[key] = now;
  return true;
}

export async function setupNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge:  false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_REMINDERS, {
      name:       'Eva Hatırlatmaları',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250],
    });
    await Notifications.setNotificationChannelAsync(CHANNEL_MEDIA, {
      name:       'Eva Medya',
      importance: Notifications.AndroidImportance.LOW,
    });
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return;
}

export async function checkAndSendStatReminders(stats: Stats): Promise<void> {
  const alerts: { key: string; condition: boolean; title: string; body: string }[] = [
    {
      key: 'hungry', condition: stats.hunger < 25,
      title: 'Eva acıktı! 🍎',
      body:  'Karnı guruldamaya başladı. Onu besle!',
    },
    {
      key: 'sad', condition: stats.happiness < 25,
      title: 'Eva mutsuz 💙',
      body:  'Biraz eğlenmeye ihtiyacı var.',
    },
    {
      key: 'tired', condition: stats.energy < 20,
      title: 'Eva yoruldu ⚡',
      body:  'Dinlenmeye çok ihtiyacı var.',
    },
    {
      key: 'dirty', condition: stats.clean < 20,
      title: 'Eva kirlenmiş 🚿',
      body:  'Yıkama zamanı!',
    },
    {
      key: 'sick', condition: stats.health < 20,
      title: 'Eva hasta 😢',
      body:  'Tüm statlarını düzelt, iyileşecek.',
    },
  ];

  for (const a of alerts) {
    if (a.condition && canSend(a.key)) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title:             a.title,
          body:              a.body,
          android:           { channelId: CHANNEL_REMINDERS },
        },
        trigger: null, // immediate
      });
    }
  }
}

export async function sendLongAbsenceReminder(elapsedHours: number): Promise<void> {
  if (!canSend('absence')) return;
  const body = elapsedHours > 12
    ? 'Eva çok uzun süredir yalnız. Hastalıktan ölmeden önce gel!'
    : 'Eva seni özlüyor 🥺';
  await Notifications.scheduleNotificationAsync({
    content: {
      title:   'Eva seni özlüyor!',
      body,
      android: { channelId: CHANNEL_REMINDERS },
    },
    trigger: null,
  });
}

export async function sendMediaDetectedNotification(type: 'music' | 'video'): Promise<void> {
  const key = `media_${type}`;
  if (!canSend(key)) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title:   type === 'music' ? '🎵 Müzik duydu!' : '🎬 Film izliyor gibisin!',
      body:    type === 'music'
        ? 'Eva da katılmak istiyor — müzik modu aktif.'
        : 'Eva film moduna geçti. Mutluluk artıyor!',
      android: { channelId: CHANNEL_MEDIA },
    },
    trigger: null,
  });
}

export async function sendDeathNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title:   '💔 Eva gitti...',
      body:    'Onu çok özledin mi? Gizli şifre ile onu geri getirebilirsin.',
      android: { channelId: CHANNEL_REMINDERS, priority: 'high' as any },
    },
    trigger: null,
  });
}
