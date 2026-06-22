/**
 * Voice-capture seam over the browser MediaRecorder API (RN Web).
 *
 * Kept deliberately tiny so the store/UI never touch `MediaRecorder` directly,
 * and so tests can fake it. Native (iOS/Android) recording would land here too,
 * behind the same `AudioRecording` shape, using expo-audio — a follow-up.
 */

/** A pending recording. Call `stop()` to finish and get the captured audio. */
export interface AudioRecording {
  stop(): Promise<Blob>;
}

// Whisper accepts webm/mp4/ogg; prefer the most widely-supported container.
const PREFERRED_MIME_TYPES = ['audio/webm', 'audio/mp4', 'audio/ogg'];

interface MediaRecorderCtor {
  new (stream: MediaStream, opts?: { mimeType?: string }): MediaRecorderLike;
  isTypeSupported?(type: string): boolean;
}

interface MediaRecorderLike {
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  start(): void;
  stop(): void;
}

function getMediaRecorder(): MediaRecorderCtor | undefined {
  return (globalThis as unknown as { MediaRecorder?: MediaRecorderCtor }).MediaRecorder;
}

/** True only where the browser exposes mic capture (RN Web, not native/SSR). */
export function isRecordingSupported(): boolean {
  const MR = getMediaRecorder();
  const mediaDevices = (
    globalThis as unknown as { navigator?: { mediaDevices?: { getUserMedia?: unknown } } }
  ).navigator?.mediaDevices;
  return typeof MR === 'function' && typeof mediaDevices?.getUserMedia === 'function';
}

function pickMimeType(MR: MediaRecorderCtor): string | undefined {
  if (typeof MR.isTypeSupported !== 'function') return undefined;
  return PREFERRED_MIME_TYPES.find((t) => MR.isTypeSupported!(t));
}

/**
 * Prompt for the mic and begin recording. Resolves once recording has started;
 * call `.stop()` on the result to end it and receive the audio Blob.
 */
export async function startRecording(): Promise<AudioRecording> {
  const MR = getMediaRecorder();
  if (!MR) throw new Error('Audio recording is not supported in this environment');

  const stream = await (
    globalThis as unknown as {
      navigator: { mediaDevices: { getUserMedia(c: { audio: boolean }): Promise<MediaStream> } };
    }
  ).navigator.mediaDevices.getUserMedia({ audio: true });

  const mimeType = pickMimeType(MR);
  const recorder = new MR(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });
  recorder.start();

  return {
    async stop(): Promise<Blob> {
      recorder.stop();
      await stopped;
      stream.getTracks().forEach((t) => t.stop());
      return new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
    },
  };
}
