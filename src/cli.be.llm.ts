// src/cli.do.llm.ts - LLM Agent Flow for interacting with Ollama and executing CLI commands

import type { Flow } from './cli.use.types';
import Bun from 'bun';
import { promptUser } from './cli.use.utils';

// Determine the operating system for appropriate command usage
const os = process.platform;
const osName = os === 'win32' ? 'Windows' : os === 'darwin' ? 'macOS' : 'Linux';

// System prompt to guide the LLM's behavior
const systemPrompt = `
You are an AI assistant that can interact with the user and perform tasks using the command line interface (CLI). When the user asks you to perform a task that requires executing a CLI command, you should respond with a JSON object in the following format: {'action': 'execute', 'command': '<the command to execute>'}. After executing the command, you will receive the output or error message, and then you can provide a final response to the user. If the user's request does not require executing a command, respond with {'action': 'respond', 'response': '<your response>'}. Always output valid JSON.

The operating system is ${osName}, so use appropriate commands (e.g., 'dir' for Windows, 'ls' for Unix-like systems).
`;

// Function to send messages to Ollama's chat API
async function sendToOllama(
  messages: any[],
  model: string = 'qwen2.5-coder:14b',
): Promise<string> {
  try {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
      }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.message.content;
  } catch (error) {
    throw new Error(`Failed to communicate with Ollama: ${error.message}`);
  }
}

// Function to execute CLI commands using Bun's spawnSync
function executeCommand(command: string): [boolean, string] {
  try {
    // Simple space-separated argument splitting (Note: May need enhancement for quoted args)
    const args = command.split(' ');
    const proc = Bun.spawnSync(args);
    if (proc.exitCode === 0) {
      return [true, proc.stdout.toString().trim()];
    } else {
      return [false, proc.stderr.toString().trim() || 'Unknown error'];
    }
  } catch (error) {
    return [false, `Execution error: ${error.message}`];
  }
}

// Create the LLM Agent Flow
export function createLLMAgentFlow(): Flow {
  async function execute(input?: any): Promise<any> {
    // Initialize conversation history with system prompt
    let messages = [{ role: 'system', content: systemPrompt }];
    console.log(
      "LLM Agent is ready. Type 'exit' or 'quit' to end the conversation.",
    );

    while (true) {
      // Get user input
      const userInput = await promptUser('You: ');
      if (
        userInput.toLowerCase() === 'exit' ||
        userInput.toLowerCase() === 'quit'
      ) {
        break;
      }

      // Add user input to conversation history
      messages.push({ role: 'user', content: userInput });

      try {
        // Send to Ollama and get response
        const response = await sendToOllama(messages);
        let responseJson;
        try {
          responseJson = JSON.parse(response);
        } catch (e) {
          console.log('Error: LLM did not return valid JSON:', response);
          continue;
        }

        const action = responseJson.action;
        if (action === 'respond') {
          // Direct response from LLM
          console.log('Assistant:', responseJson.response);
          messages.push({ role: 'assistant', content: response });
        } else if (action === 'execute') {
          // Execute CLI command
          const command = responseJson.command;
          console.log(`Executing command: ${command}`);
          const [success, output] = executeCommand(command);

          // Prepare message with command output or error
          const outputMessage = success
            ? `The command '${command}' produced the following output: ${output}`
            : `The command '${command}' failed with error: ${output}`;

          // Add output message to conversation
          messages.push({ role: 'user', content: outputMessage });

          // Get final response from LLM
          const finalResponse = await sendToOllama(messages);
          console.log('Assistant:', finalResponse);
          messages.push({ role: 'assistant', content: finalResponse });
        } else {
          console.log('Error: Unknown action in response:', responseJson);
        }
      } catch (error) {
        console.log('Error:', error.message);
      }
    }

    return 'Conversation ended.';
  }

  return {
    name: 'llm.agent',
    description: 'Interact with an Ollama LLM that can execute CLI commands',
    execute,
  };
}
