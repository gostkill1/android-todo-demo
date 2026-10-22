import { useEffect, useState } from 'react';

// 通知权限开机读一次：给过就自动把未来的任务排上，没给过就在首页提示一句，不再反复弹授权框。
export const useNotifyPermission = (ready: boolean) => {
  const [granted, setGranted] = useState(false);
  useEffect(() => {
    if (!ready) return;
    let ignore = false;
    void (async () => {
      try {
        const Notifications = await import('expo-notifications');
        if (!ignore) setGranted((await Notifications.getPermissionsAsync()).granted);
      } catch { /* Expo Go 里没有通知模块 */ }
    })();
    return () => { ignore = true; };
  }, [ready]);

  const ensure = async () => {
    if (granted) return true;
    try {
      const Notifications = await import('expo-notifications');
      const result = (await Notifications.getPermissionsAsync()).granted || (await Notifications.requestPermissionsAsync()).granted;
      setGranted(result);
      return result;
    } catch { return false; }
  };

  return { granted, ensure };
};
