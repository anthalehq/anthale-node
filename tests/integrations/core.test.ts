import {
  AnthalePolicyViolationError,
  PolicyEnforcer,
  type PolicyEnforcerClient,
} from 'anthale/integrations/core';
import type { PolicyEnforceResponse } from 'anthale/resources/organizations/policies';

function allowResponse(): PolicyEnforceResponse {
  return {
    action: 'allow',
    enforcerIdentifier: 'enf_123',
  };
}

function blockResponse(): PolicyEnforceResponse {
  return {
    action: 'block',
    enforcerIdentifier: 'enf_blocked',
  };
}

function fakeClient(response: PolicyEnforceResponse): {
  client: PolicyEnforcerClient;
  calls: Array<{ policyId: string; body: unknown }>;
} {
  const calls: Array<{ policyId: string; body: unknown }> = [];
  const client: PolicyEnforcerClient = {
    organizations: {
      policies: {
        enforce: (policyId, body) => {
          calls.push({ policyId, body });
          return response;
        },
      },
    },
  };

  return { client, calls };
}

describe('PolicyEnforcer', () => {
  test('merges metadata and enforces includeEvaluations=false', async () => {
    const { client, calls } = fakeClient(allowResponse());
    const enforcer = new PolicyEnforcer({
      policyId: 'pol_123',
      client,
      metadata: { tenant: 'acme', env: 'prod' },
    });

    await enforcer.enforce({
      direction: 'input',
      messages: [{ role: 'user', content: 'hello' }],
      metadata: { env: 'staging', traceId: 't-1' },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.policyId).toBe('pol_123');
    expect(calls[0]?.body).toEqual({
      direction: 'input',
      includeEvaluations: false,
      messages: [{ role: 'user', content: 'hello' }],
      metadata: { tenant: 'acme', env: 'staging', traceId: 't-1' },
    });
  });

  test('throws AnthalePolicyViolationError when action is block', async () => {
    const { client } = fakeClient(blockResponse());
    const enforcer = new PolicyEnforcer({ policyId: 'pol_123', client });

    await expect(
      enforcer.enforce({
        direction: 'output',
        messages: [{ role: 'assistant', content: 'secret' }],
      }),
    ).rejects.toBeInstanceOf(AnthalePolicyViolationError);
  });
});
