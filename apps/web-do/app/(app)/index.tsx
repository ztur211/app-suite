import { useEffect, useState, useCallback } from 'react';
import { View, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Heading, Button, Card, TextInput, tokens } from '@things/design-system';
import { useAuth } from '../../store/auth.store';
import { tasksApi } from '../../lib/api';
import type { Task } from '../../lib/types';

const newTaskSchema = z.object({
  title: z.string().trim().min(1, 'Enter a task'),
});

type NewTaskForm = z.infer<typeof newTaskSchema>;

export default function Today() {
  const { signOut, user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const { control, handleSubmit, reset } = useForm<NewTaskForm>({
    resolver: zodResolver(newTaskSchema),
    defaultValues: { title: '' },
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      setTasks(await tasksApi.list());
    } catch (e) {
      setListError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = handleSubmit(async ({ title }) => {
    const t = await tasksApi.create(title);
    setTasks((prev) => [t, ...prev]);
    reset({ title: '' });
  });

  const toggle = async (t: Task) => {
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, completed: !x.completed } : x)));
    await tasksApi.setCompleted(t.id, !t.completed);
  };

  const remove = async (t: Task) => {
    setTasks((prev) => prev.filter((x) => x.id !== t.id));
    await tasksApi.remove(t.id);
  };

  return (
    <View style={{ flex: 1, padding: tokens.space[6], gap: tokens.space[4] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Heading level={1}>Today</Heading>
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

      {listError ? (
        <Card testID="list-error">
          <Heading level={4}>{listError}</Heading>
        </Card>
      ) : null}

      {loading ? (
        <ActivityIndicator color={tokens.colors.apps.do} testID="list-loading" />
      ) : tasks.length === 0 && !listError ? (
        <View testID="empty-state" style={{ padding: tokens.space[6], alignItems: 'center' }}>
          <Heading level={3}>Nothing to do</Heading>
          <Heading level={4}>Add your first task above</Heading>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(t) => t.id}
          ItemSeparatorComponent={() => <View style={{ height: tokens.space[2] }} />}
          renderItem={({ item }) => (
            <Card pressable onPress={() => toggle(item)} testID={`task-card-${item.id}`}>
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
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      borderWidth: 2,
                      borderColor: item.completed ? tokens.colors.apps.do : tokens.colors.ink[300],
                      backgroundColor: item.completed ? tokens.colors.apps.do : 'transparent',
                    }}
                    testID={`checkbox-${item.id}`}
                  />
                  <Heading level={4}>{item.title}</Heading>
                </View>
                <Pressable onPress={() => remove(item)} testID={`delete-${item.id}`}>
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
