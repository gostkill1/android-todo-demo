import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Action } from '../components/Action';
import { TabShell } from '../components/TabShell';
import { TodoRow } from '../components/TodoRow';
import { dueLabel, isRingable } from '../lib/todos';
import { styles } from '../styles';
import type { Page, Todo } from '../types';

export const HomeScreen = ({ todos, today, canNotify, toggleTodo, removeTodo, hideTodo, enterEdit, enterCompose, goTab }: { todos: Todo[]; today: string; canNotify: boolean; toggleTodo: (id: number) => void; removeTodo: (id: number) => void; hideTodo: (id: number) => void; enterEdit: (todo: Todo) => void; enterCompose: () => void; goTab: (next: Page) => void }) => {
  const visible = useMemo(() => todos.filter((item) => !item.hidden), [todos]);
  const overdue = useMemo(() => visible.filter((item) => !item.done && item.date < today).sort((a, b) => a.date.localeCompare(b.date)), [visible, today]);
  const todayTodos = useMemo(() => visible.filter((item) => item.date === today), [visible, today]);
  const upcoming = useMemo(() => visible.filter((item) => !item.done && item.date > today).sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '')), [visible, today]);
  const todayOpen = todayTodos.filter((item) => !item.done).length;

  return <TabShell current="home" onPick={goTab}>
    <View style={styles.header}><View><Text style={styles.title}>待办清单</Text><Text style={styles.subtitle}>{overdue.length ? `${overdue.length} 件已逾期 · ` : ''}今天 {todayOpen} 件待完成{!canNotify && todos.some(isRingable) ? '（通知没开启，到点不会响）' : ''}</Text></View></View>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {overdue.length > 0 && <><Text style={styles.sectionTitle}>逾期</Text><View style={styles.list}>{overdue.map((todo) => <TodoRow key={todo.id} todo={todo} late timeLabel={dueLabel(todo)} action={<Action label="隐藏" tone="muted" onPress={() => hideTodo(todo.id)} />} />)}</View></>}
        <Text style={styles.sectionTitle}>今天</Text>
        {todayTodos.length ? <View style={styles.list}>{todayTodos.map((todo) => <TodoRow key={todo.id} todo={todo} late={todo.date < today && !todo.done} timeLabel={todo.time} onToggle={() => toggleTodo(todo.id)} onOpen={() => enterEdit(todo)} action={<Action label="删除" onPress={() => removeTodo(todo.id)} />} />)}</View> : <Text style={styles.empty}>今天没有安排，点右下角「+」加一件。</Text>}
        {upcoming.length > 0 && <><Text style={styles.sectionTitle}>未来</Text><View style={styles.list}>{upcoming.map((todo) => <TodoRow key={todo.id} todo={todo} timeLabel={dueLabel(todo)} onToggle={() => toggleTodo(todo.id)} onOpen={() => enterEdit(todo)} action={<Action label="删除" onPress={() => removeTodo(todo.id)} />} />)}</View></>}
      </ScrollView>
      <Pressable onPress={enterCompose} style={styles.fab}><Text style={styles.fabText}>+</Text></Pressable>
  </TabShell>;
};
