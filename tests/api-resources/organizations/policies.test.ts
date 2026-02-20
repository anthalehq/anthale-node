// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Anthale from 'anthale';

const client = new Anthale({
  apiKey: 'My API Key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource policies', () => {
  // Mock server tests are disabled
  test.skip('enforce: only required params', async () => {
    const responsePromise = client.organizations.policies.enforce('a90e34d6-41af-432f-a6ae-046598df4539', {
      direction: 'input',
      messages: [{ content: 'Can you summarize the plot of Interstellar?', role: 'user' }],
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  // Mock server tests are disabled
  test.skip('enforce: required and optional params', async () => {
    const response = await client.organizations.policies.enforce('a90e34d6-41af-432f-a6ae-046598df4539', {
      direction: 'input',
      messages: [{ content: 'Can you summarize the plot of Interstellar?', role: 'user' }],
      metadata: { foo: 'bar' },
    });
  });
});
