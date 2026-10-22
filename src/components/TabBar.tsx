import { Pressable, Text, View } from 'react-native';
import { TAB_LABEL, TAB_ORDER } from '../lib/constants';
import type { Page } from '../types';
import { styles } from '../styles';

export const TabIcon = ({ kind, c }: { kind: Page; c: string }) => {
  if (kind === 'calendar') return <View style={[styles.icoCal, { borderColor: c }]}><View style={[styles.icoCalTop, { backgroundColor: c }]} /><View style={[styles.icoPin, { backgroundColor: c, left: 4 }]} /><View style={[styles.icoPin, { backgroundColor: c, right: 4 }]} /></View>;
  if (kind === 'settings') return <View>{[0, 1, 2].map((i) => <View key={i} style={[styles.icoBar, { backgroundColor: c, marginBottom: i === 2 ? 0 : 5 }]} />)}</View>;
  return <View style={[styles.icoDoc, { borderColor: c }]}><View style={[styles.icoLine, { backgroundColor: c }]} /><View style={[styles.icoLine, { backgroundColor: c, marginBottom: 0 }]} /></View>;
};
export const TabBar = ({ current, onPick }: { current: Page; onPick: (next: Page) => void }) => (
  <View style={styles.tabBar}>{TAB_ORDER.map((key) => { const on = key === current; return (
    <Pressable key={key} onPress={() => onPick(key)} style={styles.tabItem}><View style={styles.tabSlot}><TabIcon kind={key} c={on ? '#625BFF' : '#98A2B3'} /></View><Text style={[styles.tabText, on && styles.tabTextOn]}>{TAB_LABEL[key]}</Text></Pressable>
  ); })}</View>
);
