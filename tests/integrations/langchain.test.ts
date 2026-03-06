import { AnthaleLangchainMiddleware, guardChatModel, guardModel } from 'anthale/integrations/langchain';
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

function streamChunks(): AsyncIterable<string> {
  async function* gen() {
    yield 'Hello';
    yield ' ';
    yield 'World';
  }
  return gen();
}

describe('AnthaleLangchainMiddleware', () => {
  test('wrapModelCall enforces input and output', async () => {
    const { client, calls } = fakeAnthaleClient(allowResponse());
    const middleware = new AnthaleLangchainMiddleware({
      policyId: 'pol_123',
      client,
    });

    const response = await middleware.wrapModelCall(
      {
        messages: [{ role: 'user', content: 'hello' }],
      },
      async () => ({ role: 'assistant', content: 'ok' }),
    );

    expect(response).toEqual({ role: 'assistant', content: 'ok' });
    expect(calls).toHaveLength(2);
    expect((calls[0]?.body as any).direction).toBe('input');
    expect((calls[1]?.body as any).direction).toBe('output');
  });

  test('wrapToolCall enforces input only', async () => {
    const { client, calls } = fakeAnthaleClient(allowResponse());
    const middleware = new AnthaleLangchainMiddleware({
      policyId: 'pol_123',
      client,
    });

    const result = await middleware.wrapToolCall(
      {
        toolCall: {
          name: 'search',
          args: { q: 'hello' },
        },
      },
      async () => 'tool-ok',
    );

    expect(result).toBe('tool-ok');
    expect(calls).toHaveLength(1);
    expect((calls[0]?.body as any).direction).toBe('input');
  });
});

describe('guardChatModel', () => {
  test('guardModel is an alias', () => {
    expect(guardModel).toBe(guardChatModel);
  });

  test('invoke enforces input and output', async () => {
    const { client, calls } = fakeAnthaleClient(allowResponse());

    const model = {
      async invoke(value: unknown) {
        return { role: 'assistant', content: `ok:${String(value)}` };
      },
    };

    const guarded = guardChatModel(model, { policyId: 'pol_123', client });
    const response = await (guarded as any).invoke({ role: 'user', content: 'hello' });

    expect(response).toEqual({ role: 'assistant', content: 'ok:[object Object]' });
    expect(calls).toHaveLength(2);
    expect((calls[0]?.body as any).direction).toBe('input');
    expect((calls[1]?.body as any).direction).toBe('output');
  });

  test('stream buffers output and warns once', async () => {
    const { client, calls } = fakeAnthaleClient(allowResponse());
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const model = {
      async invoke(value: unknown) {
        return { role: 'assistant', content: value };
      },
      async stream() {
        return streamChunks();
      },
    };

    const guarded = guardChatModel(model, { policyId: 'pol_123', client });
    const stream = await (guarded as any).stream({ role: 'user', content: 'hello' });

    const parts: string[] = [];
    for await (const chunk of stream as AsyncIterable<string>) {
      parts.push(chunk);
    }

    expect(parts.join('')).toBe('Hello World');
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  test('bindTools returns a guarded model', async () => {
    const { client, calls } = fakeAnthaleClient(allowResponse());

    const boundModel = {
      async invoke(value: unknown) {
        return { role: 'assistant', content: `bound:${String(value)}` };
      },
    };

    const model = {
      bindTools() {
        return boundModel;
      },
    };

    const guarded = guardChatModel(model, { policyId: 'pol_123', client });
    const toolBoundModel = (guarded as any).bindTools([]);
    const response = await (toolBoundModel as any).invoke({ role: 'user', content: 'hello' });

    expect(response).toEqual({ role: 'assistant', content: 'bound:[object Object]' });
    expect(calls).toHaveLength(2);
    expect((calls[0]?.body as any).direction).toBe('input');
    expect((calls[1]?.body as any).direction).toBe('output');
  });
});
