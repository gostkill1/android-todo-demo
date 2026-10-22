export type Todo = { id: number; text: string; done: boolean; date: string; time?: string; hidden?: boolean; alarm?: boolean };
export type Page = 'home' | 'settings' | 'calendar' | 'reminder' | 'compose';
export type Reminder = { enabled: boolean; hour: string; minute: string; notificationId?: string };
export type Wheel = { year: number; month: number; day: number; hour: number; minute: number };
