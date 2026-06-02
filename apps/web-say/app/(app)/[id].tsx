import { useEffect, useState } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Heading, Button, Card, tokens } from '@things/design-system';
import { useDictations } from '../../store/dictations.store';
import { intentColor, intentLabel } from '../../lib/intent';

function PayloadView({ payload }: { payload: unknown }) {
  if (payload == null || typeof payload !== 'object') {
    return <Heading level={4}>{String(payload ?? '—')}</Heading>;
  }
  const entries = Object.entries(payload as Record<string, unknown>);
  return (
    <View style={{ gap: tokens.space[1] }}>
      {entries.map(([k, v]) => (
        <View key={k} style={{ flexDirection: 'row', gap: tokens.space[2], flexWrap: 'wrap' }}>
          <Heading level={4}>{k}:</Heading>
          <Heading level={4}>{v == null ? '—' : String(v)}</Heading>
        </View>
      ))}
    </View>
  );
}

export default function DictationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { byId, dictations, refresh, dispatch, undoDispatch, remove } = useDictations();
  const dictation = byId(id);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (dictations.length === 0) refresh();
  }, [dictations.length, refresh]);

  const run = async (fn: () => Promise<void>, close = false) => {
    setSubmitError(null);
    setBusy(true);
    try {
      await fn();
      if (close) router.back();
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!dictation) {
    return (
      <View
        testID="dictation-not-found"
        style={{ flex: 1, padding: tokens.space[6], gap: tokens.space[4] }}
      >
        <Heading level={3}>Dictation not found</Heading>
        <Button label="Back" onPress={() => router.back()} variant="secondary" testID="back-btn" />
      </View>
    );
  }

  const payload = dictation.editedPayload ?? dictation.proposedPayload;
  const canDispatch = dictation.state === 'proposed' || dictation.state === 'confirmed';
  const canUndo = dictation.state === 'dispatched';

  return (
    <ScrollView contentContainerStyle={{ padding: tokens.space[6], gap: tokens.space[4] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Heading level={2}>Dictation</Heading>
        <Pressable onPress={() => router.back()} testID="close-btn">
          <Heading level={3}>×</Heading>
        </Pressable>
      </View>

      <Card>
        <View style={{ gap: tokens.space[3] }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: tokens.space[2],
            }}
          >
            <View
              style={{
                paddingVertical: tokens.space[1],
                paddingHorizontal: tokens.space[3],
                borderRadius: tokens.radius.full,
                backgroundColor: intentColor(dictation.intent) + '22',
              }}
            >
              <Heading level={4}>{intentLabel[dictation.intent]}</Heading>
            </View>
            <Heading level={4}>{dictation.state}</Heading>
          </View>

          <Heading level={4}>Transcript</Heading>
          <Heading level={3}>{dictation.finalTranscript}</Heading>

          <Heading level={4}>Proposed</Heading>
          <PayloadView payload={payload} />
        </View>
      </Card>

      {submitError ? (
        <View
          testID="detail-error"
          style={{
            padding: tokens.space[2],
            backgroundColor: tokens.colors.semantic.danger + '20',
            borderRadius: tokens.radius.sm,
          }}
        >
          <Heading level={4}>{submitError}</Heading>
        </View>
      ) : null}

      {canDispatch ? (
        <Button
          label={busy ? 'Dispatching…' : `Send to ${intentLabel[dictation.intent]}`}
          onPress={() => run(() => dispatch(dictation.id))}
          variant="primary"
          testID="dispatch-btn"
        />
      ) : null}
      {canUndo ? (
        <Button
          label={busy ? 'Undoing…' : 'Undo dispatch'}
          onPress={() => run(() => undoDispatch(dictation.id))}
          variant="secondary"
          testID="undo-btn"
        />
      ) : null}
      <Button
        label="Delete"
        onPress={() => run(() => remove(dictation.id), true)}
        variant="secondary"
        testID="delete-btn"
      />
    </ScrollView>
  );
}
