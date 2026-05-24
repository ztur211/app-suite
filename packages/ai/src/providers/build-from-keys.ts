import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createAnthropicProvider } from './anthropic';
import { createOpenAIProvider } from './openai';
import { createGoogleProvider } from './google';
import type { AnthropicProvider, GoogleProvider, OpenAIProvider } from './types';

export interface ProviderApiKeys {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  googleApiKey?: string;
}

export interface BuiltProviders {
  anthropic?: AnthropicProvider;
  openai?: OpenAIProvider;
  google?: GoogleProvider;
}

/**
 * Construct the three provider adapters from raw API keys. Each provider is
 * only built if its key is present; a route that needs an unbuilt provider
 * will fail with `RouteUnavailableError` at call time.
 */
export function buildProvidersFromKeys(keys: ProviderApiKeys): BuiltProviders {
  const built: BuiltProviders = {};
  if (keys.anthropicApiKey) {
    built.anthropic = createAnthropicProvider(new Anthropic({ apiKey: keys.anthropicApiKey }));
  }
  if (keys.openaiApiKey) {
    built.openai = createOpenAIProvider(new OpenAI({ apiKey: keys.openaiApiKey }));
  }
  if (keys.googleApiKey) {
    built.google = createGoogleProvider(new GoogleGenerativeAI(keys.googleApiKey));
  }
  return built;
}
