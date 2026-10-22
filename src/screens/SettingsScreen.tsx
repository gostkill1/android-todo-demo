import type { Dispatch, SetStateAction } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Header } from '../components/Header';
import { TabShell } from '../components/TabShell';
import { styles } from '../styles';
import type { Page, Reminder } from '../types';

export const SettingsScreen = ({ reminder, setPage, openSoundSettings, restore, goTab }: { reminder: Reminder; setPage: Dispatch<SetStateAction<Page>>; openSoundSettings: () => void; restore: () => void; goTab: (next: Page) => void }) => <TabShell current="settings" onPick={goTab}><Header title="设置" /><View style={styles.card}><Pressable onPress={() => setPage('reminder')} style={styles.menu}><View style={styles.rowText}><Text style={styles.cardTitle}>定时提醒</Text><Text style={styles.hint}>每天 {reminder.hour}:{reminder.minute}{reminder.enabled ? '' : '（未开启）'}</Text></View><Text style={styles.chevron}>›</Text></Pressable><Pressable onPress={() => { void openSoundSettings(); }} style={styles.menu}><View style={styles.rowText}><Text style={styles.cardTitle}>到点提醒铃声</Text><Text style={styles.hint}>系统只认它自己音库里的声音，去这里挑一个</Text></View><Text style={styles.chevron}>›</Text></Pressable></View><Text style={styles.dataLabel}>数据</Text><Pressable onPress={restore} style={styles.restore}><Text style={styles.restoreTitle}>恢复示例任务</Text><Text style={styles.restoreHint}>用预设任务替换当前列表</Text></Pressable></TabShell>;
