import { useEffect, useRef, useState } from 'react';
import { View, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Heading, Button, Card, TextInput, tokens } from '@things/design-system';
import { useAuth } from '@things/web-kit';
import { useDictations } from '../../store/dictations.store';
import { intentColor, intentLabel } from '../../lib/intent';
import { isRecordingSupported, startRecording, type AudioRecording } from '../../lib/recorder';
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
  const { dictations, loading, creating, error, refresh, capture, captureAudio } = useDictations();

  const { control, handleSubmit, reset } = useForm<CaptureForm>({
    resolver: zodResolver(captureSchema),
    defaultValues: { text: '' },
  });

  const recordSupported = isRecordingSupported();
  const recordingRef = useRef<AudioRecording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onCapture = handleSubmit(async ({ text }) => {
    const ok = await capture(text);
    if (ok) reset({ text: '' });
  });

  const onToggleRecord = async () => {
    setRecordError(null);
    if (isRecording) {
      const handle = recordingRef.current;
      recordingRef.current = null;
      setIsRecording(false);
      if (handle) {
        try {
          const blob = await handle.stop();
          await captureAudio(blob);
        } catch (e) {
          setRecordError((e as Error).message);
        }
      }
    } else {
      try {
        const handle = await startRecording();
        recordingRef.current = handle;
        setIsRecording(true);
      } catch (e) {
        setRecordError((e as Error).message);
      }
    }
  };

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
          {recordSupported ? (
            <View style={{ gap: tokens.space[2], alignItems: 'center' }}>
              <Button
                label={isRecording ? 'Stop & transcribe' : '● Record'}
                onPress={onToggleRecord}
                variant={isRecording ? 'primary' : 'secondary'}
                testID="record-btn"
              />
              {isRecording ? (
                <ActivityIndicator color={tokens.colors.apps.say} testID="recording-indicator" />
              ) : null}
              {recordError ? (
                <Heading level={4} testID="record-error">
                  {recordError}
                </Heading>
              ) : null}
            </View>
          ) : null}
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
