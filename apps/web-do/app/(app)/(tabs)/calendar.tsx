import { useEffect, useMemo, useState } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Heading, Card, tokens } from '@things/design-system';
import { useTasks } from '../../../store/tasks.store';
import type { Task } from '../../../lib/types';

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function generateMonthGrid(year: number, month: number): Date[] {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  const gridEnd = new Date(monthEnd);
  gridEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));
  const days: Date[] = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function tasksOnDay(tasks: Task[], day: Date): Task[] {
  return tasks.filter((t) => {
    if (!t.dueAt) return false;
    return isSameDay(new Date(t.dueAt), day);
  });
}

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Calendar() {
  const router = useRouter();
  const { tasks, refresh } = useTasks();
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date>(() => startOfDay(new Date()));

  useEffect(() => {
    refresh();
  }, [refresh]);

  const grid = useMemo(() => generateMonthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);

  const selectedTasks = useMemo(() => tasksOnDay(tasks, selectedDay), [tasks, selectedDay]);
  const today = startOfDay(new Date());

  const prevMonth = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const nextMonth = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));

  return (
    <ScrollView contentContainerStyle={{ padding: tokens.space[6], gap: tokens.space[4] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pressable onPress={prevMonth} testID="cal-prev">
          <Heading level={2}>‹</Heading>
        </Pressable>
        <Heading level={2} testID="cal-month-label">
          {monthNames[cursor.getMonth()]} {cursor.getFullYear()}
        </Heading>
        <Pressable onPress={nextMonth} testID="cal-next">
          <Heading level={2}>›</Heading>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row' }}>
        {dayNames.map((n) => (
          <View key={n} style={{ flex: 1, alignItems: 'center' }}>
            <Heading level={4}>{n}</Heading>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {grid.map((day) => {
          const inMonth = day.getMonth() === cursor.getMonth();
          const isToday = isSameDay(day, today);
          const isSelected = isSameDay(day, selectedDay);
          const tasksHere = tasksOnDay(tasks, day);
          const key = isoDay(day);

          return (
            <Pressable
              key={key}
              onPress={() => setSelectedDay(day)}
              testID={`cal-day-${key}`}
              style={{
                width: '14.2857%',
                aspectRatio: 1,
                padding: tokens.space[1],
                opacity: inMonth ? 1 : 0.4,
              }}
            >
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: tokens.radius.md,
                  backgroundColor: isSelected
                    ? tokens.colors.apps.do
                    : isToday
                      ? tokens.colors.surface.sunken
                      : 'transparent',
                }}
              >
                <Heading level={4}>{day.getDate()}</Heading>
                {tasksHere.length > 0 ? (
                  <View
                    testID={`cal-dot-${key}`}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: isSelected
                        ? tokens.colors.surface.canvas
                        : tokens.colors.apps.do,
                      marginTop: 2,
                    }}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: tokens.space[2] }}>
        <Heading level={3} testID="cal-selected-label">
          {selectedDay.toLocaleDateString()}
        </Heading>
        {selectedTasks.length === 0 ? (
          <View testID="day-empty">
            <Heading level={4}>No tasks for this day</Heading>
          </View>
        ) : (
          selectedTasks.map((t) => (
            <Card
              key={t.id}
              pressable
              onPress={() => router.push(`/task/${t.id}`)}
              testID={`day-task-${t.id}`}
            >
              <Heading level={4}>{t.title}</Heading>
            </Card>
          ))
        )}
      </View>
    </ScrollView>
  );
}
