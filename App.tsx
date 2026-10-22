import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Animated, BackHandler, Easing, Keyboard, KeyboardAvoidingView, NativeModules, PanResponder, Platform, Pressable, ScrollView, StatusBar as NativeStatusBar, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

type Todo = { id: number; text: string; done: boolean; date: string; time?: string; hidden?: boolean; alarm?: boolean };
type Page = 'home' | 'settings' | 'calendar' | 'reminder' | 'compose';
type Reminder = { enabled: boolean; hour: string; minute: string; notificationId?: string };
type Wheel = { year: number; month: number; day: number; hour: number; minute: number };

const TODO_KEY = '@android-todo-demo/todos';
const REMINDER_KEY = '@android-todo-demo/reminder';
const ROW = 40;
const pad = (value: number) => String(value).padStart(2, '0');
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shift = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return dateKey(d); };
const dayCount = (year: number, month: number) => new Date(year, month, 0).getDate();
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const minWheel = (): Wheel => {
  const now = new Date();
  const nine = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0);
  const floor = now > nine ? now : nine;
  return { year: floor.getFullYear(), month: floor.getMonth() + 1, day: floor.getDate(), hour: floor.getHours(), minute: floor.getMinutes() };
};
const editFloor = (): Wheel => { const now = new Date(); return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(), hour: 0, minute: 0 }; };
const clampWheel = (next: Wheel, floor: Wheel): Wheel => {
  const year = Math.max(next.year, floor.year);
  const month = year === floor.year ? Math.max(next.month, floor.month) : next.month;
  const lastDay = dayCount(year, month);
  const day = year === floor.year && month === floor.month ? Math.max(Math.min(next.day, lastDay), floor.day) : Math.min(next.day, lastDay);
  if (year !== floor.year || month !== floor.month || day !== floor.day) return { year, month, day, hour: next.hour, minute: next.minute };
  const hour = Math.max(next.hour, floor.hour);
  return { year, month, day, hour, minute: hour === floor.hour ? Math.max(next.minute, floor.minute) : next.minute };
};
const makeSamples = (): Todo[] => [
  { id: 1, text: '规划安卓 Demo 页面', done: false, date: shift(-2), time: '09:00' },
  { id: 2, text: '在手机上预览应用', done: false, date: shift(0), time: '18:00' },
  { id: 3, text: '记录下一步想法', done: false, date: shift(3), time: '09:00' },
];
// 渠道 id 带 -v2：安卓 8 以后声音绑在渠道上，且**已存在的渠道不允许应用再改它的声音**，所以换音只能换新渠道 id。
const CHANNEL_ID = 'daily-reminders-v2';
const TASK_CHANNEL_ID = 'task-alarms-v2';
const ALARM_REGISTRY_KEY = '@android-todo-demo/task-alarms';
const DING_SOUND = 'android.resource://com.demo.androidtodo/raw/ding';
const alarmDate = (date: string, time?: string) => { const [y, m, d] = date.split('-').map(Number); const [hh, mm] = (time ?? '09:00').split(':').map(Number); return new Date(y, m - 1, d, hh || 0, mm || 0); };
const isRingable = (item: Todo) => !item.done && !item.hidden && !item.alarm && !!item.time && alarmDate(item.date, item.time).getTime() > Date.now();
// 同一分钟的多条合并成一条通知；key 形如 `2026-10-22 13:00`
const alarmGroups = (items: Todo[]) => {
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
type SystemCalendarBridge = { openCreateEvent: (title: string, description: string, beginTime: number, endTime: number) => Promise<boolean> };
const SystemCalendar = NativeModules.SystemCalendar as SystemCalendarBridge | undefined;
// resolve 只代表「创建日程页打开了」：系统界面不回传用户最后点了 ✓ 还是 ✗。
const openCalendarEvent = async (title: string, when: Date) => {
  if (!SystemCalendar) throw new Error('日历模块不在包里');
  const begin = when.getTime();
  await SystemCalendar.openCreateEvent(title, '', begin, begin + 30 * 60 * 1000);
};
const reminderBody = (items: Todo[], day: string) => {
  const open = items.filter((item) => !item.hidden && !item.done && item.date === day).length;
  const late = items.filter((item) => !item.hidden && !item.done && item.date < day).length;
  return open || late ? `今天 ${open} 件待完成${late ? ` · ${late} 件已逾期` : ''}` : undefined;
};
const nextReminderDay = (hour: number, minute: number) => {
  const now = new Date();
  const alreadyFired = now.getHours() > hour || (now.getHours() === hour && now.getMinutes() >= minute);
  return dateKey(alreadyFired ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) : now);
};
const defaultReminder: Reminder = { enabled: false, hour: '09', minute: '00' };
const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
const formatDate = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
const dueLabel = (todo: Todo) => `${Number(todo.date.slice(5, 7))}月${Number(todo.date.slice(8, 10))}日${todo.time ? ` ${todo.time}` : ''}`;
const Header = ({ title, onBack }: { title: string; onBack?: () => void }) => (
  <View style={styles.pageHeader}>{onBack ? <Pressable onPress={onBack} hitSlop={12}><Text style={styles.back}>‹</Text></Pressable> : <View style={{ width: 34 }} />}<Text style={styles.pageTitle}>{title}</Text><View style={{ width: 34 }} /></View>
);
const TAB_ORDER: Page[] = ['home', 'calendar', 'settings'];
const TAB_LABEL: Record<string, string> = { home: '首页', calendar: '日历', settings: '设置' };
const TabIcon = ({ kind, c }: { kind: Page; c: string }) => {
  if (kind === 'calendar') return <View style={[styles.icoCal, { borderColor: c }]}><View style={[styles.icoCalTop, { backgroundColor: c }]} /><View style={[styles.icoPin, { backgroundColor: c, left: 4 }]} /><View style={[styles.icoPin, { backgroundColor: c, right: 4 }]} /></View>;
  if (kind === 'settings') return <View>{[0, 1, 2].map((i) => <View key={i} style={[styles.icoBar, { backgroundColor: c, marginBottom: i === 2 ? 0 : 5 }]} />)}</View>;
  return <View style={[styles.icoDoc, { borderColor: c }]}><View style={[styles.icoLine, { backgroundColor: c }]} /><View style={[styles.icoLine, { backgroundColor: c, marginBottom: 0 }]} /></View>;
};
const TabBar = ({ current, onPick }: { current: Page; onPick: (next: Page) => void }) => (
  <View style={styles.tabBar}>{TAB_ORDER.map((key) => { const on = key === current; return (
    <Pressable key={key} onPress={() => onPick(key)} style={styles.tabItem}><View style={styles.tabSlot}><TabIcon kind={key} c={on ? '#625BFF' : '#98A2B3'} /></View><Text style={[styles.tabText, on && styles.tabTextOn]}>{TAB_LABEL[key]}</Text></Pressable>
  ); })}</View>
);
const Action = ({ label, tone = 'danger', onPress }: { label: string; tone?: 'danger' | 'brand' | 'muted'; onPress: () => void }) => (
  <Pressable onPress={onPress} hitSlop={10} style={styles.action}><Text style={[styles.actionText, tone === 'brand' ? styles.brandText : tone === 'muted' ? styles.mutedActionText : styles.dangerText]}>{label}</Text></Pressable>
);
const TodoRow = ({ todo, late, timeLabel, onToggle, onOpen, action }: { todo: Todo; late?: boolean; timeLabel?: string; onToggle?: () => void; onOpen?: () => void; action?: ReactNode }) => {
  const mark = todo.done ? <Text style={styles.checkMark}>✓</Text> : late ? <Text style={styles.checkMark}>✗</Text> : null;
  const boxStyle = [styles.check, todo.done && styles.checked, late && !todo.done && styles.late];
  const body = <><Text style={[styles.todoText, todo.done && styles.done]} numberOfLines={2}>{todo.text}</Text>{timeLabel ? <Text style={styles.timeLabel}>{timeLabel}{todo.alarm ? ' 📅' : ''}</Text> : null}</>;
  return (
    <View style={styles.todoRow}>
      {onToggle ? <Pressable onPress={onToggle} style={boxStyle}>{mark}</Pressable> : <View style={boxStyle}>{mark}</View>}
      {onOpen ? <Pressable onPress={onOpen} style={styles.todoBody}>{body}</Pressable> : <View style={styles.todoBody}>{body}</View>}
      {action}
    </View>
  );
};
type WheelColumnProps = { options: number[]; value: number; onChange: (next: number) => void; width: number; wide?: boolean; compact?: boolean; isRejected?: (option: number) => boolean; onRejected?: () => void; onDragStart?: () => void };
type WheelDrag = { offset: number; base: number; dragging: boolean };
type WheelLive = { maxIndex: number; options: number[]; value: number; onChange: (next: number) => void; isRejected?: (option: number) => boolean; onRejected?: () => void; onDragStart?: () => void };
const clampOffset = (raw: number, maxIndex: number) => Math.min(0, Math.max(-maxIndex * ROW, raw));
const settleWheel = (drag: WheelDrag, live: WheelLive, shift: Animated.Value, velocity: number, onSettled: () => void) => {
  drag.dragging = false;
  const landed = clampOffset(drag.offset + velocity * 0.04, live.maxIndex);
  const picked = Math.min(live.maxIndex, Math.max(0, Math.round(-landed / ROW)));
  const option = live.options[picked];
  const park = (toValue: number) => {
    drag.offset = toValue;
    Animated.timing(shift, { toValue, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(onSettled);
  };
  if (option === undefined || option === live.value) { park(-picked * ROW); return; }
  if (live.isRejected?.(option)) { park(-Math.min(live.maxIndex, Math.max(0, live.options.indexOf(live.value))) * ROW); live.onRejected?.(); return; }
  park(-picked * ROW);
  live.onChange(option);
};
const WheelColumn = ({ options, value, onChange, width, wide, compact, isRejected, onRejected, onDragStart }: WheelColumnProps) => {
  const maxIndex = Math.max(0, options.length - 1);
  const index = Math.min(maxIndex, Math.max(0, options.indexOf(value)));
  const shift = useRef(new Animated.Value(-index * ROW)).current;
  const open = useRef(new Animated.Value(0)).current;
  const drag = useRef<WheelDrag>({ offset: -index * ROW, base: 0, dragging: false }).current;
  const live = useRef<WheelLive>({ maxIndex, options, value, onChange, isRejected, onRejected, onDragStart }).current;

  useEffect(() => {
    live.maxIndex = maxIndex; live.options = options; live.value = value; live.onChange = onChange; live.isRejected = isRejected; live.onRejected = onRejected; live.onDragStart = onDragStart;
  });
  useEffect(() => {
    if (drag.dragging) return;
    drag.offset = -index * ROW;
    shift.setValue(drag.offset);
  }, [index, drag, shift]);

  // 折叠式滚轮：平时只占一行，手指按住时上下各借出一行，用不透明底板盖住别的内容，松手落定后收回。
  const peep = (next: number, duration: number) => {
    if (!compact) return;
    open.stopAnimation();
    Animated.timing(open, { toValue: next, duration, useNativeDriver: false }).start();
  };
  const fold = () => { if (!drag.dragging) peep(0, 260); };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      drag.dragging = true;
      live.onDragStart?.();
      shift.stopAnimation((value) => { drag.base = value; drag.offset = value; });
      peep(1, 220);
    },
    onPanResponderMove: (_event, state) => {
      drag.offset = clampOffset(drag.base + state.dy, live.maxIndex);
      shift.setValue(drag.offset);
    },
    onPanResponderRelease: (_event, state) => settleWheel(drag, live, shift, state.vy, fold),
    onPanResponderTerminate: () => settleWheel(drag, live, shift, 0, fold),
  })).current;

  const peek = compact ? open : null;
  return (
    <View style={{ width, height: compact ? ROW : ROW * 3, overflow: compact ? 'visible' : 'hidden' }} {...pan.panHandlers}>
      <Animated.View pointerEvents="none" style={[compact ? styles.wheelPeek : styles.wheelFill, peek ? { height: peek.interpolate({ inputRange: [0, 1], outputRange: [ROW, ROW * 3] }), top: peek.interpolate({ inputRange: [0, 1], outputRange: [0, -ROW] }) } : undefined]}>
        <Animated.View pointerEvents="none" style={[peek ? styles.wheelColumn : styles.wheelContent, peek ? { paddingBottom: ROW, paddingTop: peek.interpolate({ inputRange: [0, 1], outputRange: [0, ROW] }) } : undefined, { transform: [{ translateY: shift }] }]}>
          {options.map((option) => <Text key={option} style={[styles.wheelRow, wide && styles.wheelRowWide]}>{pad(option)}</Text>)}
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.wheelBand, peek ? { top: peek.interpolate({ inputRange: [0, 1], outputRange: [0, ROW] }) } : undefined]} />
      </Animated.View>
    </View>
  );
};

export default function App() {
  const today = dateKey(new Date());
  const screenStyle = [styles.container, { paddingTop: (Platform.OS === 'android' ? NativeStatusBar.currentHeight ?? 0 : 0) + 12 }];
  const [todos, setTodos] = useState<Todo[]>(makeSamples);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSnapshot, setEditSnapshot] = useState<{ text: string; date: string; time?: string; alarm?: boolean } | null>(null);
  const [alarmOn, setAlarmOn] = useState(false);
  const [canNotify, setCanNotify] = useState(false);

  const [page, setPage] = useState<Page>('home');
  const [ready, setReady] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today);
  const [month, setMonth] = useState(new Date());
  const [reminder, setReminder] = useState<Reminder>(defaultReminder);
  const [wheel, setWheel] = useState<Wheel>(minWheel);
  const [wheelFloor, setWheelFloor] = useState<Wheel>(minWheel);
  const pastWarn = useRef(new Animated.Value(0)).current;
  const pastWarnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashPastWarning = () => {
    Animated.timing(pastWarn, { toValue: 1, duration: 120, useNativeDriver: false }).start();
    if (pastWarnTimer.current) clearTimeout(pastWarnTimer.current);
    pastWarnTimer.current = setTimeout(() => Animated.timing(pastWarn, { toValue: 0, duration: 220, useNativeDriver: false }).start(), 500);
  };
  useEffect(() => () => { if (pastWarnTimer.current) clearTimeout(pastWarnTimer.current); }, []);
  const wheelTime = (w: Wheel) => new Date(w.year, w.month - 1, w.day, w.hour, w.minute).getTime();
  const fitDay = (w: Wheel): Wheel => { const lastDay = dayCount(w.year, w.month); return w.day > lastDay ? { ...w, day: lastDay } : w; };
  const wheelIsPast = (patch: Partial<Wheel>) => wheelTime(fitDay({ ...wheel, ...patch })) < wheelTime(wheelFloor);
  const patchWheel = (patch: Partial<Wheel>) => { if (wheelIsPast(patch)) { flashPastWarning(); return; } setWheel(fitDay({ ...wheel, ...patch })); };
  const enterCompose = () => { const floor = minWheel(); setWheelFloor(floor); setWheel(floor); setEditingId(null); setEditSnapshot(null); setAlarmOn(false); setPage('compose'); };
  const yearOptions = range(wheelFloor.year, wheelFloor.year + 3);
  const monthOptions = range(1, 12);
  const dayOptions = range(1, dayCount(wheel.year, wheel.month));
  const hourOptions = range(0, 23);
  const minuteOptions = range(0, 59);
  const visible = useMemo(() => todos.filter((item) => !item.hidden), [todos]);
  const overdue = useMemo(() => visible.filter((item) => !item.done && item.date < today).sort((a, b) => a.date.localeCompare(b.date)), [visible, today]);
  const todayTodos = useMemo(() => visible.filter((item) => item.date === today), [visible, today]);
  const upcoming = useMemo(() => visible.filter((item) => !item.done && item.date > today).sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '')), [visible, today]);
  const todayOpen = todayTodos.filter((item) => !item.done).length;

  useEffect(() => {
    const load = async () => {
      try {
        const [storedTodos, storedReminder] = await Promise.all([AsyncStorage.getItem(TODO_KEY), AsyncStorage.getItem(REMINDER_KEY)]);
        if (storedTodos) setTodos((JSON.parse(storedTodos) as Todo[]).map((item) => ({ ...item, date: item.date ?? today })));
        if (storedReminder) {
          const parsed = { ...defaultReminder, ...(JSON.parse(storedReminder) as Reminder) };
          const normalised = { ...parsed, hour: pad(Number(parsed.hour) || 0), minute: pad(Number(parsed.minute) || 0) };
          scheduledIdRef.current = normalised.notificationId;
          setReminder(normalised);
        }
      } catch (error) { console.warn('无法读取本地数据：', error); } finally { setReady(true); }
    };
    load();
  }, [today]);
  useEffect(() => { if (ready) AsyncStorage.setItem(TODO_KEY, JSON.stringify(todos)); }, [todos, ready]);
  useEffect(() => { if (ready) AsyncStorage.setItem(REMINDER_KEY, JSON.stringify(reminder)); }, [reminder, ready]);
  // 通知权限开机读一次：给过就自动把未来的任务排上，没给过就在首页提示一句，不再反复弹授权框。
  useEffect(() => {
    if (!ready) return;
    let ignore = false;
    void (async () => {
      try {
        const Notifications = await import('expo-notifications');
        if (!ignore) setCanNotify((await Notifications.getPermissionsAsync()).granted);
      } catch { /* Expo Go 里没有通知模块 */ }
    })();
    return () => { ignore = true; };
  }, [ready]);

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

  const scheduledIdRef = useRef<string | undefined>(undefined);
  const appliedRef = useRef('');

  const applyReminder = async (base: Reminder, items: Todo[], request: boolean) => {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }) });
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync(CHANNEL_ID, { name: '每日待办提醒', importance: Notifications.AndroidImportance.HIGH, sound: DING_SOUND });
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
      if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync(TASK_CHANNEL_ID, { name: '任务到点提醒', description: '每条待办到自己的时间响一次', importance: Notifications.AndroidImportance.MAX, sound: DING_SOUND, vibrationPattern: [0, 250, 250, 250] });
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

  const ensureNotifyPermission = async () => {
    if (canNotify) return true;
    try {
      const Notifications = await import('expo-notifications');
      const granted = (await Notifications.getPermissionsAsync()).granted || (await Notifications.requestPermissionsAsync()).granted;
      setCanNotify(granted);
      return granted;
    } catch { return false; }
  };

  useEffect(() => {
    if (!ready || !canNotify) return;
    void syncTaskAlarms(todos);
  }, [ready, canNotify, todos]);

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
  const swipe = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_event, state) => Math.abs(state.dx) > 20 && Math.abs(state.dx) > Math.abs(state.dy) * 2,
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_event, state) => {
      const at = TAB_ORDER.indexOf(pageNow.current);
      if (state.dx <= -60) goTab(TAB_ORDER[Math.min(TAB_ORDER.length - 1, at + 1)]);
      else if (state.dx >= 60) goTab(TAB_ORDER[Math.max(0, at - 1)]);
    },
  })).current;
  const tabShell = (body: ReactNode) => (
    <View style={screenStyle} {...swipe.panHandlers}>
      <StatusBar style="dark" />
      <View style={styles.flex}>{body}</View>
      <TabBar current={page} onPick={goTab} />
    </View>
  );
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (page === 'home') return false;
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [page, draft, wheel, editingId, editSnapshot]);
  if (!ready) return <View style={styles.center}><StatusBar style="dark" /><Text>正在读取你的任务…</Text></View>;

  if (page === 'calendar') {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const totalDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells = Array.from({ length: Math.ceil((first.getDay() + totalDays) / 7) * 7 }, (_, i) => i - first.getDay() + 1);
    const dayTodos = todos.filter((todo) => todo.date === selectedDate);
    return tabShell(<ScrollView contentContainerStyle={styles.scroll}><Header title="日历" /><View style={styles.monthBar}><Pressable onPress={() => setMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}><Text style={styles.arrow}>‹</Text></Pressable><Text style={styles.monthTitle}>{month.getFullYear()} 年 {month.getMonth() + 1} 月</Text><Pressable onPress={() => setMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}><Text style={styles.arrow}>›</Text></Pressable></View><View style={styles.calendar}>{weekdays.map((day) => <Text key={day} style={styles.weekday}>{day}</Text>)}{cells.map((day, i) => { if (day < 1 || day > totalDays) return <View key={`blank${i}`} style={styles.dayCell} />; const key = dateKey(new Date(month.getFullYear(), month.getMonth(), day)); const selected = key === selectedDate; const hasTodo = todos.some((todo) => todo.date === key); return <Pressable key={key} onPress={() => setSelectedDate(key)} style={styles.dayCell}><View style={[styles.dayCircle, selected && styles.selectedDay]}><Text style={[styles.dayText, selected && styles.selectedDayText]}>{day}</Text></View>{hasTodo && <View style={[styles.dot, selected && styles.whiteDot]} />}</Pressable>; })}</View><Text style={styles.sectionTitle}>{formatDate(selectedDate)} 的待办</Text>{dayTodos.length ? <View style={styles.list}>{dayTodos.map((todo) => { const late = todo.date < today && !todo.done; return <TodoRow key={todo.id} todo={todo} late={late} timeLabel={todo.time} onToggle={late ? undefined : () => toggleTodo(todo.id)} action={<>{todo.hidden && <Action label="显示" tone="brand" onPress={() => showTodo(todo.id)} />}<Action label="删除" onPress={() => removeTodo(todo.id)} /></>} />; })}</View> : <Text style={styles.empty}>这一天没有待办事项</Text>}</ScrollView>);
  }
  if (page === 'reminder') return <View style={screenStyle}><StatusBar style="dark" /><Header title="定时提醒" onBack={goBack} /><View style={styles.card}><View style={styles.row}><View style={styles.rowText}><Text style={styles.cardTitle}>每日提醒</Text><Text style={styles.hint}>拨动开关立刻生效，不用保存。到点会推送一条今天的待办汇总。</Text></View><Switch value={reminder.enabled} onValueChange={(enabled) => void commitReminder({ ...reminder, enabled })} trackColor={{ false: '#D0D5DD', true: '#625BFF' }} /></View><View style={styles.line} /><Text style={styles.cardTitle}>提醒时间 {reminder.hour}:{reminder.minute}（24 小时制）</Text><View style={styles.wheel}><WheelColumn width={76} options={range(0, 23)} value={Number(reminder.hour)} onChange={(hour) => void commitReminder({ ...reminder, hour: pad(hour) })} /><Text style={styles.colon}>:</Text><WheelColumn width={76} options={range(0, 59)} value={Number(reminder.minute)} onChange={(minute) => void commitReminder({ ...reminder, minute: pad(minute) })} /></View><Text style={styles.hint}>上下滚动数字来调整小时和分钟，松手就生效。</Text></View></View>;
  if (page === 'compose') return <View style={screenStyle}><StatusBar style="dark" /><Header title={editingId == null ? '新建待办' : '编辑待办'} onBack={goBack} /><KeyboardAvoidingView style={styles.flex} behavior="padding"><ScrollView style={styles.flex} contentContainerStyle={styles.composeScroll} keyboardShouldPersistTaps="handled"><TextInput value={draft} onChangeText={setDraft} multiline blurOnSubmit={false} placeholder="要做什么？" placeholderTextColor="#8A94A6" style={styles.composeInput} /><View style={styles.wheel}><WheelColumn compact wide width={76} options={yearOptions} value={wheel.year} onChange={(year) => patchWheel({ year })} isRejected={(year) => wheelIsPast({ year })} onRejected={flashPastWarning} onDragStart={Keyboard.dismiss} /><WheelColumn compact width={58} options={monthOptions} value={wheel.month} onChange={(month) => patchWheel({ month })} isRejected={(month) => wheelIsPast({ month })} onRejected={flashPastWarning} onDragStart={Keyboard.dismiss} /><WheelColumn compact width={58} options={dayOptions} value={wheel.day} onChange={(day) => patchWheel({ day })} isRejected={(day) => wheelIsPast({ day })} onRejected={flashPastWarning} onDragStart={Keyboard.dismiss} /><WheelColumn compact width={58} options={hourOptions} value={wheel.hour} onChange={(hour) => patchWheel({ hour })} isRejected={(hour) => wheelIsPast({ hour })} onRejected={flashPastWarning} onDragStart={Keyboard.dismiss} /><WheelColumn compact width={58} options={minuteOptions} value={wheel.minute} onChange={(minute) => patchWheel({ minute })} isRejected={(minute) => wheelIsPast({ minute })} onRejected={flashPastWarning} onDragStart={Keyboard.dismiss} /></View><View style={styles.pastWarnSlot}><Animated.Text style={[styles.pastWarnText, { opacity: pastWarn }]}>不可以新建过去的任务哦！</Animated.Text></View><View style={styles.alarmRow}><View style={styles.rowText}><Text style={styles.cardTitle}>改用系统日历提醒</Text><Text style={styles.hint}>默认由本应用在自己的时间点响一声提醒你。打开这一条就改成交给系统日历：保存后跳到新建日程页，标题和时间都替你填好，你在日历里点右上角 ✓ 才算真的存下，这条不再重复发应用通知；之后完成或删除任务，日历里的日程不会自动删。</Text></View><Switch value={alarmOn} onValueChange={setAlarmOn} trackColor={{ false: '#D0D5DD', true: '#625BFF' }} /></View></ScrollView><Pressable onPress={saveCompose} style={[styles.saveButton, styles.footerButton]}><Text style={styles.saveText}>保存</Text></Pressable></KeyboardAvoidingView></View>;
  if (page === 'settings') return tabShell(<><Header title="设置" /><View style={styles.card}><Pressable onPress={() => setPage('reminder')} style={styles.menu}><View style={styles.rowText}><Text style={styles.cardTitle}>定时提醒</Text><Text style={styles.hint}>每天 {reminder.hour}:{reminder.minute}{reminder.enabled ? '' : '（未开启）'}</Text></View><Text style={styles.chevron}>›</Text></Pressable></View><Text style={styles.dataLabel}>数据</Text><Pressable onPress={restore} style={styles.restore}><Text style={styles.restoreTitle}>恢复示例任务</Text><Text style={styles.restoreHint}>用预设任务替换当前列表</Text></Pressable></>);
  return tabShell(<>
    <View style={styles.header}><View><Text style={styles.title}>待办清单</Text><Text style={styles.subtitle}>{overdue.length ? `${overdue.length} 件已逾期 · ` : ''}今天 {todayOpen} 件待完成{!canNotify && todos.some(isRingable) ? '（通知没开启，到点不会响）' : ''}</Text></View></View>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {overdue.length > 0 && <><Text style={styles.sectionTitle}>逾期</Text><View style={styles.list}>{overdue.map((todo) => <TodoRow key={todo.id} todo={todo} late timeLabel={dueLabel(todo)} action={<Action label="隐藏" tone="muted" onPress={() => hideTodo(todo.id)} />} />)}</View></>}
        <Text style={styles.sectionTitle}>今天</Text>
        {todayTodos.length ? <View style={styles.list}>{todayTodos.map((todo) => <TodoRow key={todo.id} todo={todo} late={todo.date < today && !todo.done} timeLabel={todo.time} onToggle={() => toggleTodo(todo.id)} onOpen={() => enterEdit(todo)} action={<Action label="删除" onPress={() => removeTodo(todo.id)} />} />)}</View> : <Text style={styles.empty}>今天没有安排，点右下角「+」加一件。</Text>}
        {upcoming.length > 0 && <><Text style={styles.sectionTitle}>未来</Text><View style={styles.list}>{upcoming.map((todo) => <TodoRow key={todo.id} todo={todo} timeLabel={dueLabel(todo)} onToggle={() => toggleTodo(todo.id)} onOpen={() => enterEdit(todo)} action={<Action label="删除" onPress={() => removeTodo(todo.id)} />} />)}</View></>}
      </ScrollView>
      <Pressable onPress={enterCompose} style={styles.fab}><Text style={styles.fabText}>+</Text></Pressable>
  </>);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FC', paddingHorizontal: 20, paddingTop: 24 }, center: { alignItems: 'center', flex: 1, justifyContent: 'center' }, header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 20 }, title: { color: '#172033', fontSize: 34, fontWeight: '800', marginTop: 6 }, subtitle: { color: '#667085', fontSize: 15, marginTop: 6 }, list: { gap: 11 }, todoRow: { alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, flexDirection: 'row', minHeight: 68, paddingHorizontal: 16 }, todoBody: { flex: 1, marginRight: 10 }, timeLabel: { color: '#8A94A6', fontSize: 12, marginTop: 3 }, check: { alignItems: 'center', borderColor: '#C7CEDA', borderRadius: 12, borderWidth: 2, height: 24, justifyContent: 'center', marginRight: 13, width: 24 }, checked: { backgroundColor: '#3DBF8A', borderColor: '#3DBF8A' }, late: { backgroundColor: '#F0B429', borderColor: '#F0B429' }, checkMark: { color: '#FFF', fontWeight: '800' }, todoText: { color: '#263247', fontSize: 16 }, done: { color: '#98A2B3', textDecorationLine: 'line-through' }, action: { paddingLeft: 6, paddingVertical: 8 }, actionText: { fontSize: 13, fontWeight: '700' }, dangerText: { color: '#E05263' }, brandText: { color: '#625BFF' }, mutedActionText: { color: '#7A8497' }, pageHeader: { alignItems: 'center', flexDirection: 'row', height: 68, justifyContent: 'space-between' }, back: { color: '#625BFF', fontSize: 44, fontWeight: '300', width: 34 }, pageTitle: { color: '#172033', fontSize: 20, fontWeight: '800' }, card: { backgroundColor: '#FFF', borderRadius: 18, padding: 16 }, row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 58 }, menu: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 72 }, cardTitle: { color: '#263247', fontSize: 16, fontWeight: '700' }, hint: { color: '#7A8497', fontSize: 13, marginTop: 5 }, line: { backgroundColor: '#EAECF0', height: 1, marginVertical: 10 }, chevron: { color: '#98A2B3', fontSize: 30 }, dataLabel: { color: '#667085', fontSize: 13, fontWeight: '700', letterSpacing: 1, marginBottom: 10, marginTop: 28 }, restore: { backgroundColor: '#FFF1F2', borderRadius: 16, padding: 17 }, restoreTitle: { color: '#D92D4C', fontSize: 16, fontWeight: '700' }, restoreHint: { color: '#9B5F6A', fontSize: 13, marginTop: 5 }, composeInput: { backgroundColor: '#FFF', borderRadius: 14, color: '#172033', fontSize: 16, marginBottom: 22, minHeight: 162, paddingHorizontal: 16, paddingVertical: 14, textAlignVertical: 'top' }, colon: { fontSize: 25, marginHorizontal: 7 }, saveText: { color: '#FFF', fontWeight: '700' }, saveButton: { alignItems: 'center', backgroundColor: '#625BFF', borderRadius: 16, height: 56, justifyContent: 'center', marginTop: 22 }, scroll: { paddingBottom: 110 }, composeScroll: { paddingBottom: 24 }, alarmRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }, rowText: { flex: 1, marginRight: 12 }, footerButton: { marginBottom: 26, marginTop: 14 }, monthBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }, arrow: { color: '#625BFF', fontSize: 32, paddingHorizontal: 8 }, monthTitle: { color: '#172033', fontSize: 18, fontWeight: '800' }, calendar: { backgroundColor: '#FFF', borderRadius: 18, flexDirection: 'row', flexWrap: 'wrap', padding: 12 }, weekday: { color: '#98A2B3', fontSize: 12, fontWeight: '700', paddingBottom: 10, textAlign: 'center', width: '14.285%' }, dayCell: { alignItems: 'center', height: 48, width: '14.285%' }, dayCircle: { alignItems: 'center', borderRadius: 16, height: 32, justifyContent: 'center', width: 32 }, dayText: { color: '#344054' }, selectedDay: { backgroundColor: '#625BFF' }, selectedDayText: { color: '#FFF', fontWeight: '800' }, dot: { backgroundColor: '#E05263', borderRadius: 3, height: 6, marginTop: 2, width: 6 }, whiteDot: { backgroundColor: '#FFF' }, sectionTitle: { color: '#172033', fontSize: 17, fontWeight: '800', marginBottom: 12, marginTop: 20 }, empty: { color: '#98A2B3', paddingVertical: 18 }, flex: { flex: 1 }, wheel: { alignItems: 'center', elevation: 8, flexDirection: 'row', justifyContent: 'center', marginVertical: 14 }, pastWarnSlot: { alignItems: 'center', height: 20, justifyContent: 'flex-start', marginTop: -8 }, pastWarnText: { color: '#E05263', fontSize: 13, fontWeight: '600' }, wheelContent: { flexShrink: 0, paddingVertical: ROW }, wheelRow: { color: '#344054', fontSize: 18, fontWeight: '600', height: ROW, lineHeight: ROW, textAlign: 'center' }, wheelRowWide: { fontSize: 17 }, wheelBand: { backgroundColor: 'rgba(98, 91, 255, 0.10)', borderRadius: 10, height: ROW, left: 0, position: 'absolute', right: 0, top: ROW }, wheelColumn: { flexShrink: 0 }, wheelFill: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }, wheelPeek: { backgroundColor: '#F7F8FC', borderRadius: 12, elevation: 10, left: 0, overflow: 'hidden', position: 'absolute', right: 0, zIndex: 10 }, fab: { alignItems: 'center', backgroundColor: '#625BFF', borderRadius: 29, bottom: 34, elevation: 6, height: 58, justifyContent: 'center', position: 'absolute', right: 24, shadowColor: '#172033', shadowOffset: { height: 6, width: 0 }, shadowOpacity: 0.22, shadowRadius: 12, width: 58 }, fabText: { color: '#FFF', fontSize: 30, fontWeight: '300' }, tabBar: { backgroundColor: '#FFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, elevation: 16, flexDirection: 'row', marginHorizontal: -20, paddingBottom: 22, paddingTop: 12 }, tabItem: { alignItems: 'center', flex: 1, justifyContent: 'flex-start' }, tabSlot: { alignItems: 'center', height: 30, justifyContent: 'center', width: 26 }, tabText: { color: '#98A2B3', fontSize: 11, marginTop: 4 }, tabTextOn: { color: '#625BFF', fontWeight: '700' }, icoCal: { borderRadius: 5, borderWidth: 2, height: 20, marginTop: 8, width: 22 }, icoCalTop: { borderRadius: 2, height: 4, left: 2, position: 'absolute', right: 2, top: 2 }, icoPin: { borderRadius: 1, height: 7, position: 'absolute', top: -7, width: 2 }, icoBar: { borderRadius: 1, height: 2, width: 21 }, icoDoc: { alignItems: 'center', borderRadius: 5, borderWidth: 2, height: 23, justifyContent: 'center', marginTop: 5, width: 20 }, icoLine: { borderRadius: 1, height: 2, marginBottom: 4, width: 9 },
});
