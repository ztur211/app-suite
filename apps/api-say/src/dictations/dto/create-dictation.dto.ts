/**
 * Body for POST /dictations (multipart). audio file arrives via Multer.
 */
export interface CreateDictationDto {
  previewTranscript?: string;
  captureMode: 'tap' | 'drive';
}
