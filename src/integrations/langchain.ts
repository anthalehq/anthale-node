import { MIDDLEWARE_BRAND, type AgentMiddleware } from 'langchain';
import type { PolicyEnforceParams } from '../resources/organizations/policies';
import {
  buildPolicyEnforcer,
  type PolicyEnforcerOptions,
  extractContent,
  normalizeRole,
  stringify,
} from './core';

let streamWarningIssued = false;

function toMessage(value: unknown): PolicyEnforceParams.Message | null {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    if (value.trim() === '') {
      return null;
    }

    return { role: 'user', content: value };
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const role = normalizeRole(record['role'] ?? record['type'] ?? 'user');
    const content = extractContent(record['text'] ?? record['content'] ?? value);
    if (!content || content.trim() === '' || content.trim() === 'None') {
      return null;
    }

    return { role, content };
  }

  const content = stringify(value);
  if (!content || content.trim() === '' || content.trim() === 'None') {
    return null;
  }

  return { role: 'user', content };
}

function flatten(value: unknown): unknown[] {
  if (value == null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(flatten);
  }

  if (typeof value !== 'object') {
    return [value];
  }

  const record = value as Record<string, unknown>;

  if (record['modelResponse'] !== undefined) {
    return flatten(record['modelResponse']);
  }

  if (record['result'] !== undefined) {
    return flatten(record['result']);
  }

  if (record['systemMessage'] !== undefined || record['messages'] !== undefined) {
    const items: unknown[] = [];
    if (record['systemMessage'] !== undefined) {
      items.push(record['systemMessage']);
    }

    const messages = record['messages'];
    if (Array.isArray(messages)) {
      items.push(...messages);
    }

    return items.flatMap(flatten);
  }

  const messages = record['messages'] as unknown;
  if (Array.isArray(messages)) {
    return (messages as unknown[]).flatMap(flatten);
  }

  return [value];
}

function extractMessages(value: unknown): PolicyEnforceParams.Message[] {
  const messages: PolicyEnforceParams.Message[] = [];
  for (const item of flatten(value)) {
    const message = toMessage(item);
    if (message) {
      messages.push(message);
    }
  }

  return messages;
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return typeof value === 'object' && value !== null && Symbol.asyncIterator in value;
}

function hasCallableMethod(
  value: unknown,
  method: string,
): value is Record<string, (...args: unknown[]) => unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    method in value &&
    typeof (value as Record<string, unknown>)[method] === 'function'
  );
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'then' in value &&
    typeof (value as PromiseLike<unknown>).then === 'function'
  );
}

function isGuardableModel(value: unknown): value is object {
  return (
    typeof value === 'object' &&
    value !== null &&
    (hasCallableMethod(value, 'invoke') ||
      hasCallableMethod(value, 'ainvoke') ||
      hasCallableMethod(value, 'stream') ||
      hasCallableMethod(value, 'astream') ||
      hasCallableMethod(value, 'bindTools') ||
      hasCallableMethod(value, 'bind') ||
      hasCallableMethod(value, 'withConfig') ||
      hasCallableMethod(value, 'withStructuredOutput'))
  );
}

function combineChunks(chunks: unknown[]): unknown {
  let combined: unknown = undefined;
  for (const chunk of chunks) {
    if (combined === undefined) {
      combined = chunk;
      continue;
    }

    try {
      combined = (combined as any) + chunk;
    } catch {
      combined = chunk;
    }
  }

  return combined;
}

async function wrapAsyncStreamWithPolicy(
  stream: AsyncIterable<unknown>,
  requestMessages: PolicyEnforceParams.Message[],
  enforceOutput: (messages: PolicyEnforceParams.Message[]) => Promise<void>,
): Promise<AsyncIterable<unknown>> {
  if (!streamWarningIssued) {
    streamWarningIssued = true;
    console.warn(
      'Anthale does not support real-time stream analysis. Output messages are buffered and analyzed once the stream completes.',
    );
  }

  async function* generator(): AsyncGenerator<unknown> {
    const chunks: unknown[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
      yield chunk;
    }

    const combined = combineChunks(chunks);
    if (combined !== undefined) {
      const responseMessages = extractMessages(combined);
      if (responseMessages.length > 0) {
        await enforceOutput([...requestMessages, ...responseMessages]);
      }
    }
  }

  return generator();
}

/**
 * Options for LangChain integration helpers.
 *
 * Inherits all policy enforcer options (`policyId`, `apiKey`, `client`,
 * `metadata`).
 */
export interface AnthaleLangchainMiddlewareOptions extends PolicyEnforcerOptions {}

/**
 * LangChain middleware that enforces Anthale policies for model and tool calls.
 *
 * The middleware:
 * - Enforces `input` before model/tool execution.
 * - Enforces `output` after model execution.
 *
 * @example
 * ```ts
 * import { AnthaleLangchainMiddleware } from 'anthale/integrations/langchain';
 *
 * const middleware = new AnthaleLangchainMiddleware({
 *   policyId: 'pol_123',
 *   apiKey: process.env.ANTHALE_API_KEY,
 *   metadata: { tenantId: 'acme' },
 * });
 * ```
 */
export class AnthaleLangchainMiddleware implements AgentMiddleware {
  readonly [MIDDLEWARE_BRAND] = true as const;
  name = 'AnthaleLangchainMiddleware';
  private readonly enforcer: ReturnType<typeof buildPolicyEnforcer>;

  /**
   * Create Anthale middleware for LangChain agents.
   *
   * @param options - Anthale policy enforcer options.
   */
  constructor(private readonly options: AnthaleLangchainMiddlewareOptions) {
    this.enforcer = buildPolicyEnforcer(this.options);
  }

  wrapModelCall: NonNullable<AgentMiddleware['wrapModelCall']> = async (
    request: any,
    handler: any,
  ): Promise<any> => {
    const requestMessages = extractMessages(request);
    if (requestMessages.length > 0) {
      await this.enforcer.enforce({ direction: 'input', messages: requestMessages });
    }

    const response = await handler(request);
    const responseMessages = extractMessages(response);
    if (responseMessages.length > 0) {
      await this.enforcer.enforce({
        direction: 'output',
        messages: [...requestMessages, ...responseMessages],
      });
    }

    return response;
  };

  wrapToolCall: NonNullable<AgentMiddleware['wrapToolCall']> = async (
    request: any,
    handler: any,
  ): Promise<any> => {
    const record = (request ?? {}) as Record<string, unknown>;
    const toolCall = (record['toolCall'] ?? record['tool_call'] ?? {}) as Record<string, unknown>;
    const args = toolCall['args'];
    const requestMessages = args === undefined ? [] : extractMessages(args);

    if (requestMessages.length > 0) {
      await this.enforcer.enforce({ direction: 'input', messages: requestMessages });
    }

    return handler(request);
  };
}

/**
 * Wrap a LangChain model-like object with Anthale input/output enforcement.
 *
 * Supported method interception:
 * - `invoke` / `ainvoke`
 * - `stream` / `astream`
 * - `bindTools`, `bind`, `withConfig`, `withStructuredOutput`
 *
 * Streaming caveat:
 * - Stream chunks are buffered and analyzed once the stream completes.
 * - A one-time warning is emitted to make this explicit.
 *
 * @param model - LangChain model-like object.
 * @param options - Anthale policy enforcer options.
 * @returns A guarded model proxy that preserves the original interface.
 *
 * @example
 * ```ts
 * import { guardChatModel } from 'anthale/integrations/langchain';
 *
 * const guarded = guardChatModel(model, {
 *   policyId: 'pol_123',
 *   apiKey: process.env.ANTHALE_API_KEY,
 * });
 *
 * const result = await guarded.invoke([{ role: 'user', content: 'Hello' }]);
 * ```
 */
export function guardChatModel<TModel extends object>(
  model: TModel,
  options: AnthaleLangchainMiddlewareOptions,
): TModel {
  const enforcer = buildPolicyEnforcer(options);
  const proxyCache = new WeakMap<object, object>();
  const wrapGuardedModel = <TValue>(value: TValue): TValue => {
    if (!isGuardableModel(value)) {
      return value;
    }

    return createGuardedModelProxy(value, enforcer, proxyCache) as TValue;
  };

  return wrapGuardedModel(model);
}

function createGuardedModelProxy<TModel extends object>(
  model: TModel,
  enforcer: ReturnType<typeof buildPolicyEnforcer>,
  proxyCache: WeakMap<object, object>,
): TModel {
  const existing = proxyCache.get(model);
  if (existing) {
    return existing as TModel;
  }

  const proxy = new Proxy(model, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      if (typeof value !== 'function') {
        return value;
      }

      if (
        prop === 'bindTools' ||
        prop === 'bind' ||
        prop === 'withConfig' ||
        prop === 'withStructuredOutput'
      ) {
        return (...args: unknown[]) => {
          const result = value.apply(target, args);
          if (isPromiseLike(result)) {
            return Promise.resolve(result).then((resolved) =>
              isGuardableModel(resolved) ? createGuardedModelProxy(resolved, enforcer, proxyCache) : resolved,
            );
          }

          return isGuardableModel(result) ? createGuardedModelProxy(result, enforcer, proxyCache) : result;
        };
      }

      if (prop === 'invoke' || prop === 'ainvoke') {
        return async (...args: unknown[]) => {
          const input = args[0];
          const requestMessages = extractMessages(input);
          if (requestMessages.length > 0) {
            await enforcer.enforce({ direction: 'input', messages: requestMessages });
          }

          const response = await value.apply(target, args);
          const responseMessages = extractMessages(response);
          if (responseMessages.length > 0) {
            await enforcer.enforce({
              direction: 'output',
              messages: [...requestMessages, ...responseMessages],
            });
          }

          return response;
        };
      }

      if (prop === 'stream' || prop === 'astream') {
        return async (...args: unknown[]) => {
          const input = args[0];
          const requestMessages = extractMessages(input);
          if (requestMessages.length > 0) {
            await enforcer.enforce({ direction: 'input', messages: requestMessages });
          }

          const streamResult = await value.apply(target, args);
          if (!isAsyncIterable(streamResult)) {
            return streamResult;
          }

          return wrapAsyncStreamWithPolicy(streamResult, requestMessages, async (messages) => {
            await enforcer.enforce({ direction: 'output', messages });
          });
        };
      }

      return value.bind(target);
    },
  });

  proxyCache.set(model, proxy);
  return proxy;
}

/**
 * Alias of {@link guardChatModel}.
 */
export const guardModel = guardChatModel;
