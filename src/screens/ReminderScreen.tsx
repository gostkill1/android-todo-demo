import { StatusBar } from 'expo-status-bar';
import { Switch, Text, View } from 'react-native';
import { Header } from '../components/Header';
import { WheelColumn } from '../components/WheelColumn';
import { pad, range } from '../lib/dates';
import { screenStyle, styles } from '../styles';
import type { Reminder } from '../types';

export const ReminderScreen = ({ reminder, commitReminder, goBack }: { reminder: Reminder; commitReminder: (next: Reminder) => void; goBack: () => void }) => <View style={screenStyle()}><StatusBar style="dark" /><Header title="定时提醒" onBack={goBack} /><View style={styles.card}><View style={styles.row}><View style={styles.rowText}><Text style={styles.cardTitle}>每日提醒</Text><Text style={styles.hint}>拨动开关立刻生效，不用保存。到点会推送一条今天的待办汇总。</Text></View><Switch value={reminder.enabled} onValueChange={(enabled) => void commitReminder({ ...reminder, enabled })} trackColor={{ false: '#D0D5DD', true: '#625BFF' }} /></View><View style={styles.line} /><Text style={styles.cardTitle}>提醒时间 {reminder.hour}:{reminder.minute}（24 小时制）</Text><View style={styles.wheel}><WheelColumn width={76} options={range(0, 23)} value={Number(reminder.hour)} onChange={(hour) => void commitReminder({ ...reminder, hour: pad(hour) })} /><Text style={styles.colon}>:</Text><WheelColumn width={76} options={range(0, 59)} value={Number(reminder.minute)} onChange={(minute) => void commitReminder({ ...reminder, minute: pad(minute) })} /></View><Text style={styles.hint}>上下滚动数字来调整小时和分钟，松手就生效。</Text></View></View>;
