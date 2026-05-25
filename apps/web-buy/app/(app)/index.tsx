import { useEffect, useMemo, useState } from 'react';
import { View, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Heading, Button, Card, TextInput, tokens } from '@things/design-system';
import { useAuth } from '../../store/auth.store';
import { useItems } from '../../store/items.store';
import type { ShoppingItem } from '../../lib/types';

const newItemSchema = z.object({
  title: z.string().trim().min(1, 'Enter an item'),
});

type NewItemForm = z.infer<typeof newItemSchema>;

type Filter = 'active' | 'bought';

function filterItems(items: ShoppingItem[], filter: Filter): ShoppingItem[] {
  return items.filter((t) => t.status === filter);
}

const filterLabels: Record<Filter, string> = {
  active: 'To buy',
  bought: 'Bought',
};

export default function Items() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { items, loading, error, syncing, syncSummary, refresh, create, update, remove, sync } =
    useItems();
  const [filter, setFilter] = useState<Filter>('active');

  const { control, handleSubmit, reset } = useForm<NewItemForm>({
    resolver: zodResolver(newItemSchema),
    defaultValues: { title: '' },
  });

  useEffect(() => {
    refresh();
  }, [refresh]);

  const visible = useMemo(() => filterItems(items, filter), [items, filter]);

  const add = handleSubmit(async ({ title }) => {
    await create({ title });
    reset({ title: '' });
  });

  const toggleBought = (t: ShoppingItem) =>
    update(t.id, { status: t.status === 'bought' ? 'active' : 'bought' });

  return (
    <View style={{ flex: 1, padding: tokens.space[6], gap: tokens.space[4] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Heading level={1}>Shopping</Heading>
        <View style={{ flexDirection: 'row', gap: tokens.space[3], alignItems: 'center' }}>
          <Pressable onPress={sync} disabled={syncing} testID="sync-btn">
            <Heading level={4}>{syncing ? 'Syncing…' : 'Sync'}</Heading>
          </Pressable>
          <Pressable onPress={signOut} testID="sign-out">
            <Heading level={4}>Sign out</Heading>
          </Pressable>
        </View>
      </View>
      <Heading level={4}>{user?.email}</Heading>

      {syncSummary && syncSummary.created > 0 ? (
        <Card testID="sync-summary">
          <Heading level={4}>Pulled {syncSummary.created} new items from Say Things</Heading>
        </Card>
      ) : null}

      <Card>
        <View style={{ flexDirection: 'row', gap: tokens.space[2], alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Controller
              control={control}
              name="title"
              render={({ field, fieldState }) => (
                <TextInput
                  placeholder="What do you need?"
                  value={field.value}
                  onChangeText={field.onChange}
                  onSubmitEditing={add}
                  error={fieldState.error?.message}
                  testID="item-input"
                />
              )}
            />
          </View>
          <Button label="Add" onPress={add} variant="primary" testID="item-add-btn" />
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
                filter === key ? tokens.colors.apps.buy : tokens.colors.surface.sunken,
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
        <ActivityIndicator color={tokens.colors.apps.buy} testID="list-loading" />
      ) : visible.length === 0 && !error ? (
        <View testID="empty-state" style={{ padding: tokens.space[6], alignItems: 'center' }}>
          <Heading level={3}>
            {filter === 'bought' ? 'Nothing bought yet' : 'Nothing to buy'}
          </Heading>
          <Heading level={4}>
            {filter === 'bought'
              ? 'Items you check off will show up here'
              : 'Add your first item above, or sync from Say Things'}
          </Heading>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(t) => t.id}
          ItemSeparatorComponent={() => <View style={{ height: tokens.space[2] }} />}
          renderItem={({ item }) => (
            <Card
              pressable
              onPress={() => router.push(`/item/${item.id}`)}
              testID={`item-card-${item.id}`}
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
                  <Pressable onPress={() => toggleBought(item)} testID={`checkbox-${item.id}`}>
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        borderWidth: 2,
                        borderColor:
                          item.status === 'bought'
                            ? tokens.colors.apps.buy
                            : tokens.colors.ink[300],
                        backgroundColor:
                          item.status === 'bought' ? tokens.colors.apps.buy : 'transparent',
                      }}
                    />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <View
                      style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space[2] }}
                    >
                      <Heading level={4}>{item.title}</Heading>
                      {item.quantity ? <Heading level={4}>×{item.quantity}</Heading> : null}
                      {item.sourceDictationId ? (
                        <Heading level={4} testID={`from-say-${item.id}`}>
                          (Say)
                        </Heading>
                      ) : null}
                    </View>
                    {item.notes ? <Heading level={4}>{item.notes}</Heading> : null}
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
