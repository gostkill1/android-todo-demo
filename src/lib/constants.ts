import type { Page, Reminder } from '../types';

export const TODO_KEY = '@android-todo-demo/todos';
export const REMINDER_KEY = '@android-todo-demo/reminder';
export const ROW = 40;
export const ALARM_REGISTRY_KEY = '@android-todo-demo/task-alarms';
export const defaultReminder: Reminder = { enabled: false, hour: '09', minute: '00' };
export const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
export const TAB_ORDER: Page[] = ['home', 'calendar', 'settings'];
export const TAB_LABEL: Record<string, string> = { home: '首页', calendar: '日历', settings: '设置' };
