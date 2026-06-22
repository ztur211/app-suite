/**
 * Tests the MediaRecorder seam used for voice capture. `MediaRecorder` and
 * `navigator.mediaDevices` are web-only APIs that don't exist in the jest-expo
 * environment, so we install fakes on globalThis.
 */
import { isRecordingSupported, startRecording } from '../lib/recorder';

type DataHandler = (e: { data: Blob }) => void;

class FakeMediaRecorder {
  static supported = new Set(['audio/webm']);
  static isTypeSupported(t: string): boolean {
    return FakeMediaRecorder.supported.has(t);
  }
  ondataavailable: DataHandler | null = null;
  onstop: (() => void) | null = null;
  state = 'inactive';
  mimeType: string;
  constructor(
    public stream: { getTracks: () => Array<{ stop: () => void }> },
    opts?: { mimeType?: string },
  ) {
    this.mimeType = opts?.mimeType ?? '';
  }
  start(): void {
    this.state = 'recording';
  }
  stop(): void {
    this.state = 'inactive';
    // Real MediaRecorder flushes a final chunk, then fires `stop`.
    this.ondataavailable?.({ data: new Blob(['audio-bytes'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

const trackStop = jest.fn();
const getUserMedia = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: trackStop }] });
  (globalThis as unknown as { MediaRecorder: unknown }).MediaRecorder = FakeMediaRecorder;
  const g = globalThis as unknown as { navigator?: { mediaDevices?: unknown } };
  if (!g.navigator) g.navigator = {};
  g.navigator.mediaDevices = { getUserMedia };
});

afterEach(() => {
  delete (globalThis as unknown as { MediaRecorder?: unknown }).MediaRecorder;
});

describe('isRecordingSupported', () => {
  it('is true when MediaRecorder + getUserMedia are present', () => {
    expect(isRecordingSupported()).toBe(true);
  });

  it('is false when MediaRecorder is missing', () => {
    delete (globalThis as unknown as { MediaRecorder?: unknown }).MediaRecorder;
    expect(isRecordingSupported()).toBe(false);
  });
});

describe('startRecording', () => {
  it('requests the mic with audio:true', async () => {
    await startRecording();
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
  });

  it('stop() returns a non-empty audio Blob and releases the mic', async () => {
    const recording = await startRecording();
    const blob = await recording.stop();
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toContain('audio/');
    expect(blob.size).toBeGreaterThan(0);
    expect(trackStop).toHaveBeenCalledTimes(1);
  });
});
