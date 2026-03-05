import { Anthale } from '../client';
import { AnthaleError } from '../core/error';
import type { PolicyEnforceParams, PolicyEnforceResponse } from '../resources/organizations/policies';

/**
 * Minimal Anthale client contract required by {@link PolicyEnforcer}.
 *
 * Pass your own client when you need shared configuration (timeouts, retries,
 * telemetry), or let the enforcer construct one with `apiKey`.
 */
export interface PolicyEnforcerClient {
  organizations: {
    policies: {
      enforce: (
        policyIdentifier: string,
        body: PolicyEnforceParams,
      ) => PromiseLike<PolicyEnforceResponse> | PolicyEnforceResponse;
    };
  };
}

/**
 * Options used to construct a {@link PolicyEnforcer}.
 */
export interface PolicyEnforcerOptions {
  /**
   * Anthale policy identifier to enforce.
   */
  policyId: string;
  /**
   * Anthale API key used only when `client` is not provided.
   */
  apiKey?: string;
  /**
   * Optional pre-built Anthale client.
   */
  client?: PolicyEnforcerClient;
  /**
   * Metadata merged into every enforcement call.
   */
  metadata?: Record<string, unknown>;
}

/**
 * Parameters for a single policy enforcement call.
 */
export interface EnforceOptions {
  /**
   * Enforcement direction (`input` or `output`).
   */
  direction: PolicyEnforceParams['direction'];
  /**
   * Conversation messages to evaluate.
   */
  messages: PolicyEnforceParams['messages'];
  /**
   * Optional metadata merged over constructor metadata for this call.
   */
  metadata?: Record<string, unknown>;
}

/**
 * Error raised when Anthale returns a blocking action.
 *
 * @example
 * ```ts
 * import { AnthalePolicyViolationError } from 'anthale/integrations/core';
 *
 * try {
 *   // ...
 * } catch (error) {
 *   if (error instanceof AnthalePolicyViolationError) {
 *     console.error(error.enforcementIdentifier);
 *   }
 * }
 * ```
 */
export class AnthalePolicyViolationError extends AnthaleError {
  readonly enforcementIdentifier: string;

  constructor(enforcementIdentifier: string) {
    super(`Policy enforcement '${enforcementIdentifier}' was blocked due to a policy violation.`);
    this.enforcementIdentifier = enforcementIdentifier;
  }
}

/**
 * Lightweight policy enforcer used by provider integrations.
 *
 * It always calls Anthale with `includeEvaluations: false` and throws
 * {@link AnthalePolicyViolationError} when the resulting action is `block`.
 */
export class PolicyEnforcer {
  private readonly client: PolicyEnforcerClient;
  private readonly policyId: string;
  private readonly metadata: Record<string, unknown>;

  /**
   * Create a policy enforcer.
   *
   * @param options - Enforcer options.
   */
  constructor(options: PolicyEnforcerOptions) {
    this.client = options.client ?? new Anthale({ apiKey: options.apiKey });
    this.policyId = options.policyId;
    this.metadata = options.metadata ?? {};
  }

  /**
   * Enforce the configured Anthale policy on a message set.
   *
   * @param options - Enforcement options.
   * @returns The raw Anthale enforcement response.
   * @throws {AnthalePolicyViolationError} When Anthale action is `block`.
   */
  async enforce(options: EnforceOptions): Promise<PolicyEnforceResponse> {
    const response = await this.client.organizations.policies.enforce(this.policyId, {
      direction: options.direction,
      messages: options.messages,
      includeEvaluations: false,
      metadata: { ...this.metadata, ...(options.metadata ?? {}) },
    });

    if (response.action === 'block') {
      throw new AnthalePolicyViolationError(response.enforcerIdentifier);
    }

    return response;
  }
}

/**
 * Convenience factory for {@link PolicyEnforcer}.
 */
export function buildPolicyEnforcer(options: PolicyEnforcerOptions): PolicyEnforcer {
  return new PolicyEnforcer(options);
}

type MessageRole = PolicyEnforceParams.Message['role'];

const ROLE_MAP: Record<string, MessageRole> = {
  system: 'system',
  developer: 'system',
  machine: 'system',
  user: 'user',
  human: 'user',
  assistant: 'assistant',
  ai: 'assistant',
  tool: 'tool',
  function: 'tool',
};

/**
 * Normalize a role-like value to one of Anthale's supported roles.
 *
 * Unknown or non-string values fall back to `user`.
 */
export function normalizeRole(value: unknown): MessageRole {
  if (typeof value !== 'string') {
    return 'user';
  }

  return ROLE_MAP[value.toLowerCase()] ?? 'user';
}

/**
 * Safely stringify arbitrary values for message content.
 */
export function stringify(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value == null) {
    return String(value);
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

/**
 * Normalize different message content shapes to a plain string.
 *
 * Handles raw strings, block arrays, and nested mappings commonly returned by
 * OpenAI and LangChain payloads.
 */
export function extractContent(raw: unknown): string {
  if (raw == null) {
    return '';
  }

  if (typeof raw === 'string') {
    return raw;
  }

  if (Array.isArray(raw)) {
    const parts = raw
      .map((block) => {
        if (typeof block === 'string') {
          return block;
        }

        if (block && typeof block === 'object') {
          const record = block as Record<string, unknown>;
          return extractContent(
            record['text'] ??
              record['output_text'] ??
              record['input_text'] ??
              record['content'] ??
              record['arguments'] ??
              block,
          );
        }

        return stringify(block);
      })
      .filter((part) => part.length > 0);

    return parts.join('\n');
  }

  if (typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    return extractContent(
      record['text'] ?? record['output_text'] ?? record['input_text'] ?? record['content'] ?? stringify(raw),
    );
  }

  return stringify(raw);
}

/**
 * Convert a role/content pair into an Anthale message.
 *
 * Empty/blank content returns `null`.
 */
export function toAnthaleMessage(value: {
  role: unknown;
  content: unknown;
}): PolicyEnforceParams.Message | null {
  const content = extractContent(value.content);
  if (!content || content.trim() === '' || content.trim() === 'None') {
    return null;
  }

  return {
    role: normalizeRole(value.role),
    content,
  };
}

/**
 * Recursively convert unknown payload values into Anthale messages.
 *
 * This function is intentionally permissive so integrations can normalize
 * heterogeneous provider payloads with a single utility.
 */
export function messagesFromValue(value: unknown, defaultRole: MessageRole): PolicyEnforceParams.Message[] {
  if (value == null) {
    return [];
  }

  if (Array.isArray(value)) {
    const out: PolicyEnforceParams.Message[] = [];
    for (const item of value) {
      out.push(...messagesFromValue(item, defaultRole));
    }

    return out;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const message = toAnthaleMessage({
      role: record['role'] ?? defaultRole,
      content:
        record['content'] ??
        record['text'] ??
        record['input_text'] ??
        record['output_text'] ??
        record['arguments'],
    });

    return message == null ? [] : [message];
  }

  const content = stringify(value);
  if (!content || content.trim() === '' || content.trim() === 'None') {
    return [];
  }

  return [{ role: normalizeRole(defaultRole), content }];
}
