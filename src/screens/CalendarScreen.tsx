import type { Dispatch, SetStateAction } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Action } from '../components/Action';
import { Header } from '../components/Header';
import { TabShell } from '../components/TabShell';
import { TodoRow } from '../components/TodoRow';
import { weekdays } from '../lib/constants';
import { dateKey, formatDate } from '../lib/dates';
import { styles } from '../styles';
import type { Page, Todo } from '../types';

export const CalendarScreen = ({ todos, today, month, setMonth, selectedDate, setSelectedDate, toggleTodo, showTodo, removeTodo, goTab }: { todos: Todo[]; today: string; month: Date; setMonth: Dispatch<SetStateAction<Date>>; selectedDate: string; setSelectedDate: (next: string) => void; toggleTodo: (id: number) => void; showTodo: (id: number) => void; removeTodo: (id: number) => void; goTab: (next: Page) => void }) => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const totalDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((first.getDay() + totalDays) / 7) * 7 }, (_, i) => i - first.getDay() + 1);
  const dayTodos = todos.filter((todo) => todo.date === selectedDate);
  return <TabShell current="calendar" onPick={goTab}><ScrollView contentContainerStyle={styles.scroll}><Header title="日历" /><View style={styles.monthBar}><Pressable onPress={() => setMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}><Text style={styles.arrow}>‹</Text></Pressable><Text style={styles.monthTitle}>{month.getFullYear()} 年 {month.getMonth() + 1} 月</Text><Pressable onPress={() => setMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}><Text style={styles.arrow}>›</Text></Pressable></View><View style={styles.calendar}>{weekdays.map((day) => <Text key={day} style={styles.weekday}>{day}</Text>)}{cells.map((day, i) => { if (day < 1 || day > totalDays) return <View key={`blank${i}`} style={styles.dayCell} />; const key = dateKey(new Date(month.getFullYear(), month.getMonth(), day)); const selected = key === selectedDate; const hasTodo = todos.some((todo) => todo.date === key); return <Pressable key={key} onPress={() => setSelectedDate(key)} style={styles.dayCell}><View style={[styles.dayCircle, selected && styles.selectedDay]}><Text style={[styles.dayText, selected && styles.selectedDayText]}>{day}</Text></View>{hasTodo && <View style={[styles.dot, selected && styles.whiteDot]} />}</Pressable>; })}</View><Text style={styles.sectionTitle}>{formatDate(selectedDate)} 的待办</Text>{dayTodos.length ? <View style={styles.list}>{dayTodos.map((todo) => { const late = todo.date < today && !todo.done; return <TodoRow key={todo.id} todo={todo} late={late} timeLabel={todo.time} onToggle={late ? undefined : () => toggleTodo(todo.id)} action={<>{todo.hidden && <Action label="显示" tone="brand" onPress={() => showTodo(todo.id)} />}<Action label="删除" onPress={() => removeTodo(todo.id)} /></>} />; })}</View> : <Text style={styles.empty}>这一天没有待办事项</Text>}</ScrollView></TabShell>;
};
