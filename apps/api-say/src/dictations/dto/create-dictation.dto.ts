/**
 * Body for POST /dictations (multipart). audio file arrives via Multer for
 * `tap` and `drive` captureModes; for `type`, no audio is required and
 * previewTranscript is used as the final transcript (skipping the Whisper
 * transcribe call — used by web-say's text input fallback).
 */
export interface CreateDictationDto {
  previewTranscript?: string;
  captureMode: 'tap' | 'drive' | 'type';
}
