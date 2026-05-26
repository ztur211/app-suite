export type MessageChannel = 'email' | 'slack' | 'discord' | 'telegram';
export type MessageKind = 'outbound' | 'inbound';
export type MessageStatus = 'draft' | 'sent' | 'unread' | 'read' | 'archived';

export interface Message {
  id: string;
  userId: string;
  channel: MessageChannel;
  kind: MessageKind;
  status: MessageStatus;
  subject: string | null;
  body: string;
  recipient: string | null;
  sourceDictationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
}
