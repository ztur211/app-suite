import { useEffect, useState, useCallback } from 'react';
import { View, FlatList, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Heading, Button, Card, tokens } from '@things/design-system';
import { useAuth } from '../../store/auth.store';
import { tasksApi } from '../../lib/api';
import type { Task } from '../../lib/types';

export default function Today() {
  const { signOut, user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setTasks(await tasksApi.list());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle('');
    const t = await tasksApi.create(title);
    setTasks((prev) => [t, ...prev]);
  };

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
        <View style={{ flexDirection: 'row', gap: tokens.space[2] }}>
          <TextInput
            placeholder="What needs to get done?"
            value={newTitle}
            onChangeText={setNewTitle}
            onSubmitEditing={add}
            testID="task-input"
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: tokens.colors.ink[200],
              borderRadius: tokens.radius.md,
              padding: tokens.space[3],
              fontSize: tokens.typography.fontSize.base,
            }}
          />
          <Button label="Add" onPress={add} variant="primary" testID="task-add-btn" />
        </View>
      </Card>

      {loading ? (
        <ActivityIndicator color={tokens.colors.apps.do} />
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
