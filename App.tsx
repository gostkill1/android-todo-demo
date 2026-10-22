import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Text, View } from 'react-native';

import { useDailyReminder } from './src/hooks/useDailyReminder';
import { useNotifyPermission } from './src/hooks/useNotifyPermission';
import { useTaskAlarms } from './src/hooks/useTaskAlarms';
import { openCalendarEvent } from './src/lib/calendar';
import { REMINDER_KEY, TAB_ORDER, TODO_KEY, defaultReminder } from './src/lib/constants';
import { alarmDate, clampWheel, dateKey, editFloor, minWheel, pad } from './src/lib/dates';
import { openTaskChannelSettings } from './src/lib/notifications';
import { isRingable, makeSamples } from './src/lib/todos';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { ComposeScreen } from './src/screens/ComposeScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ReminderScreen } from './src/screens/ReminderScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { styles } from './src/styles';
import type { Page, Reminder, Todo, Wheel } from './src/types';

export default function App() {
  const today = dateKey(new Date());
  const [todos, setTodos] = useState<Todo[]>(makeSamples);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSnapshot, setEditSnapshot] = useState<{ text: string; date: string; time?: string; alarm?: boolean } | null>(null);
  const [alarmOn, setAlarmOn] = useState(false);

  const [page, setPage] = useState<Page>('home');
  const [ready, setReady] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today);
  const [month, setMonth] = useState(new Date());
  const [reminder, setReminder] = useState<Reminder>(defaultReminder);
  const [wheel, setWheel] = useState<Wheel>(minWheel);
  const [wheelFloor, setWheelFloor] = useState<Wheel>(minWheel);

  const { granted: canNotify, ensure: ensureNotifyPermission } = useNotifyPermission(ready);
  useTaskAlarms(ready, canNotify, todos);
  const { adoptSchedule, commitReminder } = useDailyReminder(ready, todos, reminder, setReminder);
  const enterCompose = () => { const floor = minWheel(); setWheelFloor(floor); setWheel(floor); setEditingId(null); setEditSnapshot(null); setAlarmOn(false); setPage('compose'); };

  useEffect(() => {
    const load = async () => {
      try {
        const [storedTodos, storedReminder] = await Promise.all([AsyncStorage.getItem(TODO_KEY), AsyncStorage.getItem(REMINDER_KEY)]);
        if (storedTodos) setTodos((JSON.parse(storedTodos) as Todo[]).map((item) => ({ ...item, date: item.date ?? today })));
        if (storedReminder) {
          const parsed = { ...defaultReminder, ...(JSON.parse(storedReminder) as Reminder) };
          const normalised = { ...parsed, hour: pad(Number(parsed.hour) || 0), minute: pad(Number(parsed.minute) || 0) };
          adoptSchedule(normalised.notificationId);
          setReminder(normalised);
        }
      } catch (error) { console.warn('无法读取本地数据：', error); } finally { setReady(true); }
    };
    load();
  }, [today]);
  useEffect(() => { if (ready) AsyncStorage.setItem(TODO_KEY, JSON.stringify(todos)); }, [todos, ready]);
  useEffect(() => { if (ready) AsyncStorage.setItem(REMINDER_KEY, JSON.stringify(reminder)); }, [reminder, ready]);

  // 增删改/勾选/隐藏都只动 todos，到点通知由那个列表上的 effect 整批重排，这里不再逐条取消闹钟。
  const toggleTodo = (id: number) => setTodos((items) => items.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
  const removeTodo = (id: number) => Alert.alert('删除任务', '确定要删除这个任务吗？', [{ text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: () => setTodos((items) => items.filter((item) => item.id !== id)) }]);
  const hideTodo = (id: number) => Alert.alert('隐藏这条待办？', '它不再出现在首页，但依然保留在日历里。', [{ text: '取消', style: 'cancel' }, { text: '隐藏', onPress: () => setTodos((items) => items.map((item) => (item.id === id ? { ...item, hidden: true } : item))) }]);
  const showTodo = (id: number) => setTodos((items) => items.map((item) => (item.id === id ? { ...item, hidden: false } : item)));
  const restore = () => Alert.alert('恢复示例任务', '当前任务会被替换为 3 条示例任务，隐藏标记也会一并清除。', [{ text: '取消', style: 'cancel' }, { text: '恢复', onPress: () => setTodos(makeSamples()) }]);
  const composeDate = dateKey(new Date(wheel.year, wheel.month - 1, wheel.day));
  const composeTime = `${pad(wheel.hour)}:${pad(wheel.minute)}`;

  // 这一条只负责「交给系统日历」。日历用不了或时间已过就把 alarm 关掉，让本应用自己的到点通知接管，不会一条都不响。
  const syncTaskAlarm = async (todo: Todo): Promise<Todo> => {
    const when = alarmDate(todo.date, todo.time);
    if (when.getTime() <= Date.now()) { Alert.alert('时间已经过了', '这条待办的时间早于此刻，日历里安排不了这个点，改由本应用到点响一次。'); return { ...todo, alarm: false }; }
    try {
      await openCalendarEvent(todo.text, when);
      return todo;
    } catch {
      Alert.alert('日历没能打开', '这台机器上的系统日历叫不起来，这条改由本应用在到点时响一次。任务本身已经保存。');
      return { ...todo, alarm: false };
    }
  };

  const saveCompose = async () => {
    const value = draft.trim();
    if (!value) { Alert.alert('还没写内容', '先填上要做什么，再保存。'); return; }
    const existing = editingId == null ? undefined : todos.find((item) => item.id === editingId);
    if (editingId != null && !existing) { leaveCompose(); return; }
    const base: Todo = existing ? { ...existing, text: value, date: composeDate, time: composeTime, alarm: alarmOn } : { id: Date.now(), text: value, done: false, date: composeDate, time: composeTime, alarm: alarmOn };
    // 先落状态再叫日历：日历一盖上来 JS 就被限流，界面得先回到首页
    if (existing) setTodos((items) => items.map((item) => (item.id === base.id ? base : item)));
    else setTodos((items) => [base, ...items]);
    setDraft(''); setEditingId(null); setEditSnapshot(null); setAlarmOn(false); setPage('home');
    if (base.alarm) {
      const settled = await syncTaskAlarm(base);
      if (settled.alarm !== base.alarm) setTodos((items) => items.map((item) => (item.id === settled.id ? { ...item, alarm: false } : item)));
      return;
    }
    // 只有「这条真的会响」才去要权限，避免随便存一条未来的任务也弹授权框
    if (isRingable(base) && !(await ensureNotifyPermission())) Alert.alert('通知没开启', '系统还不允许本应用发通知，这条到点不会响。在系统设置里允许之后，把这条改一下再保存就会排上。');
  };
  const leaveCompose = () => { setDraft(''); setEditingId(null); setEditSnapshot(null); setAlarmOn(false); setPage('home'); };
  const enterEdit = (todo: Todo) => {
    const floor = editFloor();
    const [y, m, d] = todo.date.split('-').map(Number);
    const [hh, mm] = (todo.time ?? '09:00').split(':').map(Number);
    setWheelFloor(floor); setWheel(clampWheel({ year: y, month: m, day: d, hour: hh || 0, minute: mm || 0 }, floor)); setDraft(todo.text); setEditingId(todo.id); setEditSnapshot({ text: todo.text, date: todo.date, time: todo.time, alarm: todo.alarm }); setAlarmOn(!!todo.alarm); setPage('compose');
  };
  const composeDirty = () => {
    if (editingId == null || !editSnapshot) return !!draft.trim() || alarmOn;
    return draft !== editSnapshot.text || composeDate !== editSnapshot.date || composeTime !== (editSnapshot.time ?? '09:00') || alarmOn !== !!editSnapshot.alarm;
  };

  const openSoundSettings = async () => {
    try {
      await openTaskChannelSettings();
    } catch {
      Alert.alert('打不开通知设置', '请到 设置 → 通知与管理 → 应用通知 → 待办清单 里找「任务到点提醒」。');
    }
  };

  const backTarget = (from: Page): Page => from === 'reminder' ? 'settings' : 'home';
  const goBack = () => {
    if (page === 'compose') {
      if (!composeDirty()) { leaveCompose(); return; }
      Alert.alert(editingId == null ? '放弃这条待办？' : '放弃这次修改？', editingId == null ? '已经输入的内容不会被保存。' : '这次的改动不会被保存。', [{ text: '继续编辑', style: 'cancel' }, { text: '放弃', style: 'destructive', onPress: leaveCompose }]);
      return;
    }
    setPage(backTarget(page));
  };

  // 三个平级页面靠底部标签栏和左右滑动切换；新建／定时提醒是覆盖页，不带这套外壳。
  const pageNow = useRef<Page>('home');
  useEffect(() => { pageNow.current = page; });
  const goTab = (next: Page) => { if (TAB_ORDER.includes(next) && next !== pageNow.current) setPage(next); };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (page === 'home') return false;
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [page, draft, wheel, editingId, editSnapshot]);
  if (!ready) return <View style={styles.center}><StatusBar style="dark" /><Text>正在读取你的任务…</Text></View>;

  if (page === 'calendar') return <CalendarScreen todos={todos} today={today} month={month} setMonth={setMonth} selectedDate={selectedDate} setSelectedDate={setSelectedDate} toggleTodo={toggleTodo} showTodo={showTodo} removeTodo={removeTodo} goTab={goTab} />;
  if (page === 'reminder') return <ReminderScreen reminder={reminder} commitReminder={commitReminder} goBack={goBack} />;
  if (page === 'compose') return <ComposeScreen wheel={wheel} wheelFloor={wheelFloor} setWheel={setWheel} draft={draft} setDraft={setDraft} editingId={editingId} alarmOn={alarmOn} setAlarmOn={setAlarmOn} saveCompose={saveCompose} goBack={goBack} />;
  if (page === 'settings') return <SettingsScreen reminder={reminder} setPage={setPage} openSoundSettings={openSoundSettings} restore={restore} goTab={goTab} />;
  return <HomeScreen todos={todos} today={today} canNotify={canNotify} toggleTodo={toggleTodo} removeTodo={removeTodo} hideTodo={hideTodo} enterEdit={enterEdit} enterCompose={enterCompose} goTab={goTab} />;
}
