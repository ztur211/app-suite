import { useEffect, useState } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Heading, Button, Card, TextInput, tokens } from '@things/design-system';
import { useItems } from '../../../store/items.store';

const editSchema = z.object({
  title: z.string().trim().min(1, 'Enter an item'),
  quantity: z
    .string()
    .regex(/^(\d+)?$/, 'Whole numbers only')
    .or(z.literal('')),
  notes: z.string(),
});

type EditForm = z.infer<typeof editSchema>;

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { byId, update, remove, refresh, items } = useItems();
  const item = byId(id);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { control, handleSubmit, reset, formState } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: { title: '', quantity: '', notes: '' },
  });

  useEffect(() => {
    if (items.length === 0) refresh();
  }, [items.length, refresh]);

  useEffect(() => {
    if (item) {
      reset({
        title: item.title,
        quantity: item.quantity != null ? String(item.quantity) : '',
        notes: item.notes ?? '',
      });
    }
  }, [item, reset]);

  const onSave = handleSubmit(async ({ title, quantity, notes }) => {
    if (!id) return;
    setSubmitError(null);
    try {
      const qty = quantity ? Number(quantity) : null;
      await update(id, { title, quantity: qty, notes: notes || null });
      router.back();
    } catch (e) {
      setSubmitError((e as Error).message);
    }
  });

  const onToggleBought = async () => {
    if (!id || !item) return;
    await update(id, { status: item.status === 'bought' ? 'active' : 'bought' });
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

  if (!item) {
    return (
      <View
        testID="item-not-found"
        style={{ flex: 1, padding: tokens.space[6], gap: tokens.space[4] }}
      >
        <Heading level={3}>Item not found</Heading>
        <Button label="Back" onPress={() => router.back()} variant="secondary" testID="back-btn" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: tokens.space[6], gap: tokens.space[4] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Heading level={2}>Edit item</Heading>
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
                placeholder="Item name"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                testID="edit-title"
              />
            )}
          />

          <Heading level={4}>Quantity</Heading>
          <Controller
            control={control}
            name="quantity"
            render={({ field, fieldState }) => (
              <TextInput
                placeholder="Whole number (optional)"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                keyboardType="number-pad"
                error={fieldState.error?.message}
                testID="edit-quantity"
              />
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
            label={item.status === 'bought' ? 'Mark as active' : 'Mark as bought'}
            onPress={onToggleBought}
            variant="secondary"
            testID="toggle-bought-btn"
          />
          <Button label="Delete item" onPress={onDelete} variant="secondary" testID="delete-btn" />
        </View>
      </Card>

      <Heading level={4}>Status: {item.status === 'bought' ? 'Bought' : 'Active'}</Heading>
      {item.sourceDictationId ? <Heading level={4}>Synced from Say Things</Heading> : null}
    </ScrollView>
  );
}
