import { useEffect } from 'react';
import { View, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Heading, Button, Card, TextInput, tokens } from '@things/design-system';
import { useAuth } from '../../store/auth.store';
import { useDictations } from '../../store/dictations.store';
import { intentColor, intentLabel } from '../../lib/intent';
import type { Dictation } from '../../lib/types';

const captureSchema = z.object({
  text: z.string().trim().min(1, 'Type something to capture'),
});

type CaptureForm = z.infer<typeof captureSchema>;

function IntentBadge({ dictation }: { dictation: Dictation }) {
  return (
    <View
      testID={`intent-${dictation.id}`}
      style={{
        paddingVertical: tokens.space[1],
        paddingHorizontal: tokens.space[3],
        borderRadius: tokens.radius.full,
        backgroundColor: intentColor(dictation.intent) + '22',
      }}
    >
      <Heading level={4}>{intentLabel[dictation.intent]}</Heading>
    </View>
  );
}

export default function Library() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { dictations, loading, creating, error, refresh, capture } = useDictations();

  const { control, handleSubmit, reset } = useForm<CaptureForm>({
    resolver: zodResolver(captureSchema),
    defaultValues: { text: '' },
  });

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onCapture = handleSubmit(async ({ text }) => {
    const ok = await capture(text);
    if (ok) reset({ text: '' });
  });

  return (
    <View style={{ flex: 1, padding: tokens.space[6], gap: tokens.space[4] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Heading level={1}>Say Things</Heading>
        <Pressable onPress={signOut} testID="sign-out">
          <Heading level={4}>Sign out</Heading>
        </Pressable>
      </View>
      <Heading level={4}>{user?.email}</Heading>

      <Card>
        <View style={{ gap: tokens.space[2] }}>
          <Controller
            control={control}
            name="text"
            render={({ field, fieldState }) => (
              <TextInput
                placeholder="Type a thought — a task, a note, something to buy…"
                value={field.value}
                onChangeText={field.onChange}
                onSubmitEditing={onCapture}
                error={fieldState.error?.message}
                testID="capture-input"
              />
            )}
          />
          <Button
            label={creating ? 'Capturing…' : 'Capture'}
            onPress={onCapture}
            variant="primary"
            testID="capture-btn"
          />
        </View>
      </Card>

      {error ? (
        <Card testID="capture-error">
          <Heading level={4}>{error}</Heading>
        </Card>
      ) : null}

      {loading ? (
        <ActivityIndicator color={tokens.colors.apps.say} testID="list-loading" />
      ) : dictations.length === 0 && !error ? (
        <View testID="empty-state" style={{ padding: tokens.space[6], alignItems: 'center' }}>
          <Heading level={3}>Nothing captured yet</Heading>
          <Heading level={4}>Type a thought above and it&apos;ll be sorted by intent</Heading>
        </View>
      ) : (
        <FlatList
          data={dictations}
          keyExtractor={(d) => d.id}
          ItemSeparatorComponent={() => <View style={{ height: tokens.space[2] }} />}
          renderItem={({ item }) => (
            <Card
              pressable
              onPress={() => router.push(`/${item.id}`)}
              testID={`dictation-card-${item.id}`}
            >
              <View style={{ gap: tokens.space[2] }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: tokens.space[2],
                  }}
                >
                  <IntentBadge dictation={item} />
                  <Heading level={4}>{item.state}</Heading>
                </View>
                <Heading level={4}>{item.finalTranscript}</Heading>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}
