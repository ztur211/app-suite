export type Intent = 'DO' | 'NOTE' | 'SEND' | 'BUY' | 'EAT';
export type DictationState = 'proposed' | 'confirmed' | 'dispatched' | 'cancelled';
export type CaptureMode = 'tap' | 'drive' | 'type';

export interface Dictation {
  id: string;
  userId: string;
  audioPath: string | null;
  previewTranscript: string | null;
  finalTranscript: string;
  language: string;
  captureMode: CaptureMode;
  intent: Intent;
  proposedPayload: unknown;
  editedPayload: unknown | null;
  state: DictationState;
  destinationRef: string | null;
  dispatchedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
}

/** The shape api-say returns from POST /dictations and /reclassify. */
export interface Proposal {
  intent: Intent;
  payload: unknown;
  confidence: number;
}
