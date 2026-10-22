import type { Wheel } from '../types';

export const pad = (value: number) => String(value).padStart(2, '0');
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const shift = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return dateKey(d); };
export const dayCount = (year: number, month: number) => new Date(year, month, 0).getDate();
export const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
export const minWheel = (): Wheel => {
  const now = new Date();
  const nine = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0);
  const floor = now > nine ? now : nine;
  return { year: floor.getFullYear(), month: floor.getMonth() + 1, day: floor.getDate(), hour: floor.getHours(), minute: floor.getMinutes() };
};
export const editFloor = (): Wheel => { const now = new Date(); return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(), hour: 0, minute: 0 }; };
export const clampWheel = (next: Wheel, floor: Wheel): Wheel => {
  const year = Math.max(next.year, floor.year);
  const month = year === floor.year ? Math.max(next.month, floor.month) : next.month;
  const lastDay = dayCount(year, month);
  const day = year === floor.year && month === floor.month ? Math.max(Math.min(next.day, lastDay), floor.day) : Math.min(next.day, lastDay);
  if (year !== floor.year || month !== floor.month || day !== floor.day) return { year, month, day, hour: next.hour, minute: next.minute };
  const hour = Math.max(next.hour, floor.hour);
  return { year, month, day, hour, minute: hour === floor.hour ? Math.max(next.minute, floor.minute) : next.minute };
};
export const alarmDate = (date: string, time?: string) => { const [y, m, d] = date.split('-').map(Number); const [hh, mm] = (time ?? '09:00').split(':').map(Number); return new Date(y, m - 1, d, hh || 0, mm || 0); };
export const formatDate = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
