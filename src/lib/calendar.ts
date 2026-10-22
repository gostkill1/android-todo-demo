import { NativeModules } from 'react-native';

type SystemCalendarBridge = { openCreateEvent: (title: string, description: string, beginTime: number, endTime: number) => Promise<boolean> };
const SystemCalendar = NativeModules.SystemCalendar as SystemCalendarBridge | undefined;

// resolve 只代表「创建日程页打开了」：系统界面不回传用户最后点了 ✓ 还是 ✗。
export const openCalendarEvent = async (title: string, when: Date) => {
  if (!SystemCalendar) throw new Error('日历模块不在包里');
  const begin = when.getTime();
  await SystemCalendar.openCreateEvent(title, '', begin, begin + 30 * 60 * 1000);
};
