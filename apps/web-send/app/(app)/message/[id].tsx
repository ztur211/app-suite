import { useEffect, useState } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Heading, Button, Card, TextInput, tokens } from '@things/design-system';
import { useMessages } from '../../../store/messages.store';
import type { MessageChannel } from '../../../lib/types';

const editSchema = z.object({
  channel: z.enum(['email', 'slack', 'discord', 'telegram']),
  subject: z.string(),
  body: z.string().trim().min(1, 'Enter a message'),
  recipient: z.string(),
});

type EditForm = z.infer<typeof editSchema>;

const channelLabels: Record<MessageChannel, string> = {
  email: 'Email',
  slack: 'Slack',
  discord: 'Discord',
  telegram: 'Telegram',
};

export default function MessageDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { byId, update, remove, refresh, messages } = useMessages();
  const message = byId(id);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { control, handleSubmit, reset, formState, watch } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: { channel: 'email', subject: '', body: '', recipient: '' },
  });

  useEffect(() => {
    if (messages.length === 0) refresh();
  }, [messages.length, refresh]);

  useEffect(() => {
    if (message) {
      reset({
        channel: message.channel,
        subject: message.subject ?? '',
        body: message.body,
        recipient: message.recipient ?? '',
      });
    }
  }, [message, reset]);

  const onSave = handleSubmit(async ({ channel, subject, body, recipient }) => {
    if (!id) return;
    setSubmitError(null);
    try {
      await update(id, {
        channel,
        subject: subject || null,
        body,
        recipient: recipient || null,
      });
      router.back();
    } catch (e) {
      setSubmitError((e as Error).message);
    }
  });

  const onToggleSent = async () => {
    if (!id || !message) return;
    await update(id, { status: message.status === 'sent' ? 'draft' : 'sent' });
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

  if (!message) {
    return (
      <View
        testID="message-not-found"
        style={{ flex: 1, padding: tokens.space[6], gap: tokens.space[4] }}
      >
        <Heading level={3}>Message not found</Heading>
        <Button label="Back" onPress={() => router.back()} variant="secondary" testID="back-btn" />
      </View>
    );
  }

  const watchedChannel = watch('channel');

  return (
    <ScrollView contentContainerStyle={{ padding: tokens.space[6], gap: tokens.space[4] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Heading level={2}>Edit message</Heading>
        <Pressable onPress={() => router.back()} testID="close-btn">
          <Heading level={3}>×</Heading>
        </Pressable>
      </View>

      <Card>
        <View style={{ gap: tokens.space[3] }}>
          <Heading level={4}>Channel</Heading>
          <Controller
            control={control}
            name="channel"
            render={({ field }) => (
              <View style={{ flexDirection: 'row', gap: tokens.space[2] }}>
                {(Object.keys(channelLabels) as MessageChannel[]).map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => field.onChange(c)}
                    testID={`edit-channel-${c}`}
                    style={{
                      paddingVertical: tokens.space[2],
                      paddingHorizontal: tokens.space[3],
                      borderRadius: tokens.radius.full,
                      backgroundColor:
                        watchedChannel === c
                          ? tokens.colors.apps.send
                          : tokens.colors.surface.sunken,
                    }}
                  >
                    <Heading level={4}>{channelLabels[c]}</Heading>
                  </Pressable>
                ))}
              </View>
            )}
          />

          {watchedChannel === 'email' ? (
            <>
              <Heading level={4}>Subject</Heading>
              <Controller
                control={control}
                name="subject"
                render={({ field }) => (
                  <TextInput
                    placeholder="Subject"
                    value={field.value ?? ''}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    testID="edit-subject"
                  />
                )}
              />
            </>
          ) : null}

          <Heading level={4}>Recipient</Heading>
          <Controller
            control={control}
            name="recipient"
            render={({ field }) => (
              <TextInput
                placeholder={
                  watchedChannel === 'email'
                    ? 'jane@example.com'
                    : `@handle on ${channelLabels[watchedChannel]}`
                }
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                testID="edit-recipient"
              />
            )}
          />

          <Heading level={4}>Body</Heading>
          <Controller
            control={control}
            name="body"
            render={({ field, fieldState }) => (
              <TextInput
                placeholder="Message body"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                multiline
                testID="edit-body"
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
            label={message.status === 'sent' ? 'Mark as draft' : 'Mark as sent'}
            onPress={onToggleSent}
            variant="secondary"
            testID="toggle-sent-btn"
          />
          <Button
            label="Delete message"
            onPress={onDelete}
            variant="secondary"
            testID="delete-btn"
          />
        </View>
      </Card>

      <Heading level={4}>
        Status:{' '}
        {message.status === 'sent' ? 'Sent' : message.status === 'draft' ? 'Draft' : message.status}
      </Heading>
      {message.sourceDictationId ? <Heading level={4}>Synced from Say Things</Heading> : null}
    </ScrollView>
  );
}
