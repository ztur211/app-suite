import type Anthropic from '@anthropic-ai/sdk';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodSchema } from 'zod';
import { ProviderError } from '../errors';
import type { ChatOpts, Message, SummaryFormat, Usage } from '../types';
import type {
  AnthropicProvider,
  ChatFn,
  ChatStructuredFn,
  OperationContext,
  SummarizeFn,
} from './types';
import { makeProviderErrorWrapper } from './_helpers';

const PROVIDER_ID = 'anthropic';
const wrapError: (err: unknown) => never = makeProviderErrorWrapper(PROVIDER_ID);

interface AnthropicMessagesUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

function mapUsage(u: AnthropicMessagesUsage): Usage {
  const usage: Usage = {
    kind: 'tokens',
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
  };
  if (u.cache_read_input_tokens !== undefined) {
    usage.cacheReadTokens = u.cache_read_input_tokens;
  }
  if (u.cache_creation_input_tokens !== undefined) {
    usage.cacheWriteTokens = u.cache_creation_input_tokens;
  }
  return usage;
}

function extractSystem(messages: Message[]): {
  system: string | undefined;
  rest: Array<{ role: 'user' | 'assistant'; content: string }>;
} {
  let system: string | undefined;
  const rest: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const m of messages) {
    if (m.role === 'system') {
      system = system === undefined ? m.content : `${system}\n\n${m.content}`;
    } else {
      rest.push({ role: m.role, content: m.content });
    }
  }
  return { system, rest };
}

export function createAnthropicProvider(client: Anthropic): AnthropicProvider {
  const chat: ChatFn = async (messages, opts, ctx) => {
    const { system, rest } = extractSystem(messages);
    const request: Record<string, unknown> = {
      model: ctx.model,
      max_tokens: opts.maxOutputTokens ?? 1024,
      messages: rest,
    };
    if (system !== undefined) {
      request['system'] = opts.cacheSystem
        ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
        : system;
    }
    if (opts.temperature !== undefined) request['temperature'] = opts.temperature;
    if (opts.stop && opts.stop.length > 0) request['stop_sequences'] = opts.stop;

    try {
      const response = (await client.messages.create(request as never)) as unknown as {
        content: Array<{ type: string; text?: string }>;
        usage: AnthropicMessagesUsage;
      };
      const textBlock = response.content.find((b) => b.type === 'text');
      const text = textBlock?.text ?? '';
      return { text, usage: mapUsage(response.usage) };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      wrapError(err);
    }
  };

  const summarize: SummarizeFn = async (text, format, ctx) => {
    const formatInstruction: Record<SummaryFormat, string> = {
      bullet: 'Respond with a concise bullet-point summary (5 bullets max).',
      paragraph: 'Respond with a single concise paragraph (≤ 5 sentences).',
      tldr: 'Respond with a one-sentence TL;DR.',
    };
    const result = await chat(
      [
        {
          role: 'system',
          content: `You summarize text. ${formatInstruction[format]}`,
        },
        { role: 'user', content: text },
      ],
      { maxOutputTokens: 512 },
      ctx,
    );
    return { summary: result.text, usage: result.usage };
  };

  const chatStructured: ChatStructuredFn = async <T>(
    schema: ZodSchema<T>,
    messages: Message[],
    opts: ChatOpts,
    ctx: OperationContext,
  ) => {
    const { system, rest } = extractSystem(messages);
    // Cast through `unknown` because zod-to-json-schema's generic constraints
    // collide with our ZodSchema<T> at deep type-instantiation depth.
    const convertSchema = zodToJsonSchema as unknown as (
      schema: unknown,
      opts: { target: 'openApi3' },
    ) => Record<string, unknown>;
    const jsonSchema = convertSchema(schema, { target: 'openApi3' });
    // Strip $schema/$ref roots from zod-to-json-schema output so Anthropic
    // gets a clean object schema with `type: 'object'` at the root.
    if (jsonSchema['$schema'] !== undefined) delete jsonSchema['$schema'];

    const tool = {
      name: 'respond',
      description: 'Return the structured response.',
      input_schema: jsonSchema,
    };
    const request: Record<string, unknown> = {
      model: ctx.model,
      max_tokens: opts.maxOutputTokens ?? 1024,
      messages: rest,
      tools: [tool],
      tool_choice: { type: 'tool', name: 'respond' },
    };
    if (system !== undefined) request['system'] = system;
    if (opts.temperature !== undefined) request['temperature'] = opts.temperature;

    let response: {
      content: Array<{ type: string; name?: string; input?: unknown }>;
      usage: AnthropicMessagesUsage;
    };
    try {
      response = (await client.messages.create(request as never)) as unknown as typeof response;
    } catch (err) {
      wrapError(err);
    }

    const toolBlock = response.content.find((b) => b.type === 'tool_use' && b.name === 'respond');
    if (!toolBlock) {
      throw new ProviderError({
        provider: PROVIDER_ID,
        message: 'expected tool_use response from model but got none',
      });
    }
    const parsed = schema.safeParse(toolBlock.input);
    if (!parsed.success) {
      throw new ProviderError({
        provider: PROVIDER_ID,
        message: `model tool input failed schema validation: ${parsed.error.message}`,
      });
    }
    return { value: parsed.data, usage: mapUsage(response.usage) };
  };

  return { chat, chatStructured, summarize };
}
