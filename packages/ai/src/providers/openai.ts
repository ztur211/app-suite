import type OpenAI from 'openai';
import type { Segment, Usage } from '../types';
import type { EmbedFn, OpenAIProvider, TranscribeFn } from './types';
import { makeProviderErrorWrapper } from './_helpers';

const PROVIDER_ID = 'openai';
const wrapError: (err: unknown) => never = makeProviderErrorWrapper(PROVIDER_ID);

interface WhisperResponse {
  text: string;
  language: string;
  duration: number;
  segments?: Array<{ start: number; end: number; text: string }>;
}

interface EmbeddingsResponse {
  data: Array<{ embedding: number[] }>;
  usage: { prompt_tokens: number };
}

export function createOpenAIProvider(client: OpenAI): OpenAIProvider {
  const transcribe: TranscribeFn = async (audio, opts, ctx) => {
    const request: Record<string, unknown> = {
      model: ctx.model,
      file: audio,
      response_format: 'verbose_json',
    };
    if (opts.language !== undefined) request['language'] = opts.language;
    if (opts.prompt !== undefined) request['prompt'] = opts.prompt;

    let response: WhisperResponse;
    try {
      response = (await client.audio.transcriptions.create(
        request as never,
      )) as unknown as WhisperResponse;
    } catch (err) {
      wrapError(err);
    }

    const segments: Segment[] = (response.segments ?? []).map((s) => ({
      start: s.start,
      end: s.end,
      text: s.text,
    }));
    const usage: Usage = { kind: 'audio', seconds: response.duration };
    return {
      text: response.text,
      segments,
      language: response.language,
      usage,
    };
  };

  const embed: EmbedFn = async (texts, ctx) => {
    let response: EmbeddingsResponse;
    try {
      response = (await client.embeddings.create({
        model: ctx.model,
        input: texts,
      } as never)) as unknown as EmbeddingsResponse;
    } catch (err) {
      wrapError(err);
    }
    const vectors = response.data.map((d) => d.embedding);
    const usage: Usage = {
      kind: 'embedding',
      inputTokens: response.usage.prompt_tokens,
      vectorCount: vectors.length,
    };
    return { vectors, usage };
  };

  return { transcribe, embed };
}
