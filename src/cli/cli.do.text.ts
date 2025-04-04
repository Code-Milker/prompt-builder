// textProcessingFlow.ts - Text processing flow implementation

import type { Flow } from './cli.use.types';
import { printColored, promptUser, promptForNumber } from './cli.use.utils';

export function createTextProcessingFlow(): Flow {
  async function execute(input?: any): Promise<any> {
    if (!input || typeof input !== 'string') {
      printColored('No text input provided. Please provide some text.', 'red');
      const newInput = await promptUser('Enter text to process: ');
      input = newInput;
    }

    console.log('\nText to process:');
    console.log('---------------');
    console.log(input);
    console.log('---------------\n');

    console.log('Choose a text operation:');
    console.log('1. Convert to uppercase');
    console.log('2. Convert to lowercase');
    console.log('3. Count words and characters');
    console.log('4. Extract code blocks');
    console.log('5. Custom find and replace');

    const choice = await promptForNumber('Enter your choice (1-5): ', 1, 5);

    let result;
    switch (choice) {
      case 1:
        result = input.toUpperCase();
        break;
      case 2:
        result = input.toLowerCase();
        break;
      case 3:
        const wordCount = input
          .split(/\s+/)
          .filter((word) => word.length > 0).length;
        const charCount = input.length;
        result = `Words: ${wordCount}, Characters: ${charCount}\n\nOriginal text:\n${input}`;
        break;
      case 4:
        // Extract code blocks (text between ```)
        const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
        const codeBlocks = [];
        let match;
        while ((match = codeBlockRegex.exec(input)) !== null) {
          codeBlocks.push(match[1]);
        }
        result =
          codeBlocks.length > 0
            ? codeBlocks.join('\n\n---\n\n')
            : 'No code blocks found in the input text.';
        break;
      case 5:
        const searchTerm = await promptUser('Enter search term: ');
        const replacement = await promptUser('Enter replacement: ');
        result = input.replace(new RegExp(searchTerm, 'g'), replacement);
        break;
    }

    console.log('\nProcessed result:');
    console.log('----------------');
    console.log(result);

    return result;
  }

  return {
    name: 'text',
    description: 'do something with text',
    execute,
  };
}
