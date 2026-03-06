import { guardClient, guardOpenAIClient } from 'anthale/integrations/openai';
import type { PolicyEnforceResponse } from 'anthale/resources/organizations/policies';

function allowResponse(): PolicyEnforceResponse {
  return {
    action: 'allow',
    enforcerIdentifier: 'enf_allow',
  };
}

function fakeAnthaleClient(response: PolicyEnforceResponse) {
  const calls: Array<{ policyId: string; body: unknown }> = [];
  const client = {
    organizations: {
      policies: {
        enforce: (policyId: string, body: unknown) => {
          calls.push({ policyId, body });
          return response;
        },
      },
    },
  };
  return { client, calls };
}

function chatStreamChunks(): AsyncIterable<unknown> {
  async function* gen() {
    yield { choices: [{ delta: { role: 'assistant', content: 'Hello' } }] };
    yield { choices: [{ delta: { content: ' world' } }] };
  }
  return gen();
}

describe('guardOpenAIClient', () => {
  test('guardClient is an alias', () => {
    expect(guardClient).toBe(guardOpenAIClient);
  });

  test('returns same client and enforces responses input/output', async () => {
    const { client: anthaleClient, calls } = fakeAnthaleClient(allowResponse());

    const openAIClient = {
      responses: {
        create: async (_params?: unknown) => ({
          output_text: 'Hi there',
        }),
      },
    };

    const guarded = guardOpenAIClient(openAIClient, {
      policyId: 'pol_123',
      client: anthaleClient,
    });

    expect(guarded).toBe(openAIClient);
    await guarded.responses.create({
      input: 'hello',
    });

    expect(calls).toHaveLength(2);
    expect((calls[0]?.body as any).direction).toBe('input');
    expect((calls[1]?.body as any).direction).toBe('output');
  });

  test('enforces chat stream output after buffering and warns once', async () => {
    const { client: anthaleClient, calls } = fakeAnthaleClient(allowResponse());
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const openAIClient = {
      chat: {
        completions: {
          create: async (_params?: unknown) => chatStreamChunks(),
        },
      },
    };

    guardOpenAIClient(openAIClient, {
      policyId: 'pol_123',
      client: anthaleClient,
    });

    const stream1 = await openAIClient.chat.completions.create({
      stream: true,
      messages: [{ role: 'user', content: 'hello' }],
    });
    const chunks1: unknown[] = [];
    for await (const chunk of stream1 as AsyncIterable<unknown>) {
      chunks1.push(chunk);
    }

    const stream2 = await openAIClient.chat.completions.create({
      stream: true,
      messages: [{ role: 'user', content: 'again' }],
    });
    for await (const _chunk of stream2 as AsyncIterable<unknown>) {
      // consume
    }

    expect(chunks1).toHaveLength(2);
    expect(calls.length).toBeGreaterThanOrEqual(4);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  test('is idempotent when called twice on same client', async () => {
    const { client: anthaleClient, calls } = fakeAnthaleClient(allowResponse());

    const openAIClient = {
      responses: {
        create: async (_params?: unknown) => ({ output_text: 'ok' }),
      },
    };

    guardOpenAIClient(openAIClient, { policyId: 'pol_123', client: anthaleClient });
    guardOpenAIClient(openAIClient, { policyId: 'pol_123', client: anthaleClient });

    await openAIClient.responses.create({ input: 'hi' });
    expect(calls).toHaveLength(2);
  });

  test('throws TypeError for unsupported client shape', () => {
    expect(() =>
      guardOpenAIClient({} as any, {
        policyId: 'pol_123',
        client: fakeAnthaleClient(allowResponse()).client,
      }),
    ).toThrow(TypeError);
  });
});
