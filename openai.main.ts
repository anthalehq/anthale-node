#!/usr/bin/env -S npm run tsn -T

import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { AnthalePolicyViolationError } from './src/integrations/core';
import { guardOpenAIClient } from './src/integrations/openai';

const runtimeImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<any>;

async function main(): Promise<void> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthaleKey = process.env.ANTHALE_API_KEY;
  const policyId = '<your-policy-identifier>';

  if (!openaiKey || !anthaleKey || !policyId) {
    throw new Error('Missing required env vars: OPENAI_API_KEY, ANTHALE_API_KEY, ANTHALE_POLICY_ID');
  }

  const openaiModule = await runtimeImport('openai').catch(() => null);
  if (!openaiModule) {
    throw new Error("The 'openai' package is required. Install it with: pnpm add openai");
  }

  const OpenAI = openaiModule.default ?? openaiModule.OpenAI;
  if (!OpenAI) {
    throw new Error("Could not find OpenAI export in the 'openai' package.");
  }

  const openAIClient = new OpenAI({ apiKey: openaiKey });
  const guarded = guardOpenAIClient(openAIClient, {
    policyId,
    apiKey: anthaleKey,
    metadata: { example: 'openai.main.ts' },
  });

  const rl = createInterface({ input, output });
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: 'You are a helpful assistant.' },
  ];

  console.log("Agent ready. Type 'exit' or 'quit' to stop.");
  console.log('');

  while (true) {
    let userInput = '';
    try {
      userInput = (await rl.question('You: ')).trim();
    } catch {
      console.log('\nGoodbye!');
      break;
    }

    if (!userInput) continue;
    if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
      console.log('Goodbye!');
      break;
    }

    try {
      messages.push({ role: 'user', content: userInput });

      const completion = await guarded.chat.completions.create({
        model: 'gpt-5-nano',
        messages,
      });

      const assistantText = extractAssistantMessage(completion);

      console.log(`Assistant: ${assistantText}\n`);
      messages.push({ role: 'assistant', content: assistantText });
    } catch (error) {
      if (error instanceof AnthalePolicyViolationError) {
        console.log(`[BLOCKED by Anthale policy: ${error.enforcementIdentifier}]\n`);
        continue;
      }

      const message = error instanceof Error ? error.message : String(error);
      console.log(`[Error: ${message}]\n`);
    }
  }

  rl.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

function extractAssistantMessage(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return String(value);
  }

  const choices = (value as Record<string, unknown>)['choices'];
  if (!Array.isArray(choices) || choices.length === 0) {
    return JSON.stringify(value);
  }

  const firstChoice = choices[0];
  if (!firstChoice || typeof firstChoice !== 'object') {
    return JSON.stringify(firstChoice);
  }

  const message = (firstChoice as Record<string, unknown>)['message'];
  if (!message || typeof message !== 'object') {
    return JSON.stringify(firstChoice);
  }

  const content = (message as Record<string, unknown>)['content'];
  if (typeof content === 'string') {
    const trimmed = content.trim();
    return trimmed === '' ? '(empty response)' : trimmed;
  }

  if (Array.isArray(content)) {
    const joined = content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }

        if (!part || typeof part !== 'object') {
          return '';
        }

        const text = (part as Record<string, unknown>)['text'];
        return typeof text === 'string' ? text : '';
      })
      .join('')
      .trim();

    return joined === '' ? '(empty response)' : joined;
  }

  return '(empty response)';
}
