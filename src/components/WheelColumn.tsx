import { useEffect, useRef } from 'react';
import { Animated, Easing, PanResponder, Text, View } from 'react-native';
import { ROW } from '../lib/constants';
import { pad } from '../lib/dates';
import { styles } from '../styles';

export type WheelColumnProps = { options: number[]; value: number; onChange: (next: number) => void; width: number; wide?: boolean; compact?: boolean; isRejected?: (option: number) => boolean; onRejected?: () => void; onDragStart?: () => void };
export type WheelDrag = { offset: number; base: number; dragging: boolean };
export type WheelLive = { maxIndex: number; options: number[]; value: number; onChange: (next: number) => void; isRejected?: (option: number) => boolean; onRejected?: () => void; onDragStart?: () => void };
export const clampOffset = (raw: number, maxIndex: number) => Math.min(0, Math.max(-maxIndex * ROW, raw));
export const settleWheel = (drag: WheelDrag, live: WheelLive, shift: Animated.Value, velocity: number, onSettled: () => void) => {
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
export const WheelColumn = ({ options, value, onChange, width, wide, compact, isRejected, onRejected, onDragStart }: WheelColumnProps) => {
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
