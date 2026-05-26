import { useEffect, useState } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Heading, Button, Card, TextInput, tokens } from '@things/design-system';
import { useMeals } from '../../../store/meals.store';
import type { MealKind } from '../../../lib/types';

const editSchema = z.object({
  name: z.string().trim().min(1, 'Enter a meal'),
  kind: z.enum(['recipe', 'restaurant', 'either']),
  notes: z.string(),
});

type EditForm = z.infer<typeof editSchema>;

const kindLabels: Record<MealKind, string> = {
  recipe: 'Recipe',
  restaurant: 'Restaurant',
  either: 'Either',
};

export default function MealDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { byId, update, remove, refresh, meals } = useMeals();
  const meal = byId(id);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { control, handleSubmit, reset, formState, watch } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: '', kind: 'recipe', notes: '' },
  });

  useEffect(() => {
    if (meals.length === 0) refresh();
  }, [meals.length, refresh]);

  useEffect(() => {
    if (meal) {
      reset({
        name: meal.name,
        kind: meal.kind,
        notes: meal.notes ?? '',
      });
    }
  }, [meal, reset]);

  const onSave = handleSubmit(async ({ name, kind, notes }) => {
    if (!id) return;
    setSubmitError(null);
    try {
      await update(id, { name, kind, notes: notes || null });
      router.back();
    } catch (e) {
      setSubmitError((e as Error).message);
    }
  });

  const onToggleTried = async () => {
    if (!id || !meal) return;
    await update(id, { status: meal.status === 'tried' ? 'active' : 'tried' });
  };

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

  if (!meal) {
    return (
      <View
        testID="meal-not-found"
        style={{ flex: 1, padding: tokens.space[6], gap: tokens.space[4] }}
      >
        <Heading level={3}>Meal not found</Heading>
        <Button label="Back" onPress={() => router.back()} variant="secondary" testID="back-btn" />
      </View>
    );
  }

  const watchedKind = watch('kind');

  return (
    <ScrollView contentContainerStyle={{ padding: tokens.space[6], gap: tokens.space[4] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Heading level={2}>Edit meal</Heading>
        <Pressable onPress={() => router.back()} testID="close-btn">
          <Heading level={3}>×</Heading>
        </Pressable>
      </View>

      <Card>
        <View style={{ gap: tokens.space[3] }}>
          <Heading level={4}>Name</Heading>
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <TextInput
                placeholder="Meal name"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                testID="edit-name"
              />
            )}
          />

          <Heading level={4}>Kind</Heading>
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <View style={{ flexDirection: 'row', gap: tokens.space[2] }}>
                {(Object.keys(kindLabels) as MealKind[]).map((k) => (
                  <Pressable
                    key={k}
                    onPress={() => field.onChange(k)}
                    testID={`edit-kind-${k}`}
                    style={{
                      paddingVertical: tokens.space[2],
                      paddingHorizontal: tokens.space[3],
                      borderRadius: tokens.radius.full,
                      backgroundColor:
                        watchedKind === k ? tokens.colors.apps.eat : tokens.colors.surface.sunken,
                    }}
                  >
                    <Heading level={4}>{kindLabels[k]}</Heading>
                  </Pressable>
                ))}
              </View>
            )}
          />

          <Heading level={4}>Notes</Heading>
          <Controller
            control={control}
            name="notes"
            render={({ field, fieldState }) => (
              <TextInput
                placeholder="Notes (optional)"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                testID="edit-notes"
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
          <Button
            label={meal.status === 'tried' ? 'Mark as to-try' : 'Mark as tried'}
            onPress={onToggleTried}
            variant="secondary"
            testID="toggle-tried-btn"
          />
          <Button label="Delete meal" onPress={onDelete} variant="secondary" testID="delete-btn" />
        </View>
      </Card>

      <Heading level={4}>Status: {meal.status === 'tried' ? 'Tried' : 'Active'}</Heading>
      {meal.sourceDictationId ? <Heading level={4}>Synced from Say Things</Heading> : null}
    </ScrollView>
  );
}
