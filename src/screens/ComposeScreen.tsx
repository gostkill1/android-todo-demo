import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Animated, Keyboard, KeyboardAvoidingView, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Header } from '../components/Header';
import { WheelColumn } from '../components/WheelColumn';
import { dayCount, range } from '../lib/dates';
import { screenStyle, styles } from '../styles';
import type { Wheel } from '../types';

export const ComposeScreen = ({ wheel, wheelFloor, setWheel, draft, setDraft, editingId, alarmOn, setAlarmOn, saveCompose, goBack }: { wheel: Wheel; wheelFloor: Wheel; setWheel: (next: Wheel) => void; draft: string; setDraft: (next: string) => void; editingId: number | null; alarmOn: boolean; setAlarmOn: (next: boolean) => void; saveCompose: () => void; goBack: () => void }) => {
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
  const yearOptions = range(wheelFloor.year, wheelFloor.year + 3);
  const monthOptions = range(1, 12);
  const dayOptions = range(1, dayCount(wheel.year, wheel.month));
  const hourOptions = range(0, 23);
  const minuteOptions = range(0, 59);

  return <View style={screenStyle()}><StatusBar style="dark" /><Header title={editingId == null ? '新建待办' : '编辑待办'} onBack={goBack} /><KeyboardAvoidingView style={styles.flex} behavior="padding"><ScrollView style={styles.flex} contentContainerStyle={styles.composeScroll} keyboardShouldPersistTaps="handled"><TextInput value={draft} onChangeText={setDraft} multiline blurOnSubmit={false} placeholder="要做什么？" placeholderTextColor="#8A94A6" style={styles.composeInput} /><View style={styles.wheel}><WheelColumn compact wide width={76} options={yearOptions} value={wheel.year} onChange={(year) => patchWheel({ year })} isRejected={(year) => wheelIsPast({ year })} onRejected={flashPastWarning} onDragStart={Keyboard.dismiss} /><WheelColumn compact width={58} options={monthOptions} value={wheel.month} onChange={(month) => patchWheel({ month })} isRejected={(month) => wheelIsPast({ month })} onRejected={flashPastWarning} onDragStart={Keyboard.dismiss} /><WheelColumn compact width={58} options={dayOptions} value={wheel.day} onChange={(day) => patchWheel({ day })} isRejected={(day) => wheelIsPast({ day })} onRejected={flashPastWarning} onDragStart={Keyboard.dismiss} /><WheelColumn compact width={58} options={hourOptions} value={wheel.hour} onChange={(hour) => patchWheel({ hour })} isRejected={(hour) => wheelIsPast({ hour })} onRejected={flashPastWarning} onDragStart={Keyboard.dismiss} /><WheelColumn compact width={58} options={minuteOptions} value={wheel.minute} onChange={(minute) => patchWheel({ minute })} isRejected={(minute) => wheelIsPast({ minute })} onRejected={flashPastWarning} onDragStart={Keyboard.dismiss} /></View><View style={styles.pastWarnSlot}><Animated.Text style={[styles.pastWarnText, { opacity: pastWarn }]}>不可以新建过去的任务哦！</Animated.Text></View><View style={styles.alarmRow}><View style={styles.rowText}><Text style={styles.cardTitle}>改用系统日历提醒</Text><Text style={styles.hint}>默认由本应用在自己的时间点响一声提醒你。打开这一条就改成交给系统日历：保存后跳到新建日程页，标题和时间都替你填好，你在日历里点右上角 ✓ 才算真的存下，这条不再重复发应用通知；之后完成或删除任务，日历里的日程不会自动删。</Text></View><Switch value={alarmOn} onValueChange={setAlarmOn} trackColor={{ false: '#D0D5DD', true: '#625BFF' }} /></View></ScrollView><Pressable onPress={saveCompose} style={[styles.saveButton, styles.footerButton]}><Text style={styles.saveText}>保存</Text></Pressable></KeyboardAvoidingView></View>;
};
