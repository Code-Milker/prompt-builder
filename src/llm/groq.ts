export type GroqModel =
  | 'llama-3.3-70b-versatile'
  | 'deepseek-r1-distil-llama-70b';

export type GroqModelScope = Record<
  GroqModel,
  {
    size: string;
    suitability: ('coding' | 'reasoning' | 'general')[];
    maxTokens: number;
  }
>;

export const availableGroqModels: GroqModelScope = {
  'llama-3.3-70b-versatile': {
    size: '70B',
    suitability: ['coding', 'reasoning', 'general'],
    maxTokens: 8192,
  },
  'deepseek-r1-distil-llama-70b': {
    size: '70B',
    suitability: ['coding'],
    maxTokens: 8192,
  },
};

/**
 * Estimates the token count for a given set of messages.
 * @param messages - Array of messages to estimate token count.
 * @returns Estimated number of tokens.
 */

/**
 * Sends a request to the Groq API for chat completion.
 * @param messages - Array of messages to send.
 * @param options - Options including model and task type.
 * @returns The response content as a string.
 */
export async function sendToGroq(
  messages: Array<{ role: string; content: string }>,
  options: {
    model?: GroqModel;
    taskType?: 'coding' | 'reasoning' | 'general';
  } = {},
): Promise<string> {
  // Use provided model or default to llama-4-maverick-17b-128e-instruct
  const selectedModel = options.model || 'llama-3.3-70b-versatile';

  // Estimate token count for logging

  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY environment variable is not set.');
    }

    const payload = {
      model: selectedModel,
      messages,
      stream: false,
      temperature: 0.5,
      max_tokens: 1024,
      top_p: 1,
      stop: null,
    };
    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    throw new Error(`Failed to communicate with Groq: ${error.message}`);
  }
}
