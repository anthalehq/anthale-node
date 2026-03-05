import type { PolicyEnforceParams } from '../resources/organizations/policies';
import { buildPolicyEnforcer, type PolicyEnforcerOptions, messagesFromValue, normalizeRole } from './core';

type MaybePromise<T> = T | PromiseLike<T>;

interface CreateFn {
  (...args: any[]): MaybePromise<any>;
}

interface OpenAIClientLike {
  responses?: { create?: unknown };
  chat?: { completions?: { create?: unknown } };
}

/**
 * Options for {@link guardOpenAIClient}.
 *
 * Inherits all policy enforcer options (`policyId`, `apiKey`, `client`,
 * `metadata`).
 */
export interface GuardOpenAIClientOptions extends PolicyEnforcerOptions {}

const OPENAI_GUARDED = Symbol.for('anthale.openai.guarded');

let streamWarningIssued = false;

function warnStreamBuffering(): void {
  if (streamWarningIssued) {
    return;
  }

  streamWarningIssued = true;
  console.warn(
    'Anthale does not support real-time stream analysis. OpenAI stream outputs are buffered and analyzed once the stream completes.',
  );
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return typeof value === 'object' && value !== null && Symbol.asyncIterator in value;
}

function extractMessagesFromRequest(
  endpoint: 'responses' | 'chat_completions',
  payload: Record<string, unknown>,
): PolicyEnforceParams.Message[] {
  if (endpoint === 'responses') {
    const messages: PolicyEnforceParams.Message[] = [];
    if ('instructions' in payload) {
      messages.push(...messagesFromValue(payload['instructions'], 'system'));
    }

    if ('input' in payload) {
      messages.push(...messagesFromValue(payload['input'], 'user'));
    }

    return messages;
  }

  return messagesFromValue(payload['messages'], 'user');
}

function extractMessagesFromResponsesPayload(
  payload: Record<string, unknown>,
): PolicyEnforceParams.Message[] {
  const messages: PolicyEnforceParams.Message[] = [];
  let hasAssistantTextInOutput = false;

  const output = payload['output'];
  if (Array.isArray(output)) {
    for (const item of output) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const record = item as Record<string, unknown>;
      const role = normalizeRole(record['role']);
      const contentMessages = messagesFromValue(record['content'], role);
      if (role === 'assistant' && contentMessages.length > 0) {
        hasAssistantTextInOutput = true;
      }

      messages.push(...contentMessages);
      if ('arguments' in record) {
        messages.push(...messagesFromValue(record['arguments'], 'assistant'));
      }
    }
  }

  if (!hasAssistantTextInOutput && 'output_text' in payload) {
    messages.push(...messagesFromValue(payload['output_text'], 'assistant'));
  }

  return messages;
}

function extractMessagesFromChatCompletionsPayload(
  payload: Record<string, unknown>,
): PolicyEnforceParams.Message[] {
  const messages: PolicyEnforceParams.Message[] = [];
  const choices = payload['choices'];

  if (!Array.isArray(choices)) {
    return messages;
  }

  for (const choice of choices) {
    if (!choice || typeof choice !== 'object') {
      continue;
    }

    const choiceRecord = choice as Record<string, unknown>;
    const message = choiceRecord['message'];
    if (!message || typeof message !== 'object') {
      continue;
    }

    const messageRecord = message as Record<string, unknown>;
    messages.push(...messagesFromValue(messageRecord, 'assistant'));

    const toolCalls = messageRecord['tool_calls'];
    if (Array.isArray(toolCalls)) {
      for (const toolCall of toolCalls) {
        if (!toolCall || typeof toolCall !== 'object') {
          continue;
        }

        const toolCallRecord = toolCall as Record<string, unknown>;
        const fn = toolCallRecord['function'];
        if (!fn || typeof fn !== 'object') {
          continue;
        }

        const fnRecord = fn as Record<string, unknown>;
        messages.push(...messagesFromValue(fnRecord['arguments'], 'assistant'));
      }
    }
  }

  return messages;
}

function extractMessagesFromResponse(
  endpoint: 'responses' | 'chat_completions',
  payload: unknown,
): PolicyEnforceParams.Message[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const record = payload as Record<string, unknown>;
  if (endpoint === 'responses') {
    return extractMessagesFromResponsesPayload(record);
  }

  return extractMessagesFromChatCompletionsPayload(record);
}

function extractMessagesFromStreamChunks(
  endpoint: 'responses' | 'chat_completions',
  chunks: unknown[],
): PolicyEnforceParams.Message[] {
  if (endpoint === 'chat_completions') {
    const contentParts: string[] = [];
    const argumentParts: string[] = [];

    for (const chunk of chunks) {
      if (!chunk || typeof chunk !== 'object') {
        continue;
      }

      const record = chunk as Record<string, unknown>;
      const choices = record['choices'];
      if (!Array.isArray(choices)) {
        continue;
      }

      for (const choice of choices) {
        if (!choice || typeof choice !== 'object') {
          continue;
        }

        const delta = (choice as Record<string, unknown>)['delta'];
        if (!delta || typeof delta !== 'object') {
          continue;
        }

        const deltaRecord = delta as Record<string, unknown>;
        if (typeof deltaRecord['content'] === 'string') {
          contentParts.push(deltaRecord['content']);
        }

        const toolCalls = deltaRecord['tool_calls'];
        if (Array.isArray(toolCalls)) {
          for (const toolCall of toolCalls) {
            if (!toolCall || typeof toolCall !== 'object') {
              continue;
            }

            const fn = (toolCall as Record<string, unknown>)['function'];
            if (!fn || typeof fn !== 'object') {
              continue;
            }

            const args = (fn as Record<string, unknown>)['arguments'];
            if (typeof args === 'string') argumentParts.push(args);
          }
        }
      }
    }

    const messages: PolicyEnforceParams.Message[] = [];
    if (contentParts.length > 0) {
      messages.push({ role: 'assistant', content: contentParts.join('') });
    }

    if (argumentParts.length > 0) {
      messages.push({ role: 'assistant', content: argumentParts.join('') });
    }

    return messages;
  }

  const outputTextParts: string[] = [];
  let completedPayload: Record<string, unknown> | null = null;

  for (const chunk of chunks) {
    if (!chunk || typeof chunk !== 'object') {
      continue;
    }

    const record = chunk as Record<string, unknown>;
    const type = typeof record['type'] === 'string' ? record['type'] : '';

    if (type === 'response.output_text.delta') {
      if (typeof record['delta'] === 'string') {
        outputTextParts.push(record['delta']);
      }

      continue;
    }

    if (type === 'response.completed') {
      const response = record['response'];
      if (response && typeof response === 'object') {
        completedPayload = response as Record<string, unknown>;
      }
    }
  }

  if (completedPayload) {
    return extractMessagesFromResponsesPayload(completedPayload);
  }

  if (outputTextParts.length > 0) {
    return [{ role: 'assistant', content: outputTextParts.join('') }];
  }

  return [];
}

async function wrapStreamWithPolicy<T>(
  stream: AsyncIterable<T>,
  onComplete: (chunks: T[]) => Promise<void>,
): Promise<AsyncIterable<T>> {
  async function* generator(): AsyncGenerator<T> {
    const chunks: T[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
      yield chunk;
    }

    await onComplete(chunks);
  }

  return generator();
}

async function wrapOpenAICallResult(
  result: unknown,
  endpoint: 'responses' | 'chat_completions',
  requestMessages: PolicyEnforceParams.Message[],
  onEnforceOutput: (messages: PolicyEnforceParams.Message[]) => Promise<void>,
  isStream: boolean,
): Promise<unknown> {
  if (isStream && isAsyncIterable(result)) {
    warnStreamBuffering();
    return wrapStreamWithPolicy(result, async (chunks) => {
      const responseMessages = extractMessagesFromStreamChunks(endpoint, chunks as unknown[]);
      if (responseMessages.length > 0) {
        await onEnforceOutput([...requestMessages, ...responseMessages]);
      }
    });
  }

  const responseMessages = extractMessagesFromResponse(endpoint, result);
  if (responseMessages.length > 0) {
    await onEnforceOutput([...requestMessages, ...responseMessages]);
  }

  return result;
}

function patchCreateMethod(
  target: Record<string, unknown>,
  key: string,
  endpoint: 'responses' | 'chat_completions',
  options: GuardOpenAIClientOptions,
): boolean {
  const maybeFn = target[key];
  if (typeof maybeFn !== 'function') {
    return false;
  }

  const enforcer = buildPolicyEnforcer(options);
  const original = maybeFn as CreateFn;

  target[key] = function anthaleGuardedCreate(this: unknown, ...args: unknown[]): Promise<unknown> {
    const payload = (args[0] as Record<string, unknown>) ?? {};
    const requestMessages = extractMessagesFromRequest(endpoint, payload);

    const execute = async (): Promise<unknown> => {
      if (requestMessages.length > 0) {
        await enforcer.enforce({ direction: 'input', messages: requestMessages });
      }

      const result = await original.apply(this, args);
      const isStream = Boolean(payload['stream']);

      return wrapOpenAICallResult(
        result,
        endpoint,
        requestMessages,
        async (messages) => {
          await enforcer.enforce({ direction: 'output', messages });
        },
        isStream,
      );
    };

    return execute();
  };

  return true;
}

/**
 * Guard an existing OpenAI client instance in place.
 *
 * Supported call sites:
 * - `client.responses.create(...)`
 * - `client.chat.completions.create(...)`
 *
 * Behavior:
 * - Enforces `input` policy before request execution.
 * - Enforces `output` policy after response generation.
 * - For streaming calls, buffers chunks and enforces once on stream completion.
 *
 * The same client object is returned and marked as guarded for idempotency.
 *
 * @param openAIClient - OpenAI SDK client instance to instrument.
 * @param options - Anthale policy enforcer options.
 * @returns The same `openAIClient` instance, now guarded.
 * @throws {TypeError} If no supported OpenAI create method is exposed.
 *
 * @example
 * ```ts
 * import OpenAI from 'openai';
 * import { guardOpenAIClient } from 'anthale/integrations/openai';
 *
 * const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 * guardOpenAIClient(openai, {
 *   policyId: 'pol_123',
 *   apiKey: process.env.ANTHALE_API_KEY,
 *   metadata: { tenantId: 'acme' },
 * });
 *
 * const response = await openai.responses.create({
 *   model: 'gpt-4.1-mini',
 *   input: 'Hello!',
 * });
 * ```
 */
export function guardOpenAIClient<TClient extends OpenAIClientLike>(
  openAIClient: TClient,
  options: GuardOpenAIClientOptions,
): TClient {
  if (!openAIClient || typeof openAIClient !== 'object') {
    throw new TypeError('OpenAI client must be an object.');
  }

  if ((openAIClient as Record<symbol, unknown>)[OPENAI_GUARDED]) {
    return openAIClient;
  }

  const responsesPatched =
    openAIClient.responses && typeof openAIClient.responses === 'object' ?
      patchCreateMethod(openAIClient.responses as Record<string, unknown>, 'create', 'responses', options)
    : false;

  const chatPatched =
    (
      openAIClient.chat &&
      typeof openAIClient.chat === 'object' &&
      (openAIClient.chat as Record<string, unknown>)['completions'] &&
      typeof (openAIClient.chat as Record<string, unknown>)['completions'] === 'object'
    ) ?
      patchCreateMethod(
        ((openAIClient.chat as Record<string, unknown>)['completions'] as Record<string, unknown>) ?? {},
        'create',
        'chat_completions',
        options,
      )
    : false;

  if (!responsesPatched && !chatPatched) {
    throw new TypeError(
      "OpenAI client must expose either 'responses.create' or 'chat.completions.create' methods to be guarded.",
    );
  }

  (openAIClient as unknown as Record<symbol, boolean>)[OPENAI_GUARDED] = true;
  return openAIClient;
}

/**
 * Alias of {@link guardOpenAIClient}.
 */
export const guardClient = guardOpenAIClient;
