export type OllamaModel =
  | 'wizardlm2:8x22b'
  | 'llama3.1:70b-instruct-q4_K_M'
  | 'wizardlm2:7b'
  | 'deepseek-r1:14b'
  | 'mistral:7b-instruct-v0.3-q4_K_M'
  | 'qwen2.5:32b'
  | 'deepseek-coder:33b'
  | 'qwen2.5-coder:14b';

export type OllamaModelScope = Record<
  OllamaModel,
  {
    size: string;
    suitability: ('coding' | 'reasoning' | 'general')[];
    maxTokens: number;
  }
>;
export const availableOllamaModels: OllamaModelScope = {
  'wizardlm2:8x22b': {
    size: '8x22B',
    suitability: ['reasoning', 'coding', 'general'],
    maxTokens: 128000,
  },
  'llama3.1:70b-instruct-q4_K_M': {
    size: '70B',
    suitability: ['reasoning', 'coding', 'general'],
    maxTokens: 128000,
  },
  'wizardlm2:7b': {
    size: '7B',
    suitability: ['general'],
    maxTokens: 32000,
  },
  'deepseek-r1:14b': {
    size: '14B',
    suitability: ['coding', 'reasoning'],
    maxTokens: 128000,
  },
  'mistral:7b-instruct-v0.3-q4_K_M': {
    size: '7B',
    suitability: ['general', 'coding'],
    maxTokens: 32000,
  },
  'qwen2.5:32b': {
    size: '32B',
    suitability: ['coding', 'general'],
    maxTokens: 128000,
  },
  'deepseek-coder:33b': {
    size: '33B',
    suitability: ['coding'],
    maxTokens: 128000,
  },
  'qwen2.5-coder:14b': {
    size: '14B',
    suitability: ['coding'],
    maxTokens: 128000,
  },
};

/**
 * Estimates the token count for a given set of messages.
 * @param messages - Array of messages to estimate token count.
 * @returns Estimated number of tokens.
 */

/**
 * Selects the most suitable model based on task type and token estimate.
 * @param messages - Array of messages to estimate token count.
 * @param options - Options including task type.
 * @returns The selected model.
 */

export async function sendToOllama(
  messages: Array<{ role: string; content: string }>,
  options: {
    model?: OllamaModel;
    taskType?: 'coding' | 'reasoning' | 'general';
  } = {},
): Promise<string> {
  // Use provided model or default to wizardlm2:8x22b
  const selectedModel = options.model || 'wizardlm2:8x22b';

  // Estimate token count for logging

  try {
    const payload = { model: selectedModel, messages, stream: false };
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.message.content;
  } catch (error) {
    throw new Error(`Failed to communicate with Ollama: ${error.message}`);
  }
}
