import type { GoogleGenerativeAI } from '@google/generative-ai';
import { ProviderError } from '../errors';
import type { ImageInput, Usage } from '../types';
import type { GoogleProvider, VisionFn } from './types';
import { makeProviderErrorWrapper } from './_helpers';

const PROVIDER_ID = 'google';
const wrapError: (err: unknown) => never = makeProviderErrorWrapper(PROVIDER_ID);

interface GoogleProviderOpts {
  /** Injectable for tests; defaults to global fetch. */
  fetch?: typeof fetch;
}

async function inlineImage(
  input: ImageInput,
  fetchImpl: typeof fetch,
): Promise<{ data: string; mimeType: string }> {
  if ('data' in input) {
    return {
      data: input.data.toString('base64'),
      mimeType: input.mimeType,
    };
  }
  let response: Response;
  try {
    response = await fetchImpl(input.url);
  } catch (err) {
    wrapError(err);
  }
  if (!response.ok) {
    throw new ProviderError({
      provider: PROVIDER_ID,
      status: response.status,
      message: `image fetch failed: ${response.statusText}`,
    });
  }
  const buf = Buffer.from(await response.arrayBuffer());
  const mimeType = response.headers.get('content-type') ?? 'application/octet-stream';
  return { data: buf.toString('base64'), mimeType };
}

interface GenerateContentResult {
  response: {
    text: () => string;
    usageMetadata?: {
      promptTokenCount: number;
      candidatesTokenCount: number;
    };
  };
}

export function createGoogleProvider(
  client: GoogleGenerativeAI,
  opts: GoogleProviderOpts = {},
): GoogleProvider {
  const fetchImpl = opts.fetch ?? fetch;

  const vision: VisionFn = async (imageOrUrl, prompt, ctx) => {
    const inline = await inlineImage(imageOrUrl, fetchImpl);
    const model = client.getGenerativeModel({ model: ctx.model });
    let result: GenerateContentResult;
    try {
      result = (await model.generateContent([
        prompt,
        { inlineData: { mimeType: inline.mimeType, data: inline.data } },
      ] as never)) as unknown as GenerateContentResult;
    } catch (err) {
      wrapError(err);
    }
    const text = result.response.text();
    const meta = result.response.usageMetadata;
    const usage: Usage = {
      kind: 'tokens',
      inputTokens: meta?.promptTokenCount ?? 0,
      outputTokens: meta?.candidatesTokenCount ?? 0,
    };
    return { text, usage };
  };

  return { vision };
}
