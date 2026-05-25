import { useEffect, useState } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Heading, Button, Card, TextInput, tokens } from '@things/design-system';
import { useTasks } from '../../../store/tasks.store';

const editSchema = z.object({
  title: z.string().trim().min(1, 'Enter a task'),
  dueAt: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Use YYYY-MM-DD or leave blank')
    .or(z.literal('')),
});

type EditForm = z.infer<typeof editSchema>;

export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { byId, update, remove, refresh, tasks } = useTasks();
  const task = byId(id);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { control, handleSubmit, reset, formState } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: { title: '', dueAt: '' },
  });

  useEffect(() => {
    if (tasks.length === 0) {
      refresh();
    }
  }, [tasks.length, refresh]);

  useEffect(() => {
    if (task) {
      reset({
        title: task.title,
        dueAt: task.dueAt ? task.dueAt.slice(0, 10) : '',
      });
    }
  }, [task, reset]);

  const onSave = handleSubmit(async ({ title, dueAt }) => {
    if (!id) return;
    setSubmitError(null);
    try {
      const isoDueAt = dueAt ? `${dueAt}T00:00:00.000Z` : null;
      await update(id, { title, dueAt: isoDueAt });
      router.back();
    } catch (e) {
      setSubmitError((e as Error).message);
    }
  });

  const onDelete = async () => {
    if (!id) return;
    setSubmitError(null);
    try {
      await remove(id);
      router.back();
    } catch (e) {
      setSubmitError((e as Error).message);
    }
  };

  if (!task) {
    return (
      <View
        testID="task-not-found"
        style={{ flex: 1, padding: tokens.space[6], gap: tokens.space[4] }}
      >
        <Heading level={3}>Task not found</Heading>
        <Button label="Back" onPress={() => router.back()} variant="secondary" testID="back-btn" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: tokens.space[6], gap: tokens.space[4] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Heading level={2}>Edit task</Heading>
        <Pressable onPress={() => router.back()} testID="close-btn">
          <Heading level={3}>×</Heading>
        </Pressable>
      </View>

      <Card>
        <View style={{ gap: tokens.space[3] }}>
          <Heading level={4}>Title</Heading>
          <Controller
            control={control}
            name="title"
            render={({ field, fieldState }) => (
              <TextInput
                placeholder="Task title"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                testID="edit-title"
              />
            )}
          />

          <Heading level={4}>Due date</Heading>
          <Controller
            control={control}
            name="dueAt"
            render={({ field, fieldState }) => (
              <TextInput
                placeholder="YYYY-MM-DD (optional)"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                autoCapitalize="none"
                error={fieldState.error?.message}
                testID="edit-dueAt"
              />
            )}
          />

          {submitError ? (
            <View
              testID="edit-error"
              style={{
                padding: tokens.space[2],
                backgroundColor: tokens.colors.semantic.danger + '20',
                borderRadius: tokens.radius.sm,
              }}
            >
              <Heading level={4}>{submitError}</Heading>
            </View>
          ) : null}

          <Button
            label={formState.isSubmitting ? 'Saving…' : 'Save'}
            onPress={onSave}
            variant="primary"
            testID="save-btn"
          />
          <Button label="Delete task" onPress={onDelete} variant="secondary" testID="delete-btn" />
        </View>
      </Card>

      <Heading level={4}>Status: {task.completed ? 'Completed' : 'Active'}</Heading>
    </ScrollView>
  );
}
