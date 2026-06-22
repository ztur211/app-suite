import { useEffect, useMemo, useState } from 'react';
import { View, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Heading, Button, Card, TextInput, tokens } from '@things/design-system';
import { useAuth } from '@things/web-kit';
import { useMessages } from '../../store/messages.store';
import type { Message, MessageChannel } from '../../lib/types';

const newMessageSchema = z.object({
  channel: z.enum(['email', 'slack', 'discord', 'telegram']),
  body: z.string().trim().min(1, 'Enter a message'),
  subject: z.string().optional(),
  recipient: z.string().optional(),
});

type NewMessageForm = z.infer<typeof newMessageSchema>;

type Filter = 'draft' | 'sent' | 'inbox';

const filterLabels: Record<Filter, string> = {
  draft: 'Drafts',
  sent: 'Sent',
  inbox: 'Inbox',
};

const channelLabels: Record<MessageChannel, string> = {
  email: 'Email',
  slack: 'Slack',
  discord: 'Discord',
  telegram: 'Telegram',
};

function filterMessages(messages: Message[], filter: Filter): Message[] {
  if (filter === 'inbox') return messages.filter((m) => m.kind === 'inbound');
  return messages.filter((m) => m.kind === 'outbound' && m.status === filter);
}

export default function Messages() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const {
    messages,
    loading,
    error,
    syncing,
    syncSummary,
    saySummary,
    telegramChatId,
    refresh,
    create,
    update,
    remove,
    send,
    sync,
    linkTelegram,
    syncFromSay,
  } = useMessages();
  const [filter, setFilter] = useState<Filter>('draft');
  const [tgChat, setTgChat] = useState('');

  const { control, handleSubmit, reset, watch } = useForm<NewMessageForm>({
    resolver: zodResolver(newMessageSchema),
    defaultValues: { channel: 'email', body: '', subject: '', recipient: '' },
  });

  useEffect(() => {
    refresh();
  }, [refresh]);

  const visible = useMemo(() => filterMessages(messages, filter), [messages, filter]);
  const currentChannel = watch('channel');

  const add = handleSubmit(async ({ channel, body, subject, recipient }) => {
    await create({
      channel,
      body,
      subject: subject?.trim() ? subject : null,
      recipient: recipient?.trim() ? recipient : null,
    });
    reset({ channel, body: '', subject: '', recipient: '' });
  });

  const markSent = (m: Message) => update(m.id, { status: m.status === 'sent' ? 'draft' : 'sent' });

  return (
    <View style={{ flex: 1, padding: tokens.space[6], gap: tokens.space[4] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Heading level={1}>Messages</Heading>
        <View style={{ flexDirection: 'row', gap: tokens.space[3], alignItems: 'center' }}>
          <Pressable onPress={syncFromSay} testID="say-pull-btn">
            <Heading level={4}>From Say</Heading>
          </Pressable>
          <Pressable onPress={sync} disabled={syncing} testID="sync-btn">
            <Heading level={4}>{syncing ? 'Syncing…' : 'Sync'}</Heading>
          </Pressable>
          <Pressable onPress={signOut} testID="sign-out">
            <Heading level={4}>Sign out</Heading>
          </Pressable>
        </View>
      </View>
      <Heading level={4}>{user?.email}</Heading>

      {syncSummary && syncSummary.inboundCreated > 0 ? (
        <Card testID="sync-summary">
          <Heading level={4}>
            Pulled {syncSummary.inboundCreated} new message
            {syncSummary.inboundCreated === 1 ? '' : 's'} from Telegram
          </Heading>
        </Card>
      ) : null}

      {saySummary && saySummary.created > 0 ? (
        <Card testID="say-summary">
          <Heading level={4}>
            Pulled {saySummary.created} draft{saySummary.created === 1 ? '' : 's'} from Say Things
          </Heading>
        </Card>
      ) : null}

      <Card>
        <View style={{ gap: tokens.space[2] }}>
          <Heading level={4}>
            {telegramChatId ? `Telegram connected: ${telegramChatId}` : 'Connect Telegram'}
          </Heading>
          <View style={{ flexDirection: 'row', gap: tokens.space[2], alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <TextInput
                placeholder="Your Telegram chat id"
                value={tgChat}
                onChangeText={setTgChat}
                testID="telegram-chatid-input"
              />
            </View>
            <Button
              label="Connect"
              onPress={() => {
                const c = tgChat.trim();
                if (c) linkTelegram(c);
              }}
              variant="secondary"
              testID="telegram-link-btn"
            />
          </View>
        </View>
      </Card>

      <Card>
        <View style={{ gap: tokens.space[3] }}>
          <Controller
            control={control}
            name="channel"
            render={({ field }) => (
              <View style={{ flexDirection: 'row', gap: tokens.space[2] }} testID="channel-row">
                {(Object.keys(channelLabels) as MessageChannel[]).map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => field.onChange(c)}
                    testID={`channel-${c}`}
                    style={{
                      paddingVertical: tokens.space[2],
                      paddingHorizontal: tokens.space[3],
                      borderRadius: tokens.radius.full,
                      backgroundColor:
                        field.value === c ? tokens.colors.apps.send : tokens.colors.surface.sunken,
                    }}
                  >
                    <Heading level={4}>{channelLabels[c]}</Heading>
                  </Pressable>
                ))}
              </View>
            )}
          />
          {currentChannel === 'email' ? (
            <Controller
              control={control}
              name="subject"
              render={({ field }) => (
                <TextInput
                  placeholder="Subject"
                  value={field.value ?? ''}
                  onChangeText={field.onChange}
                  testID="message-subject"
                />
              )}
            />
          ) : null}
          <Controller
            control={control}
            name="recipient"
            render={({ field }) => (
              <TextInput
                placeholder={
                  currentChannel === 'email'
                    ? 'To (email)'
                    : `To (${channelLabels[currentChannel]} handle)`
                }
                value={field.value ?? ''}
                onChangeText={field.onChange}
                testID="message-recipient"
              />
            )}
          />
          <Controller
            control={control}
            name="body"
            render={({ field, fieldState }) => (
              <TextInput
                placeholder="Body"
                value={field.value}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
                multiline
                testID="message-body"
              />
            )}
          />
          <Button label="Save draft" onPress={add} variant="primary" testID="message-add-btn" />
        </View>
      </Card>

      <View
        style={{ flexDirection: 'row', gap: tokens.space[2] }}
        accessibilityRole="tablist"
        testID="filter-tabs"
      >
        {(Object.keys(filterLabels) as Filter[]).map((s) => (
          <Pressable
            key={s}
            onPress={() => setFilter(s)}
            testID={`tab-${s}`}
            style={{
              paddingVertical: tokens.space[2],
              paddingHorizontal: tokens.space[4],
              borderRadius: tokens.radius.full,
              backgroundColor:
                filter === s ? tokens.colors.apps.send : tokens.colors.surface.sunken,
            }}
          >
            <Heading level={4}>{filterLabels[s]}</Heading>
          </Pressable>
        ))}
      </View>

      {error ? (
        <Card testID="list-error">
          <Heading level={4}>{error}</Heading>
        </Card>
      ) : null}

      {loading ? (
        <ActivityIndicator color={tokens.colors.apps.send} testID="list-loading" />
      ) : visible.length === 0 && !error ? (
        <View testID="empty-state" style={{ padding: tokens.space[6], alignItems: 'center' }}>
          <Heading level={3}>
            {filter === 'inbox'
              ? 'Inbox empty'
              : filter === 'sent'
                ? 'Nothing sent yet'
                : 'No drafts'}
          </Heading>
          <Heading level={4}>
            {filter === 'inbox'
              ? 'Connect Telegram and Sync to receive messages'
              : filter === 'sent'
                ? 'Messages you mark sent will show here'
                : 'Compose a message above'}
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
              onPress={() => router.push(`/message/${item.id}`)}
              testID={`message-card-${item.id}`}
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
                  <Pressable onPress={() => markSent(item)} testID={`checkbox-${item.id}`}>
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        borderWidth: 2,
                        borderColor:
                          item.status === 'sent' ? tokens.colors.apps.send : tokens.colors.ink[300],
                        backgroundColor:
                          item.status === 'sent' ? tokens.colors.apps.send : 'transparent',
                      }}
                    />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <View
                      style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space[2] }}
                    >
                      <Heading level={4}>
                        {item.subject ??
                          item.body.slice(0, 50) + (item.body.length > 50 ? '…' : '')}
                      </Heading>
                      <Heading level={4} testID={`channel-badge-${item.id}`}>
                        {channelLabels[item.channel]}
                      </Heading>
                      {item.sourceDictationId ? (
                        <Heading level={4} testID={`from-say-${item.id}`}>
                          (Say)
                        </Heading>
                      ) : null}
                    </View>
                    {item.recipient ? <Heading level={4}>To: {item.recipient}</Heading> : null}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space[2] }}>
                  {item.channel === 'telegram' &&
                  item.kind === 'outbound' &&
                  item.status === 'draft' ? (
                    <Button
                      label="Send"
                      onPress={() => send(item.id)}
                      variant="primary"
                      testID={`send-${item.id}`}
                    />
                  ) : null}
                  <Pressable onPress={() => remove(item.id)} testID={`delete-${item.id}`}>
                    <Heading level={4}>×</Heading>
                  </Pressable>
                </View>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}
