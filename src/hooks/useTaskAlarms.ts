import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { ALARM_REGISTRY_KEY } from '../lib/constants';
import { deleteRetiredChannels, ensureAndroidChannel, TASK_CHANNEL_ID } from '../lib/notifications';
import { alarmGroups } from '../lib/todos';
import type { Todo } from '../types';

export const useTaskAlarms = (ready: boolean, canNotify: boolean, todos: Todo[]) => {
  const alarmSignature = useRef('');

  // 列表一变就整批重排：先取消上一批（id 记在本地存储里，所以重启后也清得掉），再按当前列表重排。
  const syncTaskAlarms = async (items: Todo[]) => {
    const groups = alarmGroups(items);
    const signature = groups.map((group) => `${group.key}|${group.body}`).join('||');
    if (signature === alarmSignature.current) return;
    alarmSignature.current = signature;
    try {
      const Notifications = await import('expo-notifications');
      Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }) });
      if (Platform.OS === 'android') await ensureAndroidChannel(Notifications, TASK_CHANNEL_ID, { name: '任务到点提醒', description: '每条待办到自己的时间响一次', importance: Notifications.AndroidImportance.MAX, vibrationPattern: [0, 250, 250, 250] });
      const stored = await AsyncStorage.getItem(ALARM_REGISTRY_KEY);
      for (const id of stored ? (JSON.parse(stored) as string[]) : []) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      const ids: string[] = [];
      for (const group of groups) {
        const id = await Notifications.scheduleNotificationAsync({ content: { title: `⏰ ${group.key.slice(11)} 待办`, body: group.body }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: group.when, channelId: TASK_CHANNEL_ID } });
        if (id) ids.push(id);
      }
      await AsyncStorage.setItem(ALARM_REGISTRY_KEY, JSON.stringify(ids));
    } catch (error) {
      alarmSignature.current = '';
      console.warn('到点通知排不出去：', error);
    }
  };

  useEffect(() => {
    if (!ready || !canNotify) return;
    void syncTaskAlarms(todos);
  }, [ready, canNotify, todos]);

  const retiredRef = useRef(false);
  useEffect(() => {
    if (!ready || retiredRef.current || Platform.OS !== 'android') return;
    retiredRef.current = true;
    void deleteRetiredChannels();
  }, [ready]);
};
