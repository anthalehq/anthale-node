import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { AnthalePolicyViolationError } from './src/integrations/core';
import { guardChatModel } from './src/integrations/langchain';

const runtimeImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<any>;

const SYSTEM_PROMPT =
  'You are a helpful weather assistant called WeatherBot. Always greet the user warmly and provide clear, concise information. If asked about anything unrelated to weather, politely redirect the conversation.';

async function main(): Promise<void> {
  const openaiKey = process.env['OPENAI_API_KEY'];
  const anthaleKey = process.env['ANTHALE_API_KEY'];
  const policyId = process.env['ANTHALE_POLICY_ID'];

  if (!openaiKey || !anthaleKey || !policyId) {
    throw new Error('Missing required env vars: OPENAI_API_KEY, ANTHALE_API_KEY, ANTHALE_POLICY_ID');
  }

  const modules = await loadLangChainModules();
  const guardedModel = buildGuardedModel({
    ChatOpenAI: modules.ChatOpenAI,
    openaiKey,
    anthaleKey,
    policyId,
  });

  const rl = createInterface({ input, output });
  const history: unknown[] = [];

  console.log('============================================================');
  console.log("  LangChain Chain + Anthale (async stream)  (type 'quit' to exit)");
  console.log('============================================================');
  console.log('');

  while (true) {
    let userInput = '';
    try {
      userInput = (await rl.question('You: ')).trim();
    } catch {
      console.log('\nGoodbye!');
      break;
    }

    if (!userInput) {
      continue;
    }

    if (
      userInput.toLowerCase() === 'quit' ||
      userInput.toLowerCase() === 'exit' ||
      userInput.toLowerCase() === 'bye'
    ) {
      console.log('Goodbye!');
      break;
    }

    try {
      const stream = await guardedModel.stream([
        { role: 'system', content: SYSTEM_PROMPT },
        ...history,
        new modules.HumanMessage(userInput),
      ]);

      process.stdout.write('Assistant: ');
      let aiResponse = '';

      for await (const chunk of stream) {
        const text = extractChunkText(chunk);
        if (!text) {
          continue;
        }

        process.stdout.write(text);
        aiResponse += text;
      }

      process.stdout.write('\n\n');

      history.push(new modules.HumanMessage(userInput));
      history.push(new modules.AIMessage(aiResponse));
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

async function loadLangChainModules(): Promise<{
  ChatOpenAI: new (...args: unknown[]) => any;
  HumanMessage: new (...args: unknown[]) => any;
  AIMessage: new (...args: unknown[]) => any;
}> {
  const openAIModule = await runtimeImport('@langchain/openai').catch(() => null);
  const langchainModule = await runtimeImport('langchain').catch(() => null);

  if (!openAIModule || !langchainModule) {
    throw new Error(
      'LangChain example dependencies are missing. Install them with: npm install anthale langchain @langchain/openai',
    );
  }

  const ChatOpenAI = openAIModule.ChatOpenAI;
  const HumanMessage = langchainModule.HumanMessage;
  const AIMessage = langchainModule.AIMessage;

  if (!ChatOpenAI || !HumanMessage || !AIMessage) {
    throw new Error('Could not resolve expected LangChain exports.');
  }

  return {
    ChatOpenAI,
    HumanMessage,
    AIMessage,
  };
}

function buildGuardedModel(options: {
  ChatOpenAI: new (...args: unknown[]) => any;
  openaiKey: string;
  anthaleKey: string;
  policyId: string;
}): any {
  const model = new options.ChatOpenAI({
    model: 'gpt-5-nano',
    apiKey: options.openaiKey,
  });

  const guardedModel = guardChatModel(model, {
    policyId: options.policyId,
    apiKey: options.anthaleKey,
    metadata: { example: 'langchain.main.ts' },
  });

  return guardedModel;
}

function extractChunkText(chunk: unknown): string {
  if (chunk == null) {
    return '';
  }

  if (typeof chunk === 'string') {
    return chunk;
  }

  if (typeof chunk !== 'object') {
    return String(chunk);
  }

  const content = (chunk as Record<string, unknown>)['content'];
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map((part) => {
      if (typeof part === 'string') {
        return part;
      }

      if (!part || typeof part !== 'object') {
        return '';
      }

      const text = (part as Record<string, unknown>)['text'];
      if (typeof text === 'string') {
        return text;
      }

      const nestedContent = (part as Record<string, unknown>)['content'];
      return typeof nestedContent === 'string' ? nestedContent : '';
    })
    .join('');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
