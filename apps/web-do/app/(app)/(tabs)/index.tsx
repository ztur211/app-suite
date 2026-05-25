import { useEffect, useMemo, useState } from 'react';
import { View, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Heading, Button, Card, TextInput, tokens } from '@things/design-system';
import { useAuth } from '../../../store/auth.store';
import { useTasks } from '../../../store/tasks.store';
import type { Task } from '../../../lib/types';

const newTaskSchema = z.object({
  title: z.string().trim().min(1, 'Enter a task'),
});

type NewTaskForm = z.infer<typeof newTaskSchema>;

type Filter = 'today' | 'upcoming' | 'done';

function filterTasks(tasks: Task[], filter: Filter): Task[] {
  if (filter === 'done') return tasks.filter((t) => t.completed);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return tasks.filter((t) => {
    if (t.completed) return false;
    if (!t.dueAt) return filter === 'today';
    const dueAt = new Date(t.dueAt);
    if (filter === 'today') return dueAt <= endOfToday;
    return dueAt > endOfToday;
  });
}

const filterLabels: Record<Filter, string> = {
  today: 'Today',
  upcoming: 'Upcoming',
  done: 'Done',
};

export default function Tasks() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { tasks, loading, error, refresh, create, update, remove } = useTasks();
  const [filter, setFilter] = useState<Filter>('today');

  const { control, handleSubmit, reset } = useForm<NewTaskForm>({
    resolver: zodResolver(newTaskSchema),
    defaultValues: { title: '' },
  });

  useEffect(() => {
    refresh();
  }, [refresh]);

  const visible = useMemo(() => filterTasks(tasks, filter), [tasks, filter]);

  const add = handleSubmit(async ({ title }) => {
    await create(title);
    reset({ title: '' });
  });

  const toggle = (t: Task) => update(t.id, { completed: !t.completed });

  return (
    <View style={{ flex: 1, padding: tokens.space[6], gap: tokens.space[4] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Heading level={1}>Tasks</Heading>
        <Pressable onPress={signOut} testID="sign-out">
          <Heading level={4}>Sign out</Heading>
        </Pressable>
      </View>
      <Heading level={4}>{user?.email}</Heading>

      <Card>
        <View style={{ flexDirection: 'row', gap: tokens.space[2], alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Controller
              control={control}
              name="title"
              render={({ field, fieldState }) => (
                <TextInput
                  placeholder="What needs to get done?"
                  value={field.value}
                  onChangeText={field.onChange}
                  onSubmitEditing={add}
                  error={fieldState.error?.message}
                  testID="task-input"
                />
              )}
            />
          </View>
          <Button label="Add" onPress={add} variant="primary" testID="task-add-btn" />
        </View>
      </Card>

      <View
        style={{ flexDirection: 'row', gap: tokens.space[2] }}
        accessibilityRole="tablist"
        testID="filter-tabs"
      >
        {(Object.keys(filterLabels) as Filter[]).map((key) => (
          <Pressable
            key={key}
            onPress={() => setFilter(key)}
            testID={`tab-${key}`}
            style={{
              paddingVertical: tokens.space[2],
              paddingHorizontal: tokens.space[4],
              borderRadius: tokens.radius.full,
              backgroundColor:
                filter === key ? tokens.colors.apps.do : tokens.colors.surface.sunken,
            }}
          >
            <Heading level={4}>{filterLabels[key]}</Heading>
          </Pressable>
        ))}
      </View>

      {error ? (
        <Card testID="list-error">
          <Heading level={4}>{error}</Heading>
        </Card>
      ) : null}

      {loading ? (
        <ActivityIndicator color={tokens.colors.apps.do} testID="list-loading" />
      ) : visible.length === 0 && !error ? (
        <View testID="empty-state" style={{ padding: tokens.space[6], alignItems: 'center' }}>
          <Heading level={3}>{emptyTitle(filter)}</Heading>
          <Heading level={4}>{emptySubtitle(filter)}</Heading>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(t) => t.id}
          ItemSeparatorComponent={() => <View style={{ height: tokens.space[2] }} />}
          renderItem={({ item }) => (
            <Card
              pressable
              onPress={() => router.push(`/task/${item.id}`)}
              testID={`task-card-${item.id}`}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: tokens.space[3],
                    flex: 1,
                  }}
                >
                  <Pressable onPress={() => toggle(item)} testID={`checkbox-${item.id}`}>
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        borderWidth: 2,
                        borderColor: item.completed
                          ? tokens.colors.apps.do
                          : tokens.colors.ink[300],
                        backgroundColor: item.completed ? tokens.colors.apps.do : 'transparent',
                      }}
                    />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Heading level={4}>{item.title}</Heading>
                    {item.dueAt ? <Heading level={4}>{formatDueAt(item.dueAt)}</Heading> : null}
                  </View>
                </View>
                <Pressable onPress={() => remove(item.id)} testID={`delete-${item.id}`}>
                  <Heading level={4}>×</Heading>
                </Pressable>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

function emptyTitle(filter: Filter): string {
  if (filter === 'done') return 'Nothing finished yet';
  if (filter === 'upcoming') return 'Nothing on the horizon';
  return 'Nothing to do';
}

function emptySubtitle(filter: Filter): string {
  if (filter === 'done') return 'Completed tasks will show up here';
  if (filter === 'upcoming') return 'Schedule a task with a future due date';
  return 'Add your first task above';
}

function formatDueAt(iso: string): string {
  const d = new Date(iso);
  return `Due ${d.toLocaleDateString()}`;
}
