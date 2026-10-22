import type { Todo } from '../types';
import { alarmDate, dateKey, shift } from './dates';

export const makeSamples = (): Todo[] => [
  { id: 1, text: '规划安卓 Demo 页面', done: false, date: shift(-2), time: '09:00' },
  { id: 2, text: '在手机上预览应用', done: false, date: shift(0), time: '18:00' },
  { id: 3, text: '记录下一步想法', done: false, date: shift(3), time: '09:00' },
];
export const isRingable = (item: Todo) => !item.done && !item.hidden && !item.alarm && !!item.time && alarmDate(item.date, item.time).getTime() > Date.now();
// 同一分钟的多条合并成一条通知；key 形如 `2026-10-22 13:00`
export const alarmGroups = (items: Todo[]) => {
  const buckets = new Map<string, Todo[]>();
  for (const item of items) {
    if (!isRingable(item)) continue;
    const key = `${item.date} ${item.time}`;
    const hit = buckets.get(key);
    buckets.set(key, hit ? [...hit, item] : [item]);
  }
  return [...buckets].map(([key, list]) => ({
    key,
    when: alarmDate(key.slice(0, 10), key.slice(11)),
    body: list.length === 1 ? list[0].text : `${list[0].text}、${list[1].text}${list.length > 2 ? ` 等 ${list.length} 件` : ''}`,
  }));
};
export const reminderBody = (items: Todo[], day: string) => {
  const open = items.filter((item) => !item.hidden && !item.done && item.date === day).length;
  const late = items.filter((item) => !item.hidden && !item.done && item.date < day).length;
  return open || late ? `今天 ${open} 件待完成${late ? ` · ${late} 件已逾期` : ''}` : undefined;
};
export const nextReminderDay = (hour: number, minute: number) => {
  const now = new Date();
  const alreadyFired = now.getHours() > hour || (now.getHours() === hour && now.getMinutes() >= minute);
  return dateKey(alreadyFired ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) : now);
};
export const dueLabel = (todo: Todo) => `${Number(todo.date.slice(5, 7))}月${Number(todo.date.slice(8, 10))}日${todo.time ? ` ${todo.time}` : ''}`;
