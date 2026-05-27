# P4 — `@things/ai` Router Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `@things/ai` package — a provider-agnostic AI client (`transcribe`, `chat`, `chatStructured`, `summarize`, `embed`, `vision`) that routes per-operation across Anthropic, OpenAI, and Google with retries/timeouts/fallback, injectable usage logging, and an ESLint rule pinning direct provider SDK use to `packages/ai/src/providers/`. Also adds the `AiCall` model to `things_auth` so consumer apps can persist usage rows.

**Architecture:** Three layers. (1) **Providers** — thin adapters in `packages/ai/src/providers/{anthropic,openai,google}.ts` that wrap each SDK and expose only the operations they implement. Provider factories take an SDK client instance so tests inject mocks (no `jest.mock`). (2) **Router** — a config object maps each operation to `{ primary, fallback? }` (provider id + model id). `executeRoute()` runs the primary with retries; on terminal failure runs the fallback with retries. (3) **Client facade** — `createAiClient()` returns an object implementing the `AiClient` interface from foundation spec §5.1; each method calls the router, times the call, and emits one `UsageLogEntry` to an injected `UsageLogger` (default no-op). Usage logging is injected (not a Prisma client owned by the package) so the package stays DB-free and easy to test; consumer NestJS apps pass a logger that writes to `things_auth.ai_calls` via their own Prisma client.

**Tech Stack:** TypeScript 5.6 strict, Jest 29 + ts-jest (unit only — no integration/e2e in P4; provider-network tests live as e2e stubs to be enabled later with API keys), `@anthropic-ai/sdk`, `openai`, `@google/generative-ai`, `zod`, `zod-to-json-schema` (for `chatStructured` tool-input schema conversion), Prisma 5 (for the `AiCall` table in `things_auth`).

---

## File Map

| Path                                                    | Action | Responsibility                                                                                                                                                   |
| ------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ai/package.json`                              | Modify | Add `@anthropic-ai/sdk`, `openai`, `@google/generative-ai`, `zod`, `zod-to-json-schema` deps                                                                     |
| `packages/ai/src/types.ts`                              | Create | Public types: `Message`, `ChatOpts`, `TranscribeOpts`, `SummaryFormat`, `Segment`, `Usage`, `ImageInput`, `AiClient`                                             |
| `packages/ai/src/errors.ts`                             | Create | `AiError`, `ProviderError`, `RetryExhaustedError`, `RouteUnavailableError`                                                                                       |
| `packages/ai/src/usage-logger.ts`                       | Create | `UsageLogger`, `UsageLogEntry`, `noopUsageLogger`                                                                                                                |
| `packages/ai/src/retry.ts`                              | Create | `retryWithBackoff(fn, opts)` — 2 retries, exponential backoff, transient-only                                                                                    |
| `packages/ai/src/providers/types.ts`                    | Create | `ProviderImpl` operation function signatures (`ChatFn`, `ChatStructuredFn`, `SummarizeFn`, `TranscribeFn`, `EmbedFn`, `VisionFn`)                                |
| `packages/ai/src/providers/anthropic.ts`                | Create | `createAnthropicProvider(client)` → `{ chat, chatStructured, summarize }`                                                                                        |
| `packages/ai/src/providers/openai.ts`                   | Create | `createOpenAIProvider(client)` → `{ transcribe, embed }`                                                                                                         |
| `packages/ai/src/providers/google.ts`                   | Create | `createGoogleProvider(genAI)` → `{ vision }`                                                                                                                     |
| `packages/ai/src/router.ts`                             | Create | `RouteConfig`, `defaultRouteConfig`, `executeRoute(routeEntry, fallback, runner)`                                                                                |
| `packages/ai/src/client.ts`                             | Create | `createAiClient({ providers, routes, usageLogger, timeoutMs, retry })` → `AiClient`                                                                              |
| `packages/ai/src/index.ts`                              | Modify | Replace smoke export with the public surface                                                                                                                     |
| `packages/ai/src/__tests__/smoke.test.ts`               | Modify | Update to assert the real public surface                                                                                                                         |
| `packages/ai/src/__tests__/retry.test.ts`               | Create | Backoff + transient classifier tests                                                                                                                             |
| `packages/ai/src/__tests__/router.test.ts`              | Create | Fallback-on-failure + retry composition tests                                                                                                                    |
| `packages/ai/src/__tests__/client.test.ts`              | Create | End-to-end facade tests with stub providers + capturing usage logger                                                                                             |
| `packages/ai/src/__tests__/providers/anthropic.test.ts` | Create | Anthropic provider unit tests (mock SDK client)                                                                                                                  |
| `packages/ai/src/__tests__/providers/openai.test.ts`    | Create | OpenAI provider unit tests (mock SDK client)                                                                                                                     |
| `packages/ai/src/__tests__/providers/google.test.ts`    | Create | Google provider unit tests (mock SDK client)                                                                                                                     |
| `eslint.config.mjs`                                     | Modify | Add `no-restricted-imports` rule banning provider SDKs outside `packages/ai/src/providers/`                                                                      |
| `apps/api-auth/prisma/schema.prisma`                    | Modify | Add `AiCall` model                                                                                                                                               |
| `apps/api-auth/.env.example`                            | Modify | Document `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY` as required by services that use `@things/ai` (informational; api-auth itself does not call AI) |

---

### Task 1: Install deps, scaffold provider directory

**Files:**

- Modify: `packages/ai/package.json`
- Create: `packages/ai/src/providers/.gitkeep` (placeholder so the directory exists before later tasks add files)

- [ ] **Step 1: Add runtime + dev deps to package.json**

Edit `packages/ai/package.json`. The full file becomes:

```json
{
  "name": "@things/ai",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "clean": "rimraf dist .tsbuildinfo",
    "lint": "eslint src --max-warnings 0",
    "test": "npm run test:unit",
    "test:unit": "jest --config jest.unit.config.ts",
    "test:integration": "jest --config jest.integration.config.ts --passWithNoTests",
    "test:e2e": "jest --config jest.e2e.config.ts --passWithNoTests",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.65.0",
    "@google/generative-ai": "^0.21.0",
    "openai": "^4.77.0",
    "zod": "^3.23.8",
    "zod-to-json-schema": "^3.23.5"
  },
  "devDependencies": {
    "@types/jest": "^29.5.13",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "ts-node": "^10.9.2",
    "typescript": "^5.6.2"
  }
}
```

- [ ] **Step 2: Install deps**

Run from repo root:

```powershell
npm install -w packages/ai
```

Expected: `package-lock.json` updates; `packages/ai/node_modules/@anthropic-ai/sdk`, `.../openai`, `.../@google/generative-ai`, `.../zod`, `.../zod-to-json-schema` exist.

- [ ] **Step 3: Create the providers directory placeholder**

```powershell
New-Item -ItemType Directory -Force packages/ai/src/providers | Out-Null
New-Item -ItemType File packages/ai/src/providers/.gitkeep | Out-Null
```

(The `.gitkeep` will be deleted in Task 6 when `anthropic.ts` lands; for now it ensures the directory exists for ESLint scoping experiments.)

- [ ] **Step 4: Confirm package still typechecks**

Run from repo root:

```powershell
npm run typecheck -w packages/ai
```

Expected: PASS (no source changes yet — only deps and an empty subdir).

- [ ] **Step 5: Commit**

```powershell
git add packages/ai/package.json package-lock.json packages/ai/src/providers/.gitkeep
git commit -m "chore(ai): add provider SDK deps + scaffold providers/ dir"
```

---

### Task 2: Public types

**Files:**

- Create: `packages/ai/src/types.ts`
- Create: `packages/ai/src/__tests__/types.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/ai/src/__tests__/types.test.ts`:

```ts
import type {
  Message,
  ChatOpts,
  TranscribeOpts,
  Segment,
  Usage,
  SummaryFormat,
  ImageInput,
  AiClient,
} from '../types';

describe('@things/ai public types', () => {
  it('Message accepts the three roles', () => {
    const messages: Message[] = [
      { role: 'system', content: 'you are helpful' },
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ];
    expect(messages).toHaveLength(3);
  });

  it('Usage is a discriminated union over tokens / audio / embedding', () => {
    const tokens: Usage = {
      kind: 'tokens',
      inputTokens: 10,
      outputTokens: 20,
    };
    const audio: Usage = { kind: 'audio', seconds: 12.5 };
    const embedding: Usage = {
      kind: 'embedding',
      inputTokens: 100,
      vectorCount: 4,
    };
    expect(tokens.kind).toBe('tokens');
    expect(audio.kind).toBe('audio');
    expect(embedding.kind).toBe('embedding');
  });

  it('ChatOpts accepts cacheSystem and maxOutputTokens', () => {
    const opts: ChatOpts = {
      cacheSystem: true,
      maxOutputTokens: 1024,
      temperature: 0.2,
    };
    expect(opts.cacheSystem).toBe(true);
  });

  it('TranscribeOpts accepts language and prompt', () => {
    const opts: TranscribeOpts = { language: 'en', prompt: 'meeting notes' };
    expect(opts.language).toBe('en');
  });

  it('Segment shape is { start, end, text }', () => {
    const seg: Segment = { start: 0, end: 1.2, text: 'hello' };
    expect(seg.text).toBe('hello');
  });

  it('SummaryFormat enumerates the allowed labels', () => {
    const formats: SummaryFormat[] = ['bullet', 'paragraph', 'tldr'];
    expect(formats).toHaveLength(3);
  });

  it('ImageInput accepts a url string or { data, mimeType }', () => {
    const url: ImageInput = { url: 'https://example.com/cat.png' };
    const data: ImageInput = {
      data: Buffer.from(''),
      mimeType: 'image/png',
    };
    expect('url' in url).toBe(true);
    expect('data' in data).toBe(true);
  });

  it('AiClient is the shape used by consumers', () => {
    // Type-level assertion: an object literal of the right shape should assign.
    const _stub: AiClient = {
      transcribe: async () => ({
        text: '',
        segments: [],
        language: 'en',
        usage: { kind: 'audio', seconds: 0 },
      }),
      chat: async () => ({
        text: '',
        usage: { kind: 'tokens', inputTokens: 0, outputTokens: 0 },
      }),
      chatStructured: async <T>() => ({
        value: undefined as unknown as T,
        usage: { kind: 'tokens', inputTokens: 0, outputTokens: 0 },
      }),
      summarize: async () => ({
        summary: '',
        usage: { kind: 'tokens', inputTokens: 0, outputTokens: 0 },
      }),
      embed: async () => ({
        vectors: [],
        usage: { kind: 'embedding', inputTokens: 0, vectorCount: 0 },
      }),
      vision: async () => ({
        text: '',
        usage: { kind: 'tokens', inputTokens: 0, outputTokens: 0 },
      }),
    };
    expect(typeof _stub.chat).toBe('function');
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

```powershell
npm run test:unit -w packages/ai -- --testPathPattern types.test
```

Expected: FAIL — `Cannot find module '../types'`.

- [ ] **Step 3: Create the types module**

Create `packages/ai/src/types.ts`:

```ts
import type { ZodSchema } from 'zod';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type Usage =
  | {
      kind: 'tokens';
      inputTokens: number;
      outputTokens: number;
      /** Anthropic prompt-caching only; absent when caching not used. */
      cacheReadTokens?: number;
      cacheWriteTokens?: number;
    }
  | {
      kind: 'audio';
      /** Total audio duration billed, in seconds. */
      seconds: number;
    }
  | {
      kind: 'embedding';
      inputTokens: number;
      vectorCount: number;
    };

export interface ChatOpts {
  /** Per-call override; otherwise router default. */
  model?: string;
  /** Enable Anthropic prompt caching of the system message. Default false. */
  cacheSystem?: boolean;
  /** Sampling temperature (0..1). Default per-provider. */
  temperature?: number;
  /** Hard cap on output tokens. Default 1024. */
  maxOutputTokens?: number;
  /** Per-call timeout override in ms. Default from client config. */
  timeoutMs?: number;
  /** Stop sequences forwarded to the provider where supported. */
  stop?: string[];
}

export interface TranscribeOpts {
  /** BCP-47 language tag (e.g. 'en'). Hints the transcriber. */
  language?: string;
  /** Domain-hint text fed to the model to bias the lexicon. */
  prompt?: string;
  /** Per-call timeout override in ms. */
  timeoutMs?: number;
}

export interface Segment {
  /** Start time within the audio, seconds. */
  start: number;
  /** End time within the audio, seconds. */
  end: number;
  text: string;
}

export type SummaryFormat = 'bullet' | 'paragraph' | 'tldr';

export type ImageInput = { url: string } | { data: Buffer; mimeType: string };

export interface AiClient {
  transcribe(
    audio: Buffer,
    opts?: TranscribeOpts,
  ): Promise<{
    text: string;
    segments: Segment[];
    language: string;
    usage: Usage;
  }>;

  chat(messages: Message[], opts?: ChatOpts): Promise<{ text: string; usage: Usage }>;

  chatStructured<T>(
    schema: ZodSchema<T>,
    messages: Message[],
    opts?: ChatOpts,
  ): Promise<{ value: T; usage: Usage }>;

  summarize(text: string, format: SummaryFormat): Promise<{ summary: string; usage: Usage }>;

  embed(texts: string[]): Promise<{ vectors: number[][]; usage: Usage }>;

  vision(imageOrUrl: ImageInput, prompt: string): Promise<{ text: string; usage: Usage }>;
}
```

- [ ] **Step 4: Run the test, confirm it passes**

```powershell
npm run test:unit -w packages/ai -- --testPathPattern types.test
```

Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```powershell
git add packages/ai/src/types.ts packages/ai/src/__tests__/types.test.ts
git commit -m "feat(ai): add public types (Message, Usage, AiClient, etc.)"
```

---

### Task 3: Errors

**Files:**

- Create: `packages/ai/src/errors.ts`
- Create: `packages/ai/src/__tests__/errors.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/ai/src/__tests__/errors.test.ts`:

```ts
import {
  AiError,
  ProviderError,
  RetryExhaustedError,
  RouteUnavailableError,
  isTransientProviderError,
} from '../errors';

describe('AI errors', () => {
  it('AiError sets name to AiError', () => {
    const e = new AiError('boom');
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('AiError');
    expect(e.message).toBe('boom');
  });

  it('ProviderError carries provider id, status, and cause', () => {
    const cause = new Error('network down');
    const e = new ProviderError({
      provider: 'anthropic',
      status: 429,
      message: 'rate limited',
      cause,
    });
    expect(e).toBeInstanceOf(AiError);
    expect(e.provider).toBe('anthropic');
    expect(e.status).toBe(429);
    expect(e.cause).toBe(cause);
    expect(e.message).toContain('anthropic');
    expect(e.message).toContain('429');
  });

  it('RetryExhaustedError records the attempt count and last error', () => {
    const last = new ProviderError({
      provider: 'openai',
      status: 503,
      message: 'unavailable',
    });
    const e = new RetryExhaustedError({ attempts: 3, lastError: last });
    expect(e).toBeInstanceOf(AiError);
    expect(e.attempts).toBe(3);
    expect(e.lastError).toBe(last);
  });

  it('RouteUnavailableError carries the operation name', () => {
    const e = new RouteUnavailableError('transcribe');
    expect(e).toBeInstanceOf(AiError);
    expect(e.operation).toBe('transcribe');
    expect(e.message).toContain('transcribe');
  });

  it('isTransientProviderError flags 429 and 5xx as transient', () => {
    const t429 = new ProviderError({
      provider: 'anthropic',
      status: 429,
      message: 'x',
    });
    const t500 = new ProviderError({
      provider: 'anthropic',
      status: 500,
      message: 'x',
    });
    const t503 = new ProviderError({
      provider: 'anthropic',
      status: 503,
      message: 'x',
    });
    expect(isTransientProviderError(t429)).toBe(true);
    expect(isTransientProviderError(t500)).toBe(true);
    expect(isTransientProviderError(t503)).toBe(true);
  });

  it('isTransientProviderError flags 400/401/403/404 as non-transient', () => {
    for (const status of [400, 401, 403, 404]) {
      const e = new ProviderError({ provider: 'openai', status, message: 'x' });
      expect(isTransientProviderError(e)).toBe(false);
    }
  });

  it('isTransientProviderError treats network errors (no status) as transient', () => {
    const e = new ProviderError({
      provider: 'google',
      message: 'ECONNRESET',
    });
    expect(isTransientProviderError(e)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

```powershell
npm run test:unit -w packages/ai -- --testPathPattern errors.test
```

Expected: FAIL — `Cannot find module '../errors'`.

- [ ] **Step 3: Create the errors module**

Create `packages/ai/src/errors.ts`:

```ts
export class AiError extends Error {
  constructor(message: string, opts?: { cause?: unknown }) {
    super(message);
    this.name = 'AiError';
    if (opts?.cause !== undefined) {
      (this as { cause?: unknown }).cause = opts.cause;
    }
  }
}

export interface ProviderErrorInit {
  provider: string;
  /** HTTP status if available; absent for network errors. */
  status?: number;
  message: string;
  cause?: unknown;
}

export class ProviderError extends AiError {
  readonly provider: string;
  readonly status: number | undefined;

  constructor(init: ProviderErrorInit) {
    const statusPart = init.status === undefined ? '' : ` [${init.status}]`;
    super(`${init.provider}${statusPart}: ${init.message}`, { cause: init.cause });
    this.name = 'ProviderError';
    this.provider = init.provider;
    this.status = init.status;
  }
}

export interface RetryExhaustedInit {
  attempts: number;
  lastError: Error;
}

export class RetryExhaustedError extends AiError {
  readonly attempts: number;
  readonly lastError: Error;

  constructor(init: RetryExhaustedInit) {
    super(`retry exhausted after ${init.attempts} attempts: ${init.lastError.message}`, {
      cause: init.lastError,
    });
    this.name = 'RetryExhaustedError';
    this.attempts = init.attempts;
    this.lastError = init.lastError;
  }
}

export class RouteUnavailableError extends AiError {
  readonly operation: string;

  constructor(operation: string) {
    super(`no provider route configured for operation "${operation}"`);
    this.name = 'RouteUnavailableError';
    this.operation = operation;
  }
}

export function isTransientProviderError(err: unknown): boolean {
  if (!(err instanceof ProviderError)) return false;
  // Network errors have no status — treat as transient.
  if (err.status === undefined) return true;
  // Rate limits and server errors are transient.
  if (err.status === 429) return true;
  if (err.status >= 500 && err.status < 600) return true;
  return false;
}
```

- [ ] **Step 4: Run the test, confirm it passes**

```powershell
npm run test:unit -w packages/ai -- --testPathPattern errors.test
```

Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```powershell
git add packages/ai/src/errors.ts packages/ai/src/__tests__/errors.test.ts
git commit -m "feat(ai): add AiError hierarchy + transient-error classifier"
```

---

### Task 4: Retry helper

**Files:**

- Create: `packages/ai/src/retry.ts`
- Create: `packages/ai/src/__tests__/retry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/ai/src/__tests__/retry.test.ts`:

```ts
import { retryWithBackoff } from '../retry';
import { ProviderError, RetryExhaustedError } from '../errors';

describe('retryWithBackoff', () => {
  it('returns the value on first success without sleeping', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const sleep = jest.fn().mockResolvedValue(undefined);
    const result = await retryWithBackoff(fn, {
      maxRetries: 2,
      baseDelayMs: 100,
      sleep,
    });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries on transient ProviderError up to maxRetries', async () => {
    const transient = new ProviderError({
      provider: 'anthropic',
      status: 503,
      message: 'x',
    });
    const fn = jest
      .fn()
      .mockRejectedValueOnce(transient)
      .mockRejectedValueOnce(transient)
      .mockResolvedValueOnce('ok');
    const sleep = jest.fn().mockResolvedValue(undefined);
    const result = await retryWithBackoff(fn, {
      maxRetries: 2,
      baseDelayMs: 50,
      sleep,
    });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('uses exponential backoff (base, base*2, base*4, ...)', async () => {
    const transient = new ProviderError({
      provider: 'anthropic',
      status: 500,
      message: 'x',
    });
    const fn = jest
      .fn()
      .mockRejectedValueOnce(transient)
      .mockRejectedValueOnce(transient)
      .mockResolvedValueOnce('ok');
    const sleep = jest.fn().mockResolvedValue(undefined);
    await retryWithBackoff(fn, {
      maxRetries: 2,
      baseDelayMs: 50,
      sleep,
    });
    expect(sleep).toHaveBeenNthCalledWith(1, 50);
    expect(sleep).toHaveBeenNthCalledWith(2, 100);
  });

  it('throws RetryExhaustedError after maxRetries transient failures', async () => {
    const transient = new ProviderError({
      provider: 'openai',
      status: 503,
      message: 'unavail',
    });
    const fn = jest.fn().mockRejectedValue(transient);
    const sleep = jest.fn().mockResolvedValue(undefined);
    await expect(
      retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 1, sleep }),
    ).rejects.toBeInstanceOf(RetryExhaustedError);
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('does not retry on non-transient ProviderError', async () => {
    const nonTransient = new ProviderError({
      provider: 'openai',
      status: 401,
      message: 'bad key',
    });
    const fn = jest.fn().mockRejectedValue(nonTransient);
    const sleep = jest.fn().mockResolvedValue(undefined);
    await expect(retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 1, sleep })).rejects.toBe(
      nonTransient,
    );
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('does not retry on non-provider errors', async () => {
    const bug = new TypeError('coding bug');
    const fn = jest.fn().mockRejectedValue(bug);
    await expect(
      retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 1, sleep: jest.fn() }),
    ).rejects.toBe(bug);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

```powershell
npm run test:unit -w packages/ai -- --testPathPattern retry.test
```

Expected: FAIL — `Cannot find module '../retry'`.

- [ ] **Step 3: Create the retry module**

Create `packages/ai/src/retry.ts`:

```ts
import { RetryExhaustedError, isTransientProviderError } from './errors';

export interface RetryOpts {
  /** Number of retries after the initial attempt. Default 2. */
  maxRetries?: number;
  /** First-retry delay in ms. Doubles each subsequent retry. Default 250. */
  baseDelayMs?: number;
  /** Injectable for tests; default is setTimeout-based. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function retryWithBackoff<T>(fn: () => Promise<T>, opts: RetryOpts = {}): Promise<T> {
  const maxRetries = opts.maxRetries ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 250;
  const sleep = opts.sleep ?? defaultSleep;

  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof Error)) throw err;
      // Only retry on transient provider errors.
      if (!isTransientProviderError(err)) throw err;
      lastError = err;
      if (attempt === maxRetries) break;
      const delay = baseDelayMs * Math.pow(2, attempt);
      await sleep(delay);
    }
  }
  // lastError is guaranteed to be set because we only reach here after at
  // least one caught transient error (otherwise we'd have returned above).
  throw new RetryExhaustedError({
    attempts: maxRetries + 1,
    lastError: lastError as Error,
  });
}
```

- [ ] **Step 4: Run the test, confirm it passes**

```powershell
npm run test:unit -w packages/ai -- --testPathPattern retry.test
```

Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```powershell
git add packages/ai/src/retry.ts packages/ai/src/__tests__/retry.test.ts
git commit -m "feat(ai): add retryWithBackoff with transient-only retry policy"
```

---

### Task 5: UsageLogger

**Files:**

- Create: `packages/ai/src/usage-logger.ts`
- Create: `packages/ai/src/__tests__/usage-logger.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/ai/src/__tests__/usage-logger.test.ts`:

```ts
import { noopUsageLogger } from '../usage-logger';
import type { UsageLogEntry, UsageLogger } from '../usage-logger';

describe('UsageLogger', () => {
  it('noopUsageLogger resolves without doing anything observable', async () => {
    const entry: UsageLogEntry = {
      operation: 'chat',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      usage: { kind: 'tokens', inputTokens: 1, outputTokens: 1 },
      startedAt: new Date('2026-05-23T00:00:00Z'),
      durationMs: 42,
    };
    await expect(noopUsageLogger(entry)).resolves.toBeUndefined();
  });

  it('UsageLogger is a function type that returns a Promise<void>', async () => {
    const calls: UsageLogEntry[] = [];
    const logger: UsageLogger = async (e) => {
      calls.push(e);
    };
    await logger({
      operation: 'transcribe',
      provider: 'openai',
      model: 'whisper-1',
      usage: { kind: 'audio', seconds: 10 },
      startedAt: new Date(),
      durationMs: 1234,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.operation).toBe('transcribe');
  });

  it('UsageLogEntry supports the fellBackTo field for fallback calls', async () => {
    const calls: UsageLogEntry[] = [];
    const logger: UsageLogger = async (e) => {
      calls.push(e);
    };
    await logger({
      operation: 'chat',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      usage: { kind: 'tokens', inputTokens: 100, outputTokens: 200 },
      startedAt: new Date(),
      durationMs: 800,
      fellBackTo: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    });
    expect(calls[0]?.fellBackTo).toEqual({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
    });
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

```powershell
npm run test:unit -w packages/ai -- --testPathPattern usage-logger.test
```

Expected: FAIL — `Cannot find module '../usage-logger'`.

- [ ] **Step 3: Create the usage-logger module**

Create `packages/ai/src/usage-logger.ts`:

```ts
import type { Usage } from './types';

export type AiOperation =
  | 'chat'
  | 'chatStructured'
  | 'summarize'
  | 'transcribe'
  | 'embed'
  | 'vision';

export interface UsageLogEntry {
  operation: AiOperation;
  provider: string;
  model: string;
  usage: Usage;
  /** Set by the caller's NestJS request context; absent for system calls. */
  userId?: string;
  /** Calling app (e.g. 'api-say'); set by the caller's context. */
  callerApp?: string;
  startedAt: Date;
  durationMs: number;
  /** If the primary route failed and the call ended up on the fallback. */
  fellBackTo?: { provider: string; model: string };
}

export type UsageLogger = (entry: UsageLogEntry) => Promise<void>;

export const noopUsageLogger: UsageLogger = async () => {
  // intentional no-op
};
```

- [ ] **Step 4: Run the test, confirm it passes**

```powershell
npm run test:unit -w packages/ai -- --testPathPattern usage-logger.test
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```powershell
git add packages/ai/src/usage-logger.ts packages/ai/src/__tests__/usage-logger.test.ts
git commit -m "feat(ai): add UsageLogger interface and no-op default"
```

---

### Task 6: Provider operation signatures + Anthropic provider

**Files:**

- Create: `packages/ai/src/providers/types.ts`
- Create: `packages/ai/src/providers/anthropic.ts`
- Create: `packages/ai/src/__tests__/providers/anthropic.test.ts`
- Delete: `packages/ai/src/providers/.gitkeep` (replaced by real files)

- [ ] **Step 1: Define the provider operation signatures**

Create `packages/ai/src/providers/types.ts`:

```ts
import type { ZodSchema } from 'zod';
import type {
  ChatOpts,
  ImageInput,
  Message,
  Segment,
  SummaryFormat,
  TranscribeOpts,
  Usage,
} from '../types';

export interface OperationContext {
  /** Per-call timeout from client config; provider may pass to its SDK. */
  timeoutMs: number;
  /** The model id this operation should run on (selected by the router). */
  model: string;
}

export type ChatFn = (
  messages: Message[],
  opts: ChatOpts,
  ctx: OperationContext,
) => Promise<{ text: string; usage: Usage }>;

export type ChatStructuredFn = <T>(
  schema: ZodSchema<T>,
  messages: Message[],
  opts: ChatOpts,
  ctx: OperationContext,
) => Promise<{ value: T; usage: Usage }>;

export type SummarizeFn = (
  text: string,
  format: SummaryFormat,
  ctx: OperationContext,
) => Promise<{ summary: string; usage: Usage }>;

export type TranscribeFn = (
  audio: Buffer,
  opts: TranscribeOpts,
  ctx: OperationContext,
) => Promise<{
  text: string;
  segments: Segment[];
  language: string;
  usage: Usage;
}>;

export type EmbedFn = (
  texts: string[],
  ctx: OperationContext,
) => Promise<{ vectors: number[][]; usage: Usage }>;

export type VisionFn = (
  imageOrUrl: ImageInput,
  prompt: string,
  ctx: OperationContext,
) => Promise<{ text: string; usage: Usage }>;

export interface AnthropicProvider {
  chat: ChatFn;
  chatStructured: ChatStructuredFn;
  summarize: SummarizeFn;
}

export interface OpenAIProvider {
  transcribe: TranscribeFn;
  embed: EmbedFn;
}

export interface GoogleProvider {
  vision: VisionFn;
}
```

- [ ] **Step 2: Write the failing test for the Anthropic provider**

Create `packages/ai/src/__tests__/providers/anthropic.test.ts`:

```ts
import { z } from 'zod';
import { createAnthropicProvider } from '../../providers/anthropic';
import { ProviderError } from '../../errors';

interface FakeAnthropicClient {
  messages: {
    create: jest.Mock;
  };
}

function makeClient(): FakeAnthropicClient {
  return { messages: { create: jest.fn() } };
}

const ctx = { timeoutMs: 30000, model: 'claude-haiku-4-5-20251001' };

describe('createAnthropicProvider', () => {
  describe('chat', () => {
    it('sends system + user messages and returns text + token usage', async () => {
      const client = makeClient();
      client.messages.create.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'hi back' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });
      const provider = createAnthropicProvider(client as unknown as never);
      const result = await provider.chat(
        [
          { role: 'system', content: 'you are helpful' },
          { role: 'user', content: 'hi' },
        ],
        {},
        ctx,
      );
      expect(result.text).toBe('hi back');
      expect(result.usage).toEqual({
        kind: 'tokens',
        inputTokens: 10,
        outputTokens: 5,
      });
      expect(client.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-haiku-4-5-20251001',
          system: 'you are helpful',
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 1024,
        }),
      );
    });

    it('opts.cacheSystem wraps the system message with cache_control', async () => {
      const client = makeClient();
      client.messages.create.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'ok' }],
        usage: {
          input_tokens: 5,
          output_tokens: 2,
          cache_read_input_tokens: 100,
          cache_creation_input_tokens: 50,
        },
      });
      const provider = createAnthropicProvider(client as unknown as never);
      const result = await provider.chat(
        [
          { role: 'system', content: 'long system prompt' },
          { role: 'user', content: 'q' },
        ],
        { cacheSystem: true },
        ctx,
      );
      expect(client.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          system: [
            { type: 'text', text: 'long system prompt', cache_control: { type: 'ephemeral' } },
          ],
        }),
      );
      expect(result.usage).toEqual({
        kind: 'tokens',
        inputTokens: 5,
        outputTokens: 2,
        cacheReadTokens: 100,
        cacheWriteTokens: 50,
      });
    });

    it('passes temperature, maxOutputTokens, and stop sequences through', async () => {
      const client = makeClient();
      client.messages.create.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'ok' }],
        usage: { input_tokens: 1, output_tokens: 1 },
      });
      const provider = createAnthropicProvider(client as unknown as never);
      await provider.chat(
        [{ role: 'user', content: 'q' }],
        { temperature: 0.7, maxOutputTokens: 256, stop: ['END'] },
        ctx,
      );
      expect(client.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
          max_tokens: 256,
          stop_sequences: ['END'],
        }),
      );
    });

    it('wraps SDK errors in ProviderError with status and provider id', async () => {
      const client = makeClient();
      const sdkErr = Object.assign(new Error('rate limited'), { status: 429 });
      client.messages.create.mockRejectedValueOnce(sdkErr);
      const provider = createAnthropicProvider(client as unknown as never);
      await expect(provider.chat([{ role: 'user', content: 'x' }], {}, ctx)).rejects.toMatchObject({
        provider: 'anthropic',
        status: 429,
      });
      await expect(provider.chat([{ role: 'user', content: 'x' }], {}, ctx)).rejects.toBeInstanceOf(
        ProviderError,
      );
    });
  });

  describe('summarize', () => {
    it('produces a summary using the requested format', async () => {
      const client = makeClient();
      client.messages.create.mockResolvedValueOnce({
        content: [{ type: 'text', text: '- bullet one\n- bullet two' }],
        usage: { input_tokens: 50, output_tokens: 8 },
      });
      const provider = createAnthropicProvider(client as unknown as never);
      const result = await provider.summarize('long text body', 'bullet', ctx);
      expect(result.summary).toBe('- bullet one\n- bullet two');
      // Verify the system prompt mentions the format so the model knows what to do.
      const args = client.messages.create.mock.calls[0]?.[0] as {
        system: string;
      };
      expect(args.system).toMatch(/bullet/i);
    });
  });

  describe('chatStructured', () => {
    const schema = z.object({
      title: z.string(),
      priority: z.enum(['low', 'high']),
    });

    it('uses tool-use with a single tool whose input schema matches the Zod schema', async () => {
      const client = makeClient();
      client.messages.create.mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            name: 'respond',
            input: { title: 'buy milk', priority: 'high' },
          },
        ],
        usage: { input_tokens: 20, output_tokens: 10 },
      });
      const provider = createAnthropicProvider(client as unknown as never);
      const result = await provider.chatStructured(
        schema,
        [{ role: 'user', content: 'extract' }],
        {},
        ctx,
      );
      expect(result.value).toEqual({ title: 'buy milk', priority: 'high' });
      const args = client.messages.create.mock.calls[0]?.[0] as {
        tools: Array<{ name: string; input_schema: { type: string } }>;
        tool_choice: { type: string; name: string };
      };
      expect(args.tools).toHaveLength(1);
      expect(args.tools[0]?.name).toBe('respond');
      expect(args.tools[0]?.input_schema.type).toBe('object');
      expect(args.tool_choice).toEqual({ type: 'tool', name: 'respond' });
    });

    it('throws ProviderError if the model returns content of the wrong shape', async () => {
      const client = makeClient();
      client.messages.create.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'sorry, not a tool call' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });
      const provider = createAnthropicProvider(client as unknown as never);
      await expect(
        provider.chatStructured(schema, [{ role: 'user', content: 'x' }], {}, ctx),
      ).rejects.toMatchObject({ provider: 'anthropic' });
    });

    it('throws ProviderError if the tool input fails Zod validation', async () => {
      const client = makeClient();
      client.messages.create.mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            name: 'respond',
            input: { title: 'buy milk', priority: 'bogus' },
          },
        ],
        usage: { input_tokens: 10, output_tokens: 5 },
      });
      const provider = createAnthropicProvider(client as unknown as never);
      await expect(
        provider.chatStructured(schema, [{ role: 'user', content: 'x' }], {}, ctx),
      ).rejects.toMatchObject({ provider: 'anthropic' });
    });
  });
});
```

- [ ] **Step 3: Run the test, confirm it fails**

```powershell
npm run test:unit -w packages/ai -- --testPathPattern providers/anthropic.test
```

Expected: FAIL — `Cannot find module '../../providers/anthropic'`.

- [ ] **Step 4: Implement the Anthropic provider**

Delete the placeholder:

```powershell
Remove-Item packages/ai/src/providers/.gitkeep
```

Create `packages/ai/src/providers/anthropic.ts`:

```ts
import type Anthropic from '@anthropic-ai/sdk';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodSchema } from 'zod';
import { ProviderError } from '../errors';
import type { Message, SummaryFormat, Usage } from '../types';
import type { AnthropicProvider, ChatFn, ChatStructuredFn, SummarizeFn } from './types';

const PROVIDER_ID = 'anthropic';

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

function wrapError(err: unknown): never {
  if (err instanceof Error) {
    const status = (err as { status?: number }).status;
    throw new ProviderError({
      provider: PROVIDER_ID,
      status,
      message: err.message,
      cause: err,
    });
  }
  throw new ProviderError({
    provider: PROVIDER_ID,
    message: String(err),
    cause: err,
  });
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

    let response: {
      content: Array<{ type: string; text?: string }>;
      usage: AnthropicMessagesUsage;
    };
    try {
      response = (await client.messages.create(request as never)) as unknown as typeof response;
    } catch (err) {
      wrapError(err);
    }

    const textBlock = response.content.find((b) => b.type === 'text');
    const text = textBlock?.text ?? '';
    return { text, usage: mapUsage(response.usage) };
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
    opts: { temperature?: number; maxOutputTokens?: number },
    ctx: { model: string; timeoutMs: number },
  ) => {
    const { system, rest } = extractSystem(messages);
    const jsonSchema = zodToJsonSchema(schema, { target: 'openApi3' }) as Record<string, unknown>;
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
```

- [ ] **Step 5: Run the test, confirm it passes**

```powershell
npm run test:unit -w packages/ai -- --testPathPattern providers/anthropic.test
```

Expected: PASS (all anthropic tests).

- [ ] **Step 6: Commit**

```powershell
git add packages/ai/src/providers/types.ts packages/ai/src/providers/anthropic.ts packages/ai/src/__tests__/providers/anthropic.test.ts
git rm packages/ai/src/providers/.gitkeep
git commit -m "feat(ai): add Anthropic provider (chat, summarize, chatStructured)"
```

---

### Task 7: OpenAI provider (transcribe + embed)

**Files:**

- Create: `packages/ai/src/providers/openai.ts`
- Create: `packages/ai/src/__tests__/providers/openai.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/ai/src/__tests__/providers/openai.test.ts`:

```ts
import { createOpenAIProvider } from '../../providers/openai';
import { ProviderError } from '../../errors';

interface FakeOpenAIClient {
  audio: {
    transcriptions: {
      create: jest.Mock;
    };
  };
  embeddings: {
    create: jest.Mock;
  };
}

function makeClient(): FakeOpenAIClient {
  return {
    audio: { transcriptions: { create: jest.fn() } },
    embeddings: { create: jest.fn() },
  };
}

const transcribeCtx = { timeoutMs: 60000, model: 'whisper-1' };
const embedCtx = { timeoutMs: 30000, model: 'text-embedding-3-small' };

describe('createOpenAIProvider', () => {
  describe('transcribe', () => {
    it('returns text, segments, language, and audio usage', async () => {
      const client = makeClient();
      client.audio.transcriptions.create.mockResolvedValueOnce({
        text: 'hello world',
        language: 'english',
        duration: 12.5,
        segments: [
          { start: 0, end: 1.2, text: 'hello' },
          { start: 1.2, end: 2.5, text: 'world' },
        ],
      });
      const provider = createOpenAIProvider(client as unknown as never);
      const result = await provider.transcribe(
        Buffer.from('fake-audio-bytes'),
        { language: 'en' },
        transcribeCtx,
      );
      expect(result.text).toBe('hello world');
      expect(result.language).toBe('english');
      expect(result.segments).toEqual([
        { start: 0, end: 1.2, text: 'hello' },
        { start: 1.2, end: 2.5, text: 'world' },
      ]);
      expect(result.usage).toEqual({ kind: 'audio', seconds: 12.5 });
    });

    it('requests verbose_json so segments come back', async () => {
      const client = makeClient();
      client.audio.transcriptions.create.mockResolvedValueOnce({
        text: '',
        language: 'en',
        duration: 0,
        segments: [],
      });
      const provider = createOpenAIProvider(client as unknown as never);
      await provider.transcribe(Buffer.from('x'), {}, transcribeCtx);
      const args = client.audio.transcriptions.create.mock.calls[0]?.[0] as {
        model: string;
        response_format: string;
      };
      expect(args.model).toBe('whisper-1');
      expect(args.response_format).toBe('verbose_json');
    });

    it('passes language and prompt hints when provided', async () => {
      const client = makeClient();
      client.audio.transcriptions.create.mockResolvedValueOnce({
        text: '',
        language: 'en',
        duration: 0,
        segments: [],
      });
      const provider = createOpenAIProvider(client as unknown as never);
      await provider.transcribe(
        Buffer.from('x'),
        { language: 'es', prompt: 'medical terms' },
        transcribeCtx,
      );
      const args = client.audio.transcriptions.create.mock.calls[0]?.[0] as {
        language: string;
        prompt: string;
      };
      expect(args.language).toBe('es');
      expect(args.prompt).toBe('medical terms');
    });

    it('wraps SDK errors in ProviderError', async () => {
      const client = makeClient();
      client.audio.transcriptions.create.mockRejectedValueOnce(
        Object.assign(new Error('bad'), { status: 500 }),
      );
      const provider = createOpenAIProvider(client as unknown as never);
      await expect(provider.transcribe(Buffer.from('x'), {}, transcribeCtx)).rejects.toBeInstanceOf(
        ProviderError,
      );
    });
  });

  describe('embed', () => {
    it('returns one vector per input + token usage', async () => {
      const client = makeClient();
      client.embeddings.create.mockResolvedValueOnce({
        data: [{ embedding: [0.1, 0.2, 0.3] }, { embedding: [0.4, 0.5, 0.6] }],
        usage: { prompt_tokens: 7 },
      });
      const provider = createOpenAIProvider(client as unknown as never);
      const result = await provider.embed(['hello', 'world'], embedCtx);
      expect(result.vectors).toEqual([
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ]);
      expect(result.usage).toEqual({
        kind: 'embedding',
        inputTokens: 7,
        vectorCount: 2,
      });
    });

    it('sends the model and the inputs', async () => {
      const client = makeClient();
      client.embeddings.create.mockResolvedValueOnce({
        data: [{ embedding: [0] }],
        usage: { prompt_tokens: 1 },
      });
      const provider = createOpenAIProvider(client as unknown as never);
      await provider.embed(['a'], embedCtx);
      expect(client.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: ['a'],
      });
    });

    it('wraps SDK errors in ProviderError', async () => {
      const client = makeClient();
      client.embeddings.create.mockRejectedValueOnce(
        Object.assign(new Error('oops'), { status: 401 }),
      );
      const provider = createOpenAIProvider(client as unknown as never);
      await expect(provider.embed(['x'], embedCtx)).rejects.toMatchObject({
        provider: 'openai',
        status: 401,
      });
    });
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

```powershell
npm run test:unit -w packages/ai -- --testPathPattern providers/openai.test
```

Expected: FAIL — `Cannot find module '../../providers/openai'`.

- [ ] **Step 3: Implement the OpenAI provider**

Create `packages/ai/src/providers/openai.ts`:

```ts
import type OpenAI from 'openai';
import { ProviderError } from '../errors';
import type { Segment, Usage } from '../types';
import type { EmbedFn, OpenAIProvider, TranscribeFn } from './types';

const PROVIDER_ID = 'openai';

function wrapError(err: unknown): never {
  if (err instanceof Error) {
    const status = (err as { status?: number }).status;
    throw new ProviderError({
      provider: PROVIDER_ID,
      status,
      message: err.message,
      cause: err,
    });
  }
  throw new ProviderError({
    provider: PROVIDER_ID,
    message: String(err),
    cause: err,
  });
}

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
```

- [ ] **Step 4: Run the test, confirm it passes**

```powershell
npm run test:unit -w packages/ai -- --testPathPattern providers/openai.test
```

Expected: PASS (all openai tests).

- [ ] **Step 5: Commit**

```powershell
git add packages/ai/src/providers/openai.ts packages/ai/src/__tests__/providers/openai.test.ts
git commit -m "feat(ai): add OpenAI provider (Whisper transcribe + embeddings)"
```

---

### Task 8: Google provider (vision)

**Files:**

- Create: `packages/ai/src/providers/google.ts`
- Create: `packages/ai/src/__tests__/providers/google.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/ai/src/__tests__/providers/google.test.ts`:

```ts
import { createGoogleProvider } from '../../providers/google';
import { ProviderError } from '../../errors';

interface FakeGenerativeModel {
  generateContent: jest.Mock;
}

interface FakeGoogleClient {
  getGenerativeModel: jest.Mock<FakeGenerativeModel, [{ model: string }]>;
}

function makeClient(): { client: FakeGoogleClient; model: FakeGenerativeModel } {
  const model: FakeGenerativeModel = { generateContent: jest.fn() };
  const client: FakeGoogleClient = {
    getGenerativeModel: jest.fn().mockReturnValue(model),
  };
  return { client, model };
}

const ctx = { timeoutMs: 30000, model: 'gemini-2.5-flash' };

describe('createGoogleProvider', () => {
  it('describes an image from a URL (fetches and inlines as base64)', async () => {
    const { client, model } = makeClient();
    model.generateContent.mockResolvedValueOnce({
      response: {
        text: () => 'a fluffy cat',
        usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 5 },
      },
    });
    const fetchMock = jest.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      headers: new Headers({ 'content-type': 'image/png' }),
    });
    const provider = createGoogleProvider(client as unknown as never, {
      fetch: fetchMock as unknown as typeof fetch,
    });
    const result = await provider.vision(
      { url: 'https://example.com/cat.png' },
      'what is this',
      ctx,
    );
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/cat.png');
    expect(client.getGenerativeModel).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash',
    });
    expect(result.text).toBe('a fluffy cat');
    expect(result.usage).toEqual({
      kind: 'tokens',
      inputTokens: 50,
      outputTokens: 5,
    });
    const args = model.generateContent.mock.calls[0]?.[0] as Array<unknown>;
    // First arg: prompt; second arg: inlineData
    expect(args[0]).toBe('what is this');
    expect(args[1]).toMatchObject({
      inlineData: {
        mimeType: 'image/png',
        // base64 of [1,2,3,4]
        data: Buffer.from([1, 2, 3, 4]).toString('base64'),
      },
    });
  });

  it('describes an image from raw bytes', async () => {
    const { client, model } = makeClient();
    model.generateContent.mockResolvedValueOnce({
      response: {
        text: () => 'description',
        usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 2 },
      },
    });
    const fetchMock = jest.fn();
    const provider = createGoogleProvider(client as unknown as never, {
      fetch: fetchMock as unknown as typeof fetch,
    });
    const result = await provider.vision(
      { data: Buffer.from([9, 9]), mimeType: 'image/jpeg' },
      'caption it',
      ctx,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.text).toBe('description');
    const args = model.generateContent.mock.calls[0]?.[0] as Array<unknown>;
    expect(args[1]).toMatchObject({
      inlineData: {
        mimeType: 'image/jpeg',
        data: Buffer.from([9, 9]).toString('base64'),
      },
    });
  });

  it('wraps SDK errors in ProviderError', async () => {
    const { client, model } = makeClient();
    model.generateContent.mockRejectedValueOnce(Object.assign(new Error('quota'), { status: 429 }));
    const provider = createGoogleProvider(client as unknown as never);
    await expect(
      provider.vision({ data: Buffer.from([0]), mimeType: 'image/png' }, 'q', ctx),
    ).rejects.toMatchObject({ provider: 'google', status: 429 });
  });

  it('throws ProviderError when image URL fetch fails', async () => {
    const { client } = makeClient();
    const fetchMock = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'not found',
    });
    const provider = createGoogleProvider(client as unknown as never, {
      fetch: fetchMock as unknown as typeof fetch,
    });
    await expect(
      provider.vision({ url: 'https://example.com/x.png' }, 'q', ctx),
    ).rejects.toBeInstanceOf(ProviderError);
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

```powershell
npm run test:unit -w packages/ai -- --testPathPattern providers/google.test
```

Expected: FAIL — `Cannot find module '../../providers/google'`.

- [ ] **Step 3: Implement the Google provider**

Create `packages/ai/src/providers/google.ts`:

```ts
import type { GoogleGenerativeAI } from '@google/generative-ai';
import { ProviderError } from '../errors';
import type { ImageInput, Usage } from '../types';
import type { GoogleProvider, VisionFn } from './types';

const PROVIDER_ID = 'google';

interface GoogleProviderOpts {
  /** Injectable for tests; defaults to global fetch. */
  fetch?: typeof fetch;
}

function wrapError(err: unknown): never {
  if (err instanceof Error) {
    const status = (err as { status?: number }).status;
    throw new ProviderError({
      provider: PROVIDER_ID,
      status,
      message: err.message,
      cause: err,
    });
  }
  throw new ProviderError({
    provider: PROVIDER_ID,
    message: String(err),
    cause: err,
  });
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
```

- [ ] **Step 4: Run the test, confirm it passes**

```powershell
npm run test:unit -w packages/ai -- --testPathPattern providers/google.test
```

Expected: PASS (all google tests).

- [ ] **Step 5: Commit**

```powershell
git add packages/ai/src/providers/google.ts packages/ai/src/__tests__/providers/google.test.ts
git commit -m "feat(ai): add Google provider (Gemini vision)"
```

---

### Task 9: Router with fallback policy

**Files:**

- Create: `packages/ai/src/router.ts`
- Create: `packages/ai/src/__tests__/router.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/ai/src/__tests__/router.test.ts`:

```ts
import { defaultRouteConfig, executeRoute } from '../router';
import { ProviderError } from '../errors';

describe('defaultRouteConfig', () => {
  it('defines every operation with at least a primary', () => {
    const ops: Array<keyof typeof defaultRouteConfig> = [
      'chat',
      'chatStructured',
      'summarize',
      'transcribe',
      'embed',
      'vision',
    ];
    for (const op of ops) {
      const entry = defaultRouteConfig[op];
      expect(entry.primary.provider).toBeDefined();
      expect(entry.primary.model).toBeTruthy();
    }
  });

  it('routes chat/summarize/chatStructured to Anthropic Haiku with Sonnet fallback', () => {
    expect(defaultRouteConfig.chat.primary).toEqual({
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
    });
    expect(defaultRouteConfig.chat.fallback).toEqual({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
    });
    expect(defaultRouteConfig.summarize.primary.model).toBe('claude-haiku-4-5-20251001');
    expect(defaultRouteConfig.chatStructured.primary.model).toBe('claude-haiku-4-5-20251001');
  });

  it('routes transcribe to OpenAI Whisper and embed to text-embedding-3-small', () => {
    expect(defaultRouteConfig.transcribe.primary).toEqual({
      provider: 'openai',
      model: 'whisper-1',
    });
    expect(defaultRouteConfig.transcribe.fallback).toBeUndefined();
    expect(defaultRouteConfig.embed.primary).toEqual({
      provider: 'openai',
      model: 'text-embedding-3-small',
    });
  });

  it('routes vision to Gemini with Anthropic Sonnet fallback', () => {
    expect(defaultRouteConfig.vision.primary).toEqual({
      provider: 'google',
      model: 'gemini-2.5-flash',
    });
    expect(defaultRouteConfig.vision.fallback).toEqual({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
    });
  });
});

describe('executeRoute', () => {
  const primaryEntry = {
    provider: 'anthropic' as const,
    model: 'claude-haiku-4-5-20251001',
  };
  const fallbackEntry = {
    provider: 'anthropic' as const,
    model: 'claude-sonnet-4-6',
  };

  it('returns the primary result when primary succeeds', async () => {
    const runner = jest
      .fn()
      .mockResolvedValueOnce({ value: 'primary-ok', usedEntry: primaryEntry });
    const result = await executeRoute({
      primary: primaryEntry,
      fallback: fallbackEntry,
      runner,
      retryOpts: { maxRetries: 0, baseDelayMs: 1 },
    });
    expect(result.value).toBe('primary-ok');
    expect(result.usedEntry).toEqual(primaryEntry);
    expect(result.fellBackTo).toBeUndefined();
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner).toHaveBeenCalledWith(primaryEntry);
  });

  it('falls back to fallback entry when primary fails terminally', async () => {
    const nonTransient = new ProviderError({
      provider: 'anthropic',
      status: 400,
      message: 'context too long',
    });
    const runner = jest
      .fn()
      .mockRejectedValueOnce(nonTransient)
      .mockResolvedValueOnce({ value: 'fallback-ok' });
    const result = await executeRoute({
      primary: primaryEntry,
      fallback: fallbackEntry,
      runner,
      retryOpts: { maxRetries: 0, baseDelayMs: 1 },
    });
    expect(result.value).toBe('fallback-ok');
    expect(result.usedEntry).toEqual(fallbackEntry);
    expect(result.fellBackTo).toEqual(fallbackEntry);
    expect(runner).toHaveBeenNthCalledWith(1, primaryEntry);
    expect(runner).toHaveBeenNthCalledWith(2, fallbackEntry);
  });

  it('falls back on RetryExhaustedError after primary retry exhaustion', async () => {
    const transient = new ProviderError({
      provider: 'anthropic',
      status: 503,
      message: 'unavail',
    });
    const runner = jest
      .fn()
      // Primary: 3 transient failures → retry exhausted
      .mockRejectedValueOnce(transient)
      .mockRejectedValueOnce(transient)
      .mockRejectedValueOnce(transient)
      // Fallback succeeds
      .mockResolvedValueOnce({ value: 'fallback-ok' });
    const result = await executeRoute({
      primary: primaryEntry,
      fallback: fallbackEntry,
      runner,
      retryOpts: { maxRetries: 2, baseDelayMs: 1, sleep: async () => undefined },
    });
    expect(result.value).toBe('fallback-ok');
    expect(result.fellBackTo).toEqual(fallbackEntry);
    expect(runner).toHaveBeenCalledTimes(4);
  });

  it('rethrows when primary fails terminally and there is no fallback', async () => {
    const nonTransient = new ProviderError({
      provider: 'openai',
      status: 401,
      message: 'bad key',
    });
    const runner = jest.fn().mockRejectedValueOnce(nonTransient);
    await expect(
      executeRoute({
        primary: primaryEntry,
        runner,
        retryOpts: { maxRetries: 0, baseDelayMs: 1 },
      }),
    ).rejects.toBe(nonTransient);
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it('rethrows when fallback also fails', async () => {
    const primaryErr = new ProviderError({
      provider: 'anthropic',
      status: 400,
      message: 'primary failed',
    });
    const fallbackErr = new ProviderError({
      provider: 'anthropic',
      status: 400,
      message: 'fallback failed too',
    });
    const runner = jest.fn().mockRejectedValueOnce(primaryErr).mockRejectedValueOnce(fallbackErr);
    await expect(
      executeRoute({
        primary: primaryEntry,
        fallback: fallbackEntry,
        runner,
        retryOpts: { maxRetries: 0, baseDelayMs: 1 },
      }),
    ).rejects.toBe(fallbackErr);
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

```powershell
npm run test:unit -w packages/ai -- --testPathPattern router.test
```

Expected: FAIL — `Cannot find module '../router'`.

- [ ] **Step 3: Implement the router**

Create `packages/ai/src/router.ts`:

```ts
import { retryWithBackoff, type RetryOpts } from './retry';

export type ProviderId = 'anthropic' | 'openai' | 'google';

export interface RouteEntry {
  provider: ProviderId;
  model: string;
}

export interface RouteOptions {
  primary: RouteEntry;
  fallback?: RouteEntry;
}

export interface RouteConfig {
  chat: RouteOptions;
  chatStructured: RouteOptions;
  summarize: RouteOptions;
  transcribe: RouteOptions;
  embed: RouteOptions;
  vision: RouteOptions;
}

export const defaultRouteConfig: RouteConfig = {
  chat: {
    primary: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
    fallback: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  },
  chatStructured: {
    primary: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
    fallback: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  },
  summarize: {
    primary: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
    fallback: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  },
  transcribe: {
    primary: { provider: 'openai', model: 'whisper-1' },
  },
  embed: {
    primary: { provider: 'openai', model: 'text-embedding-3-small' },
  },
  vision: {
    primary: { provider: 'google', model: 'gemini-2.5-flash' },
    fallback: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  },
};

export interface ExecuteRouteOpts<T> {
  primary: RouteEntry;
  fallback?: RouteEntry;
  /** Caller-provided function that invokes the appropriate provider op for the entry. */
  runner: (entry: RouteEntry) => Promise<T>;
  retryOpts: RetryOpts;
}

export interface ExecuteRouteResult<T> {
  value: T;
  usedEntry: RouteEntry;
  fellBackTo: RouteEntry | undefined;
}

/**
 * Runs the primary entry through retryWithBackoff. On terminal failure
 * (non-transient error or retry exhausted), runs the fallback entry the same
 * way. The runner is responsible for calling into the right provider/operation
 * given a route entry.
 */
export async function executeRoute<T>(opts: ExecuteRouteOpts<T>): Promise<ExecuteRouteResult<T>> {
  try {
    const value = await retryWithBackoff(() => opts.runner(opts.primary), opts.retryOpts);
    return { value, usedEntry: opts.primary, fellBackTo: undefined };
  } catch (primaryErr) {
    if (!opts.fallback) throw primaryErr;
    const value = await retryWithBackoff(
      () => opts.runner(opts.fallback as RouteEntry),
      opts.retryOpts,
    );
    return {
      value,
      usedEntry: opts.fallback,
      fellBackTo: opts.fallback,
    };
  }
}
```

- [ ] **Step 4: Run the test, confirm it passes**

```powershell
npm run test:unit -w packages/ai -- --testPathPattern router.test
```

Expected: PASS (all router tests).

- [ ] **Step 5: Commit**

```powershell
git add packages/ai/src/router.ts packages/ai/src/__tests__/router.test.ts
git commit -m "feat(ai): add route config + executeRoute with fallback policy"
```

---

### Task 10: `createAiClient` facade

**Files:**

- Create: `packages/ai/src/client.ts`
- Create: `packages/ai/src/__tests__/client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/ai/src/__tests__/client.test.ts`:

```ts
import { z } from 'zod';
import { createAiClient } from '../client';
import type { ProviderId, RouteConfig } from '../router';
import { defaultRouteConfig } from '../router';
import { ProviderError, RouteUnavailableError } from '../errors';
import type { UsageLogEntry } from '../usage-logger';

function tokenUsage(input = 1, output = 1) {
  return { kind: 'tokens' as const, inputTokens: input, outputTokens: output };
}

function makeStubProviders() {
  return {
    anthropic: {
      chat: jest.fn().mockResolvedValue({ text: 'hi', usage: tokenUsage(2, 3) }),
      chatStructured: jest.fn().mockResolvedValue({ value: { ok: true }, usage: tokenUsage(4, 5) }),
      summarize: jest.fn().mockResolvedValue({ summary: 'sum', usage: tokenUsage(6, 7) }),
    },
    openai: {
      transcribe: jest.fn().mockResolvedValue({
        text: 'hello',
        segments: [],
        language: 'en',
        usage: { kind: 'audio' as const, seconds: 10 },
      }),
      embed: jest.fn().mockResolvedValue({
        vectors: [[0]],
        usage: { kind: 'embedding' as const, inputTokens: 1, vectorCount: 1 },
      }),
    },
    google: {
      vision: jest.fn().mockResolvedValue({ text: 'cat', usage: tokenUsage(8, 9) }),
    },
  };
}

describe('createAiClient', () => {
  it('routes chat() through Anthropic primary and logs usage', async () => {
    const providers = makeStubProviders();
    const calls: UsageLogEntry[] = [];
    const client = createAiClient({
      providers: providers as never,
      usageLogger: async (e) => {
        calls.push(e);
      },
      retry: { maxRetries: 0, baseDelayMs: 1 },
    });
    const result = await client.chat([{ role: 'user', content: 'hi' }]);
    expect(result.text).toBe('hi');
    expect(providers.anthropic.chat).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      operation: 'chat',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      usage: tokenUsage(2, 3),
    });
    expect(calls[0]?.fellBackTo).toBeUndefined();
    expect(calls[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('falls back to Sonnet when Haiku fails and records fellBackTo in usage log', async () => {
    const providers = makeStubProviders();
    providers.anthropic.chat
      .mockReset()
      .mockRejectedValueOnce(
        new ProviderError({ provider: 'anthropic', status: 400, message: 'too long' }),
      )
      .mockResolvedValueOnce({ text: 'sonnet-result', usage: tokenUsage(10, 20) });
    const calls: UsageLogEntry[] = [];
    const client = createAiClient({
      providers: providers as never,
      usageLogger: async (e) => {
        calls.push(e);
      },
      retry: { maxRetries: 0, baseDelayMs: 1 },
    });
    const result = await client.chat([{ role: 'user', content: 'x' }]);
    expect(result.text).toBe('sonnet-result');
    expect(providers.anthropic.chat).toHaveBeenCalledTimes(2);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      operation: 'chat',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      fellBackTo: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    });
  });

  it('routes transcribe() through OpenAI and logs audio usage', async () => {
    const providers = makeStubProviders();
    const calls: UsageLogEntry[] = [];
    const client = createAiClient({
      providers: providers as never,
      usageLogger: async (e) => {
        calls.push(e);
      },
      retry: { maxRetries: 0, baseDelayMs: 1 },
    });
    const result = await client.transcribe(Buffer.from('audio'));
    expect(result.text).toBe('hello');
    expect(providers.openai.transcribe).toHaveBeenCalledTimes(1);
    expect(calls[0]).toMatchObject({
      operation: 'transcribe',
      provider: 'openai',
      model: 'whisper-1',
      usage: { kind: 'audio', seconds: 10 },
    });
  });

  it('routes chatStructured() through Anthropic with the schema', async () => {
    const providers = makeStubProviders();
    const calls: UsageLogEntry[] = [];
    const client = createAiClient({
      providers: providers as never,
      usageLogger: async (e) => {
        calls.push(e);
      },
      retry: { maxRetries: 0, baseDelayMs: 1 },
    });
    const schema = z.object({ ok: z.boolean() });
    const result = await client.chatStructured(schema, [{ role: 'user', content: 'q' }]);
    expect(result.value).toEqual({ ok: true });
    expect(providers.anthropic.chatStructured).toHaveBeenCalledTimes(1);
    expect(calls[0]?.operation).toBe('chatStructured');
  });

  it('routes summarize() through Anthropic', async () => {
    const providers = makeStubProviders();
    const calls: UsageLogEntry[] = [];
    const client = createAiClient({
      providers: providers as never,
      usageLogger: async (e) => {
        calls.push(e);
      },
      retry: { maxRetries: 0, baseDelayMs: 1 },
    });
    const result = await client.summarize('long text', 'bullet');
    expect(result.summary).toBe('sum');
    expect(providers.anthropic.summarize).toHaveBeenCalledWith(
      'long text',
      'bullet',
      expect.objectContaining({ model: 'claude-haiku-4-5-20251001' }),
    );
    expect(calls[0]?.operation).toBe('summarize');
  });

  it('routes embed() through OpenAI', async () => {
    const providers = makeStubProviders();
    const calls: UsageLogEntry[] = [];
    const client = createAiClient({
      providers: providers as never,
      usageLogger: async (e) => {
        calls.push(e);
      },
      retry: { maxRetries: 0, baseDelayMs: 1 },
    });
    const result = await client.embed(['hello']);
    expect(result.vectors).toEqual([[0]]);
    expect(providers.openai.embed).toHaveBeenCalledTimes(1);
    expect(calls[0]?.operation).toBe('embed');
  });

  it('routes vision() through Google with Anthropic fallback', async () => {
    const providers = makeStubProviders();
    const calls: UsageLogEntry[] = [];
    const client = createAiClient({
      providers: providers as never,
      usageLogger: async (e) => {
        calls.push(e);
      },
      retry: { maxRetries: 0, baseDelayMs: 1 },
    });
    const result = await client.vision(
      { data: Buffer.from([1]), mimeType: 'image/png' },
      'describe',
    );
    expect(result.text).toBe('cat');
    expect(providers.google.vision).toHaveBeenCalledTimes(1);
    expect(calls[0]).toMatchObject({
      operation: 'vision',
      provider: 'google',
      model: 'gemini-2.5-flash',
    });
  });

  it('throws RouteUnavailableError when the configured provider is missing', async () => {
    const partialProviders = { openai: makeStubProviders().openai } as never;
    const client = createAiClient({
      providers: partialProviders,
      retry: { maxRetries: 0, baseDelayMs: 1 },
    });
    await expect(client.chat([{ role: 'user', content: 'x' }])).rejects.toBeInstanceOf(
      RouteUnavailableError,
    );
  });

  it('does NOT log usage when the call fails terminally', async () => {
    const providers = makeStubProviders();
    providers.anthropic.chat
      .mockReset()
      .mockRejectedValueOnce(
        new ProviderError({ provider: 'anthropic', status: 400, message: 'p' }),
      )
      .mockRejectedValueOnce(
        new ProviderError({ provider: 'anthropic', status: 400, message: 'f' }),
      );
    const calls: UsageLogEntry[] = [];
    const client = createAiClient({
      providers: providers as never,
      usageLogger: async (e) => {
        calls.push(e);
      },
      retry: { maxRetries: 0, baseDelayMs: 1 },
    });
    await expect(client.chat([{ role: 'user', content: 'x' }])).rejects.toBeInstanceOf(
      ProviderError,
    );
    expect(calls).toHaveLength(0);
  });

  it('uses custom routes when provided', async () => {
    const providers = makeStubProviders();
    const customRoutes: RouteConfig = {
      ...defaultRouteConfig,
      chat: {
        primary: { provider: 'anthropic' as ProviderId, model: 'claude-opus-4-7' },
      },
    };
    const calls: UsageLogEntry[] = [];
    const client = createAiClient({
      providers: providers as never,
      routes: customRoutes,
      usageLogger: async (e) => {
        calls.push(e);
      },
      retry: { maxRetries: 0, baseDelayMs: 1 },
    });
    await client.chat([{ role: 'user', content: 'x' }]);
    expect(providers.anthropic.chat).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ model: 'claude-opus-4-7' }),
    );
    expect(calls[0]?.model).toBe('claude-opus-4-7');
  });

  it('attaches userId and callerApp from per-call context to the usage log', async () => {
    const providers = makeStubProviders();
    const calls: UsageLogEntry[] = [];
    const client = createAiClient({
      providers: providers as never,
      usageLogger: async (e) => {
        calls.push(e);
      },
      retry: { maxRetries: 0, baseDelayMs: 1 },
    });
    await client.chat([{ role: 'user', content: 'x' }], {
      context: { userId: 'u_42', callerApp: 'api-say' },
    } as never);
    expect(calls[0]?.userId).toBe('u_42');
    expect(calls[0]?.callerApp).toBe('api-say');
  });
});
```

Also update `packages/ai/src/types.ts` to add `context` to `ChatOpts` (and any other opts that need it). Make `ChatOpts.context` optional:

Edit `packages/ai/src/types.ts` — add the field inside `ChatOpts`:

```ts
export interface AiCallContext {
  userId?: string;
  callerApp?: string;
}

export interface ChatOpts {
  /** Per-call override; otherwise router default. */
  model?: string;
  /** Enable Anthropic prompt caching of the system message. Default false. */
  cacheSystem?: boolean;
  /** Sampling temperature (0..1). Default per-provider. */
  temperature?: number;
  /** Hard cap on output tokens. Default 1024. */
  maxOutputTokens?: number;
  /** Per-call timeout override in ms. Default from client config. */
  timeoutMs?: number;
  /** Stop sequences forwarded to the provider where supported. */
  stop?: string[];
  /** Per-call context attached to the usage log entry. */
  context?: AiCallContext;
}

export interface TranscribeOpts {
  /** BCP-47 language tag (e.g. 'en'). Hints the transcriber. */
  language?: string;
  /** Domain-hint text fed to the model to bias the lexicon. */
  prompt?: string;
  /** Per-call timeout override in ms. */
  timeoutMs?: number;
  /** Per-call context attached to the usage log entry. */
  context?: AiCallContext;
}
```

- [ ] **Step 2: Run the test, confirm it fails**

```powershell
npm run test:unit -w packages/ai -- --testPathPattern client.test
```

Expected: FAIL — `Cannot find module '../client'`.

- [ ] **Step 3: Implement createAiClient**

Create `packages/ai/src/client.ts`:

```ts
import type { ZodSchema } from 'zod';
import { RouteUnavailableError } from './errors';
import {
  defaultRouteConfig,
  executeRoute,
  type ProviderId,
  type RouteConfig,
  type RouteEntry,
  type RouteOptions,
} from './router';
import type { RetryOpts } from './retry';
import { noopUsageLogger, type AiOperation, type UsageLogger } from './usage-logger';
import type {
  AiCallContext,
  AiClient,
  ChatOpts,
  ImageInput,
  Message,
  SummaryFormat,
  TranscribeOpts,
  Usage,
} from './types';
import type {
  AnthropicProvider,
  GoogleProvider,
  OpenAIProvider,
  OperationContext,
} from './providers/types';

export interface AiClientProviders {
  anthropic?: AnthropicProvider;
  openai?: OpenAIProvider;
  google?: GoogleProvider;
}

export interface CreateAiClientOpts {
  providers: AiClientProviders;
  routes?: RouteConfig;
  usageLogger?: UsageLogger;
  /** Default timeout per call in ms. Default 30000. */
  timeoutMs?: number;
  retry?: RetryOpts;
}

interface RunOpts<T> {
  operation: AiOperation;
  route: RouteOptions;
  context: AiCallContext | undefined;
  /** Per-call timeout override. */
  timeoutMs: number;
  run: (entry: RouteEntry, opCtx: OperationContext) => Promise<{ value: T; usage: Usage }>;
}

export function createAiClient(opts: CreateAiClientOpts): AiClient {
  const routes = opts.routes ?? defaultRouteConfig;
  const usageLogger = opts.usageLogger ?? noopUsageLogger;
  const defaultTimeoutMs = opts.timeoutMs ?? 30000;
  const retryOpts = opts.retry ?? { maxRetries: 2, baseDelayMs: 250 };

  function pickProviderOperation<K extends keyof AiClientProviders, OpKey extends string>(
    provider: K,
    opKey: OpKey,
  ): unknown {
    const p = opts.providers[provider];
    if (!p) return undefined;
    return (p as Record<string, unknown>)[opKey];
  }

  function ensureProviderOperation(
    provider: ProviderId,
    opKey: string,
    operation: AiOperation,
  ): unknown {
    const fn = pickProviderOperation(provider as keyof AiClientProviders, opKey);
    if (typeof fn !== 'function') {
      throw new RouteUnavailableError(operation);
    }
    return fn;
  }

  async function runWithRoute<T>(
    o: RunOpts<T>,
  ): Promise<{ value: T; usage: Usage; usedEntry: RouteEntry; fellBackTo?: RouteEntry }> {
    const startedAt = new Date();
    const start = Date.now();
    const opCtxFor = (entry: RouteEntry): OperationContext => ({
      timeoutMs: o.timeoutMs,
      model: entry.model,
    });
    const result = await executeRoute({
      primary: o.route.primary,
      fallback: o.route.fallback,
      retryOpts,
      runner: async (entry) => o.run(entry, opCtxFor(entry)),
    });
    const durationMs = Date.now() - start;
    await usageLogger({
      operation: o.operation,
      provider: result.usedEntry.provider,
      model: result.usedEntry.model,
      usage: result.value.usage,
      userId: o.context?.userId,
      callerApp: o.context?.callerApp,
      startedAt,
      durationMs,
      fellBackTo: result.fellBackTo,
    });
    return {
      value: result.value.value,
      usage: result.value.usage,
      usedEntry: result.usedEntry,
      fellBackTo: result.fellBackTo,
    };
  }

  const chat: AiClient['chat'] = async (messages, callOpts) => {
    const opts2 = callOpts ?? {};
    const timeoutMs = opts2.timeoutMs ?? defaultTimeoutMs;
    const { value, usage } = await runWithRoute({
      operation: 'chat',
      route: routes.chat,
      context: opts2.context,
      timeoutMs,
      run: async (entry, opCtx) => {
        const fn = ensureProviderOperation(
          entry.provider,
          'chat',
          'chat',
        ) as AnthropicProvider['chat'];
        return fn(messages, opts2, opCtx);
      },
    });
    return { text: value as unknown as string, usage };
  };

  const chatStructured: AiClient['chatStructured'] = async <T>(
    schema: ZodSchema<T>,
    messages: Message[],
    callOpts?: ChatOpts,
  ) => {
    const opts2 = callOpts ?? {};
    const timeoutMs = opts2.timeoutMs ?? defaultTimeoutMs;
    const { value, usage } = await runWithRoute<T>({
      operation: 'chatStructured',
      route: routes.chatStructured,
      context: opts2.context,
      timeoutMs,
      run: async (entry, opCtx) => {
        const fn = ensureProviderOperation(
          entry.provider,
          'chatStructured',
          'chatStructured',
        ) as AnthropicProvider['chatStructured'];
        return fn(schema, messages, opts2, opCtx);
      },
    });
    return { value, usage };
  };

  const summarize: AiClient['summarize'] = async (text, format: SummaryFormat) => {
    const timeoutMs = defaultTimeoutMs;
    const { value, usage } = await runWithRoute({
      operation: 'summarize',
      route: routes.summarize,
      context: undefined,
      timeoutMs,
      run: async (entry, opCtx) => {
        const fn = ensureProviderOperation(
          entry.provider,
          'summarize',
          'summarize',
        ) as AnthropicProvider['summarize'];
        return fn(text, format, opCtx);
      },
    });
    return { summary: value as unknown as string, usage };
  };

  const transcribe: AiClient['transcribe'] = async (audio, callOpts) => {
    const opts2 = callOpts ?? {};
    const timeoutMs = opts2.timeoutMs ?? defaultTimeoutMs;
    const { value, usage, usedEntry, fellBackTo } = await runWithRoute<{
      text: string;
      segments: Array<{ start: number; end: number; text: string }>;
      language: string;
    }>({
      operation: 'transcribe',
      route: routes.transcribe,
      context: opts2.context,
      timeoutMs,
      run: async (entry, opCtx) => {
        const fn = ensureProviderOperation(
          entry.provider,
          'transcribe',
          'transcribe',
        ) as OpenAIProvider['transcribe'];
        const r = await fn(audio, opts2, opCtx);
        return {
          value: { text: r.text, segments: r.segments, language: r.language },
          usage: r.usage,
        };
      },
    });
    void usedEntry;
    void fellBackTo;
    return {
      text: value.text,
      segments: value.segments,
      language: value.language,
      usage,
    };
  };

  const embed: AiClient['embed'] = async (texts) => {
    const timeoutMs = defaultTimeoutMs;
    const { value, usage } = await runWithRoute<number[][]>({
      operation: 'embed',
      route: routes.embed,
      context: undefined,
      timeoutMs,
      run: async (entry, opCtx) => {
        const fn = ensureProviderOperation(
          entry.provider,
          'embed',
          'embed',
        ) as OpenAIProvider['embed'];
        const r = await fn(texts, opCtx);
        return { value: r.vectors, usage: r.usage };
      },
    });
    return { vectors: value, usage };
  };

  const vision: AiClient['vision'] = async (imageOrUrl: ImageInput, prompt: string) => {
    const timeoutMs = defaultTimeoutMs;
    const { value, usage } = await runWithRoute({
      operation: 'vision',
      route: routes.vision,
      context: undefined,
      timeoutMs,
      run: async (entry, opCtx) => {
        const fn = ensureProviderOperation(
          entry.provider,
          'vision',
          'vision',
        ) as GoogleProvider['vision'];
        return fn(imageOrUrl, prompt, opCtx);
      },
    });
    return { text: value as unknown as string, usage };
  };

  return { chat, chatStructured, summarize, transcribe, embed, vision };
}
```

- [ ] **Step 4: Run the test, confirm it passes**

```powershell
npm run test:unit -w packages/ai -- --testPathPattern client.test
```

Expected: PASS (all client tests).

- [ ] **Step 5: Commit**

```powershell
git add packages/ai/src/types.ts packages/ai/src/client.ts packages/ai/src/__tests__/client.test.ts
git commit -m "feat(ai): add createAiClient facade with usage logging + fallback"
```

---

### Task 11: Update public `index.ts`

**Files:**

- Modify: `packages/ai/src/index.ts`
- Modify: `packages/ai/src/__tests__/smoke.test.ts`

- [ ] **Step 1: Rewrite the smoke test against the new public surface**

Replace `packages/ai/src/__tests__/smoke.test.ts` with:

```ts
import {
  createAiClient,
  defaultRouteConfig,
  noopUsageLogger,
  AiError,
  ProviderError,
  RetryExhaustedError,
  RouteUnavailableError,
  createAnthropicProvider,
  createOpenAIProvider,
  createGoogleProvider,
} from '../index';

describe('@things/ai public surface', () => {
  it('exports the client factory', () => {
    expect(typeof createAiClient).toBe('function');
  });

  it('exports defaultRouteConfig with all six operations', () => {
    const ops = ['chat', 'chatStructured', 'summarize', 'transcribe', 'embed', 'vision'];
    for (const op of ops) {
      expect(defaultRouteConfig).toHaveProperty(op);
    }
  });

  it('exports the error hierarchy', () => {
    expect(typeof AiError).toBe('function');
    expect(typeof ProviderError).toBe('function');
    expect(typeof RetryExhaustedError).toBe('function');
    expect(typeof RouteUnavailableError).toBe('function');
  });

  it('exports the no-op usage logger', () => {
    expect(typeof noopUsageLogger).toBe('function');
  });

  it('exports the provider factories', () => {
    expect(typeof createAnthropicProvider).toBe('function');
    expect(typeof createOpenAIProvider).toBe('function');
    expect(typeof createGoogleProvider).toBe('function');
  });
});
```

- [ ] **Step 2: Run the smoke test, confirm it fails**

```powershell
npm run test:unit -w packages/ai -- --testPathPattern smoke.test
```

Expected: FAIL — most exports do not exist in `index.ts` yet.

- [ ] **Step 3: Rewrite index.ts to export the public surface**

Replace `packages/ai/src/index.ts` with:

```ts
export { createAiClient } from './client';
export type { AiClientProviders, CreateAiClientOpts } from './client';

export { defaultRouteConfig, executeRoute } from './router';
export type { ProviderId, RouteConfig, RouteEntry, RouteOptions } from './router';

export type {
  AiCallContext,
  AiClient,
  ChatOpts,
  ImageInput,
  Message,
  Segment,
  SummaryFormat,
  TranscribeOpts,
  Usage,
} from './types';

export {
  AiError,
  ProviderError,
  RetryExhaustedError,
  RouteUnavailableError,
  isTransientProviderError,
} from './errors';

export { noopUsageLogger } from './usage-logger';
export type { AiOperation, UsageLogEntry, UsageLogger } from './usage-logger';

export { retryWithBackoff } from './retry';
export type { RetryOpts } from './retry';

export { createAnthropicProvider } from './providers/anthropic';
export { createOpenAIProvider } from './providers/openai';
export { createGoogleProvider } from './providers/google';
export type {
  AnthropicProvider,
  ChatFn,
  ChatStructuredFn,
  EmbedFn,
  GoogleProvider,
  OpenAIProvider,
  OperationContext,
  SummarizeFn,
  TranscribeFn,
  VisionFn,
} from './providers/types';
```

- [ ] **Step 4: Run the smoke test, confirm it passes**

```powershell
npm run test:unit -w packages/ai -- --testPathPattern smoke.test
```

Expected: PASS (5 tests).

- [ ] **Step 5: Run the full package test suite**

```powershell
npm run test:unit -w packages/ai
```

Expected: PASS for every test file (types, errors, retry, usage-logger, providers/anthropic, providers/openai, providers/google, router, client, smoke).

- [ ] **Step 6: Typecheck and lint the package**

```powershell
npm run typecheck -w packages/ai
npm run lint -w packages/ai
```

Expected: both PASS.

- [ ] **Step 7: Commit**

```powershell
git add packages/ai/src/index.ts packages/ai/src/__tests__/smoke.test.ts
git commit -m "feat(ai): expose public surface (createAiClient + types + errors + providers)"
```

---

### Task 12: ESLint enforcement of provider SDK boundary

**Files:**

- Modify: `eslint.config.mjs`
- Create: `packages/ai/src/__tests__/eslint-boundary.test.ts` (sanity test that runs ESLint programmatically on a temp file inside the package)

The foundation spec requires: "ESLint rule bans `@anthropic-ai/sdk` / `openai` / `@google/generative-ai` imports outside `packages/ai/src/providers/`." Two changes — add the rule globally, then explicitly allow it inside `packages/ai/src/providers/**`.

- [ ] **Step 1: Update `eslint.config.mjs`**

Replace `eslint.config.mjs` with:

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

const PROVIDER_SDK_MODULES = ['@anthropic-ai/sdk', 'openai', '@google/generative-ai'];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.expo/**',
      '**/node_modules/**',
      '**/*.config.js',
      '**/*.config.cjs',
      'apps/**/*.config.mjs',
      'apps/**/*.config.ts',
      'packages/**/*.config.mjs',
      'packages/**/*.config.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-restricted-imports': [
        'error',
        {
          paths: PROVIDER_SDK_MODULES.map((name) => ({
            name,
            message:
              'Direct provider SDK imports are only allowed in packages/ai/src/providers/. Use @things/ai instead.',
          })),
        },
      ],
    },
  },
  {
    files: ['packages/ai/src/providers/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  prettierConfig,
);
```

- [ ] **Step 2: Verify ESLint blocks the import outside providers/**

Create a temporary test file to confirm the rule fires. Create `packages/ai/src/__tests__/eslint-boundary.test.ts`:

```ts
import { ESLint } from 'eslint';
import path from 'node:path';

describe('ESLint provider-SDK boundary', () => {
  const repoRoot = path.resolve(__dirname, '../../../..');

  it('rejects @anthropic-ai/sdk import in a non-providers file', async () => {
    const eslint = new ESLint({ cwd: repoRoot });
    const source = `import Anthropic from '@anthropic-ai/sdk';\nconsole.warn(Anthropic);\n`;
    const filePath = path.join(repoRoot, 'packages/ai/src/__boundary_probe_outside.ts');
    const results = await eslint.lintText(source, { filePath });
    const messages = results[0]?.messages ?? [];
    expect(
      messages.some(
        (m) =>
          m.ruleId === 'no-restricted-imports' && (m.message ?? '').includes('@anthropic-ai/sdk'),
      ),
    ).toBe(true);
  }, 30000);

  it('allows @anthropic-ai/sdk import inside providers/', async () => {
    const eslint = new ESLint({ cwd: repoRoot });
    const source = `import type Anthropic from '@anthropic-ai/sdk';\nexport type Probe = Anthropic;\n`;
    const filePath = path.join(repoRoot, 'packages/ai/src/providers/__boundary_probe_inside.ts');
    const results = await eslint.lintText(source, { filePath });
    const messages = results[0]?.messages ?? [];
    expect(messages.some((m) => m.ruleId === 'no-restricted-imports')).toBe(false);
  }, 30000);
});
```

This test needs `eslint` to be available to the package's Jest. ESLint is already a root devDependency; ts-jest picks it up through `node_modules` hoisting.

- [ ] **Step 3: Run the boundary test**

```powershell
npm run test:unit -w packages/ai -- --testPathPattern eslint-boundary
```

Expected: PASS (2 tests). If it fails because `eslint` cannot be resolved from the package, run:

```powershell
npm install -w packages/ai eslint@^9.10.0 --save-dev
```

then rerun.

- [ ] **Step 4: Run the full root lint to ensure nothing else now fails**

```powershell
npm run lint
```

Expected: PASS for every workspace. Anthropic/OpenAI/Google SDK imports inside `packages/ai/src/providers/*.ts` are still permitted by the file-scoped override.

- [ ] **Step 5: Commit**

```powershell
git add eslint.config.mjs packages/ai/src/__tests__/eslint-boundary.test.ts packages/ai/package.json package-lock.json
git commit -m "feat(eslint): ban provider SDK imports outside packages/ai/src/providers/"
```

---

### Task 13: Add `AiCall` Prisma model to `things_auth`

The foundation spec says: "the AI module writes a row to `things_auth.ai_calls`." The `@things/ai` package itself only emits `UsageLogEntry` to an injected logger — consumer NestJS services own the actual DB write. To make that wiring straightforward, the `AiCall` table needs to exist in the canonical `things_auth` Postgres database (and be mirrored into any consumer app's Prisma schema, the same way `User`/`Session` are mirrored today).

This task adds the model only to `apps/api-auth/prisma/schema.prisma`. Mirroring into per-app schemas happens as part of each consumer app's plan, not this one.

**Files:**

- Modify: `apps/api-auth/prisma/schema.prisma`
- Modify: `apps/api-auth/.env.example` (document the three AI keys for completeness — they are consumed by services that use `@things/ai`, not by api-auth itself, but `.env.example` is the suite's reference list)

- [ ] **Step 1: Add the `AiCall` model**

Append to `apps/api-auth/prisma/schema.prisma`:

```prisma
// ---- AI usage audit (foundation spec §5.2) ----
// Written by services that use @things/ai via an injected usage logger.
// Lives in things_auth so the suite has one cross-app cost-center.

model AiCall {
  id          String   @id @default(cuid())
  userId      String?
  callerApp   String
  operation   String
  provider    String
  model       String
  // Usage fields — only the ones relevant for the operation are populated.
  inputTokens     Int?
  outputTokens    Int?
  cacheReadTokens Int?
  cacheWriteTokens Int?
  audioSeconds Float?
  vectorCount  Int?
  durationMs   Int
  fellBackTo   String?  // "<provider>:<model>" or null
  startedAt    DateTime
  createdAt    DateTime @default(now())

  @@index([userId, createdAt])
  @@index([callerApp, createdAt])
}
```

- [ ] **Step 2: Document the three AI keys**

Read the current `.env.example`:

```powershell
Get-Content apps/api-auth/.env.example
```

Then append (if not already present):

```
# ---- AI provider keys (consumed by services that use @things/ai) ----
# api-auth itself does not call AI, but the suite documents all required
# keys here for visibility. Per-service .env.example files mirror what they
# actually consume.
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
```

- [ ] **Step 3: Apply the schema change to the dev Postgres database**

```powershell
npm run db:push -w apps/api-auth
```

Expected output: `Your database is now in sync with your Prisma schema.` and a regeneration of `@prisma/client`.

- [ ] **Step 4: Confirm api-auth still typechecks and tests pass**

```powershell
npm run typecheck -w apps/api-auth
npm run test:unit -w apps/api-auth
```

Expected: both PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/api-auth/prisma/schema.prisma apps/api-auth/.env.example
git commit -m "feat(api-auth): add AiCall model for cross-app AI usage audit"
```

---

### Task 14: Final suite-wide verification + summary commit

**Files:** (no source changes — verification only)

- [ ] **Step 1: Run lint across the whole repo**

```powershell
npm run lint
```

Expected: PASS for every workspace.

- [ ] **Step 2: Run unit tests across the whole repo**

```powershell
npm run test:unit
```

Expected: every workspace's unit suite PASS, including all new `@things/ai` tests.

- [ ] **Step 3: Run integration tests**

```powershell
npm run test:integration
```

Expected: PASS (the `@things/ai` integration config remains `--passWithNoTests` because P4 only adds unit-level coverage; real provider calls are reserved for the e2e config to be enabled later with API keys).

- [ ] **Step 4: Typecheck the whole repo**

```powershell
npm run typecheck
```

Expected: PASS in every workspace.

- [ ] **Step 5: Sanity-check the public API of `@things/ai`**

```powershell
npm run build -w packages/ai
```

Expected: `packages/ai/dist/index.d.ts` and `dist/index.js` exist; `dist/index.d.ts` declares `createAiClient`, `defaultRouteConfig`, `AiClient`, and the error classes.

- [ ] **Step 6: Verify no provider SDK leakage outside packages/ai**

```powershell
npm run lint
```

Expected: PASS. If a future change adds `import { ... } from '@anthropic-ai/sdk'` in, for example, `apps/api-say/`, the boundary rule will block it at this step.

- [ ] **Step 7: Update the suite handoff (lightweight)**

Append a short note to `things/CLAUDE.md` so future sessions know P4 is complete. Insert at the end of the file:

```markdown
---

## P4 status (2026-05-23)

`@things/ai` complete: provider-agnostic AI client at `packages/ai/` with
`createAiClient({ providers, usageLogger? })` returning an `AiClient`
implementing the foundation spec §5.1 interface. Default routing:
chat/summarize/chatStructured → Claude Haiku 4.5 (fallback Sonnet 4.6),
transcribe → Whisper, embed → text-embedding-3-small, vision → Gemini 2.5
Flash (fallback Sonnet 4.6). Direct provider SDK imports outside
`packages/ai/src/providers/` are blocked by ESLint. `AiCall` table lives in
`things_auth`; consumer apps that want to persist usage rows mirror it into
their own Prisma schema and pass a usage logger that writes via their Prisma
client.
```

- [ ] **Step 8: Commit the handoff note**

```powershell
git add things/CLAUDE.md
git commit -m "docs(things): note P4 (@things/ai) completion"
```

---

## Self-Review

### Spec coverage

Mapping foundation spec §5 requirements to tasks:

| Spec requirement                                                                                            | Covered by                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public `AiClient` interface (§5.1) — `transcribe`, `chat`, `chatStructured`, `summarize`, `embed`, `vision` | Task 2 (types) + Task 10 (client)                                                                                                                                                                                                 |
| Apps depend only on the interface (§5.2)                                                                    | Task 11 (index.ts exports `AiClient` type; only `createAiClient` and `AiClient` are the consumer surface) + Task 12 (ESLint boundary)                                                                                             |
| ESLint rule bans provider SDK imports outside `packages/ai/src/providers/` (§5.2)                           | Task 12                                                                                                                                                                                                                           |
| Provider routing lives in `packages/ai/src/router.ts` (§5.2)                                                | Task 9                                                                                                                                                                                                                            |
| All calls return `usage`; AI module writes a row to `things_auth.ai_calls` (§5.2)                           | Task 5 (UsageLogger) + Task 10 (client emits log entry) + Task 13 (Prisma model)                                                                                                                                                  |
| Retries, timeouts, fallback at router (§5.2)                                                                | Task 4 (retry) + Task 9 (router fallback) + Task 10 (client wires retry policy + per-call timeoutMs)                                                                                                                              |
| Prompt caching opt-in via `ChatOpts.cacheSystem` (§5.2)                                                     | Task 2 (`ChatOpts.cacheSystem` field) + Task 6 (Anthropic provider wraps system in `cache_control: ephemeral`)                                                                                                                    |
| Starter routing table (§5.3)                                                                                | Task 9 (`defaultRouteConfig`)                                                                                                                                                                                                     |
| Secrets: three API keys, fail-fast on boot (§5.4)                                                           | Task 13 documents the three keys in `.env.example`. NestJS `ConfigService` Zod validation is per-app boot wiring (out of scope for the `@things/ai` package itself; each consumer app's plan will add its own `ai` config block). |

### Placeholder scan

Searched for "TODO", "TBD", "implement later", "appropriate error handling", "Similar to Task" — none present. Every step contains the exact code to write or the exact command to run.

### Type consistency

Verified across tasks:

- `Usage` discriminated union (`tokens` | `audio` | `embedding`) is consistent everywhere it appears: Task 2 (definition), Task 5 (logged in `UsageLogEntry`), Tasks 6/7/8 (returned by each provider operation), Task 10 (forwarded to logger).
- `RouteEntry` shape (`{ provider, model }`) is consistent in Task 9 (definition + default routes), Task 10 (executor calls `runner(entry)`).
- `OperationContext` shape (`{ timeoutMs, model }`) is defined in Task 6 (`providers/types.ts`) and consumed unchanged in Tasks 6/7/8/10.
- `AnthropicProvider` / `OpenAIProvider` / `GoogleProvider` are introduced in Task 6 and used by `createAiClient` in Task 10. Their operation names (`chat`, `chatStructured`, `summarize`, `transcribe`, `embed`, `vision`) match the keys `client.ts` looks up via `pickProviderOperation`.
- `noopUsageLogger` (Task 5) is the default in `createAiClient` (Task 10) and is exported from `index.ts` (Task 11).
- `defaultRouteConfig` model ids match between Task 9 and the test assertions in Tasks 10 and 11.

No drift found.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-23-things-ai-router-p4.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
