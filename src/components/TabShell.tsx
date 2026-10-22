import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, type ReactNode } from 'react';
import { PanResponder, View } from 'react-native';
import { TAB_ORDER } from '../lib/constants';
import { screenStyle, styles } from '../styles';
import type { Page } from '../types';
import { TabBar } from './TabBar';

export const TabShell = ({ current, onPick, children }: { current: Page; onPick: (next: Page) => void; children: ReactNode }) => {
  const pageNow = useRef<Page>(current);
  useEffect(() => { pageNow.current = current; });
  const swipe = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_event, state) => Math.abs(state.dx) > 20 && Math.abs(state.dx) > Math.abs(state.dy) * 2,
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_event, state) => {
      const at = TAB_ORDER.indexOf(pageNow.current);
      if (state.dx <= -60) onPick(TAB_ORDER[Math.min(TAB_ORDER.length - 1, at + 1)]);
      else if (state.dx >= 60) onPick(TAB_ORDER[Math.max(0, at - 1)]);
    },
  })).current;
  return (
    <View style={screenStyle()} {...swipe.panHandlers}>
      <StatusBar style="dark" />
      <View style={styles.flex}>{children}</View>
      <TabBar current={current} onPick={onPick} />
    </View>
  );
};
