import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { Alert, Platform } from 'react-native';
import { pad } from '../lib/dates';
import { CHANNEL_ID, ensureAndroidChannel } from '../lib/notifications';
import { nextReminderDay, reminderBody } from '../lib/todos';
import type { Reminder, Todo } from '../types';

export const useDailyReminder = (ready: boolean, todos: Todo[], reminder: Reminder, setReminder: Dispatch<SetStateAction<Reminder>>) => {
  const scheduledIdRef = useRef<string | undefined>(undefined);
  const appliedRef = useRef('');

  const adoptSchedule = (id?: string) => { scheduledIdRef.current = id; };

  const applyReminder = async (base: Reminder, items: Todo[], request: boolean) => {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }) });
    if (Platform.OS === 'android') await ensureAndroidChannel(Notifications, CHANNEL_ID, { name: '每日待办提醒', importance: Notifications.AndroidImportance.HIGH });
    if (!base.enabled) {
      if (scheduledIdRef.current) await Notifications.cancelScheduledNotificationAsync(scheduledIdRef.current).catch(() => {});
      scheduledIdRef.current = undefined; appliedRef.current = '';
      return { ...base, notificationId: undefined };
    }
    const granted = (await Notifications.getPermissionsAsync()).granted || (request && (await Notifications.requestPermissionsAsync()).granted);
    if (!granted) return base;
    const body = reminderBody(items, nextReminderDay(Number(base.hour), Number(base.minute)));
    const signature = `${base.hour}:${base.minute}|${body ?? '静默'}`;
    if (!request && signature === appliedRef.current) return base;
    if (scheduledIdRef.current) await Notifications.cancelScheduledNotificationAsync(scheduledIdRef.current).catch(() => {});
    if (!body) { scheduledIdRef.current = undefined; appliedRef.current = signature; return { ...base, notificationId: undefined }; }
    const notificationId = await Notifications.scheduleNotificationAsync({ content: { title: '待办清单', body, sound: 'default' }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: Number(base.hour), minute: Number(base.minute), channelId: CHANNEL_ID } });
    scheduledIdRef.current = notificationId; appliedRef.current = signature;
    return { ...base, notificationId };
  };

  useEffect(() => {
    if (!ready) return;
    let ignore = false;
    void (async () => {
      try {
        const updated = await applyReminder(reminder, todos, false);
        if (!ignore) setReminder((item) => (item.notificationId === updated.notificationId ? item : { ...item, notificationId: updated.notificationId }));
      } catch { /* Expo Go 没有通知模块，交给拨开关/滚时间时的提示处理 */ }
    })();
    return () => { ignore = true; };
  }, [ready, todos, reminder.enabled, reminder.hour, reminder.minute]);

  const commitReminder = async (next: Reminder) => {
    const hour = Number(next.hour); const minute = Number(next.minute);
    if (!(hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59)) { Alert.alert('时间无效', '小时要在 00–23，分钟要在 00–59。'); return; }
    const settled: Reminder = { ...next, hour: pad(hour), minute: pad(minute) };
    try {
      const updated = await applyReminder(settled, todos, true);
      setReminder(updated);
      if (updated.enabled && !updated.notificationId) Alert.alert('还没真正安排上', `${updated.hour}:${updated.minute} 这个时间已经记住了。要么系统还不允许通知，要么近期没有未完成的待办；允许通知后回来把开关关一下再打开就行。`);
    } catch {
      scheduledIdRef.current = undefined; appliedRef.current = '';
      setReminder({ ...settled, enabled: false, notificationId: undefined });
      Alert.alert('这台机器安排不了', '通知模块不可用（Expo Go 里没有这个模块），开关停在关闭。装上 APK 才能收到每日推送。');
    }
  };

  return { adoptSchedule, commitReminder };
};
