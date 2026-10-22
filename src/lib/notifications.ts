import { NativeModules } from 'react-native';

// 只在类型层引用，运行时仍然是按需 import，Expo Go 里不会因为这个 import 而崩。
import type { AndroidImportance } from 'expo-notifications';

export type NotificationsApi = typeof import('expo-notifications');

// 渠道 id 带 -v6：声音和它的音频属性都只在渠道创建那一刻有效，之后应用改不动，所以每次改只能换新 id；旧 id 启动时删掉，免得设置里堆一排同名渠道。
export const CHANNEL_ID = 'daily-reminders-v6';
export const TASK_CHANNEL_ID = 'task-alarms-v6';
export const RETIRED_CHANNEL_IDS = ['daily-reminders', 'daily-reminders-v2', 'daily-reminders-v3', 'daily-reminders-v4', 'daily-reminders-v5', 'task-alarms', 'task-alarms-v2', 'task-alarms-v3', 'task-alarms-v4', 'task-alarms-v5'];

type NotificationTuningBridge = { ensureChannel: (channelId: string, name: string, description: string, importance: number) => Promise<{ ringtone?: string; channel?: string; recreated?: boolean } | null>; openChannelSettings: (channelId: string) => Promise<'channel' | 'app'> };
const NotificationTuning = NativeModules.NotificationTuning as NotificationTuningBridge | undefined;

// 渠道的声音只在「创建那一刻」有效，之后应用改不动（实测：对已存在的渠道 setSound 是空操作），而 expo 只会写 android.resource://，澎湃在系统音库里查不到就直接消音。所以必须抢在 expo 之前用原生把渠道建出来。
export const ensureAndroidChannel = async (Notifications: NotificationsApi, channelId: string, config: { name: string; description?: string; importance: AndroidImportance; vibrationPattern?: number[] }) => {
  try {
    const info = await NotificationTuning?.ensureChannel(channelId, config.name, config.description ?? '', config.importance);
    console.warn('[channel]', channelId, JSON.stringify(info ?? '原生模块不在包里'));
  } catch (error) {
    console.warn('[channel] 建不出来：', error);
  }
  await Notifications.setNotificationChannelAsync(channelId, { ...config, sound: 'default' });
};

// 换过音效的旧渠道在安卓里会一直留着，设置页又只按名字显示，所以启动时清一次，免得同名渠道堆成排。
export const deleteRetiredChannels = async () => {
  const Notifications = await import('expo-notifications');
  for (const id of RETIRED_CHANNEL_IDS) await Notifications.deleteNotificationChannelAsync(id).catch((error) => console.warn(`[channel] 删不掉 ${id}：`, error));
};

export const openTaskChannelSettings = async () => {
  await NotificationTuning?.openChannelSettings(TASK_CHANNEL_ID);
};
