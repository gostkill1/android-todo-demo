import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Todo } from '../types';
import { styles } from '../styles';

export const TodoRow = ({ todo, late, timeLabel, onToggle, onOpen, action }: { todo: Todo; late?: boolean; timeLabel?: string; onToggle?: () => void; onOpen?: () => void; action?: ReactNode }) => {
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
