import { useEffect, useMemo, useState } from 'react';
import { View, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Heading, Button, Card, TextInput, tokens } from '@things/design-system';
import { useAuth } from '@things/web-kit';
import { useMeals } from '../../store/meals.store';
import type { MealItem, MealKind, MealStatus } from '../../lib/types';

const newMealSchema = z.object({
  name: z.string().trim().min(1, 'Enter a meal'),
  kind: z.enum(['recipe', 'restaurant', 'either']),
});

type NewMealForm = z.infer<typeof newMealSchema>;

const statusLabels: Record<MealStatus, string> = {
  active: 'To try',
  tried: 'Tried',
};

const kindLabels: Record<MealKind, string> = {
  recipe: 'Recipe',
  restaurant: 'Restaurant',
  either: 'Either',
};

function filterMeals(meals: MealItem[], status: MealStatus): MealItem[] {
  return meals.filter((m) => m.status === status);
}

export default function Meals() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const {
    meals,
    loading,
    error,
    syncing,
    syncSummary,
    results,
    searching,
    refresh,
    create,
    update,
    remove,
    sync,
    search,
    addResult,
  } = useMeals();
  const [filter, setFilter] = useState<MealStatus>('active');
  const [query, setQuery] = useState('');
  const [searchKind, setSearchKind] = useState<'recipe' | 'restaurant'>('recipe');

  const { control, handleSubmit, reset } = useForm<NewMealForm>({
    resolver: zodResolver(newMealSchema),
    defaultValues: { name: '', kind: 'recipe' },
  });

  useEffect(() => {
    refresh();
  }, [refresh]);

  const visible = useMemo(() => filterMeals(meals, filter), [meals, filter]);

  const add = handleSubmit(async ({ name, kind }) => {
    await create({ name, kind });
    reset({ name: '', kind });
  });

  const toggleTried = (m: MealItem) =>
    update(m.id, { status: m.status === 'tried' ? 'active' : 'tried' });

  const onSearch = async () => {
    const q = query.trim();
    if (q) await search(q, searchKind);
  };

  const searchKinds: { key: 'recipe' | 'restaurant'; label: string }[] = [
    { key: 'recipe', label: 'Recipes' },
    { key: 'restaurant', label: 'Restaurants' },
  ];

  return (
    <View style={{ flex: 1, padding: tokens.space[6], gap: tokens.space[4] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Heading level={1}>Meals</Heading>
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
          <Heading level={4}>Pulled {syncSummary.created} new meals from Say Things</Heading>
        </Card>
      ) : null}

      <Card>
        <View style={{ gap: tokens.space[3] }}>
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <TextInput
                placeholder="Recipe name or restaurant"
                value={field.value}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
                testID="meal-input"
              />
            )}
          />
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <View style={{ flexDirection: 'row', gap: tokens.space[2] }} testID="kind-row">
                {(Object.keys(kindLabels) as MealKind[]).map((k) => (
                  <Pressable
                    key={k}
                    onPress={() => field.onChange(k)}
                    testID={`kind-${k}`}
                    style={{
                      paddingVertical: tokens.space[2],
                      paddingHorizontal: tokens.space[3],
                      borderRadius: tokens.radius.full,
                      backgroundColor:
                        field.value === k ? tokens.colors.apps.eat : tokens.colors.surface.sunken,
                    }}
                  >
                    <Heading level={4}>{kindLabels[k]}</Heading>
                  </Pressable>
                ))}
              </View>
            )}
          />
          <Button label="Add" onPress={add} variant="primary" testID="meal-add-btn" />
        </View>
      </Card>

      <Card>
        <View style={{ gap: tokens.space[2] }}>
          <View style={{ flexDirection: 'row', gap: tokens.space[2] }} testID="search-kind-row">
            {searchKinds.map(({ key, label }) => (
              <Pressable
                key={key}
                onPress={() => setSearchKind(key)}
                testID={`search-kind-${key}`}
                style={{
                  paddingVertical: tokens.space[2],
                  paddingHorizontal: tokens.space[3],
                  borderRadius: tokens.radius.full,
                  backgroundColor:
                    searchKind === key ? tokens.colors.apps.eat : tokens.colors.surface.sunken,
                }}
              >
                <Heading level={4}>{label}</Heading>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: tokens.space[2], alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <TextInput
                placeholder={searchKind === 'recipe' ? 'Find a recipe…' : 'Find a restaurant…'}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={onSearch}
                testID="search-input"
              />
            </View>
            <Button
              label={searching ? 'Finding…' : 'Find'}
              onPress={onSearch}
              variant="secondary"
              testID="search-btn"
            />
          </View>
          {searching ? (
            <ActivityIndicator color={tokens.colors.apps.eat} testID="searching" />
          ) : null}
          {results.length > 0 ? (
            <View style={{ gap: tokens.space[2] }} testID="search-results">
              {results.map((r) => (
                <View
                  key={r.id}
                  testID={`result-${r.id}`}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: tokens.space[2],
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Heading level={4}>{r.name}</Heading>
                    {r.detail ? <Heading level={4}>{r.detail}</Heading> : null}
                  </View>
                  <Button
                    label="Add"
                    onPress={() => addResult(r)}
                    variant="primary"
                    testID={`add-result-${r.id}`}
                  />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </Card>

      <View
        style={{ flexDirection: 'row', gap: tokens.space[2] }}
        accessibilityRole="tablist"
        testID="filter-tabs"
      >
        {(Object.keys(statusLabels) as MealStatus[]).map((s) => (
          <Pressable
            key={s}
            onPress={() => setFilter(s)}
            testID={`tab-${s}`}
            style={{
              paddingVertical: tokens.space[2],
              paddingHorizontal: tokens.space[4],
              borderRadius: tokens.radius.full,
              backgroundColor: filter === s ? tokens.colors.apps.eat : tokens.colors.surface.sunken,
            }}
          >
            <Heading level={4}>{statusLabels[s]}</Heading>
          </Pressable>
        ))}
      </View>

      {error ? (
        <Card testID="list-error">
          <Heading level={4}>{error}</Heading>
        </Card>
      ) : null}

      {loading ? (
        <ActivityIndicator color={tokens.colors.apps.eat} testID="list-loading" />
      ) : visible.length === 0 && !error ? (
        <View testID="empty-state" style={{ padding: tokens.space[6], alignItems: 'center' }}>
          <Heading level={3}>{filter === 'tried' ? 'Nothing tried yet' : 'Nothing to try'}</Heading>
          <Heading level={4}>
            {filter === 'tried'
              ? 'Meals you mark tried will show here'
              : 'Add a meal above or sync from Say Things'}
          </Heading>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(m) => m.id}
          ItemSeparatorComponent={() => <View style={{ height: tokens.space[2] }} />}
          renderItem={({ item }) => (
            <Card
              pressable
              onPress={() => router.push(`/meal/${item.id}`)}
              testID={`meal-card-${item.id}`}
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
                  <Pressable onPress={() => toggleTried(item)} testID={`checkbox-${item.id}`}>
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        borderWidth: 2,
                        borderColor:
                          item.status === 'tried' ? tokens.colors.apps.eat : tokens.colors.ink[300],
                        backgroundColor:
                          item.status === 'tried' ? tokens.colors.apps.eat : 'transparent',
                      }}
                    />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <View
                      style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space[2] }}
                    >
                      <Heading level={4}>{item.name}</Heading>
                      <Heading level={4} testID={`kind-badge-${item.id}`}>
                        {kindLabels[item.kind as MealKind]}
                      </Heading>
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
