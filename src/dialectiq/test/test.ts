// Example usage of transformations feature

import fs from 'fs/promises';
import path from 'path';
import { selectOption3 } from '../index';

// Example transformations
const transformations = [
  {
    name: 'uppercase',
    description: 'Convert selected text to uppercase',
    apply: (selections, getName) => {
      return selections.map((s) => getName(s).toUpperCase());
    },
  },
  {
    name: 'fetch-content',
    description: 'Get file content for selected files',
    apply: async (selections, getName) => {
      const contents = {};
      for (const selection of selections) {
        const filepath = getName(selection);
        try {
          contents[filepath] = await fs.readFile(filepath, 'utf-8');
        } catch (err) {
          contents[filepath] = `Error: ${err.message}`;
        }
      }
      return contents;
    },
  },
  {
    name: 'extract-functions',
    description: 'Extract function names from TypeScript files',
    apply: async (selections, getName) => {
      const results = {};
      for (const selection of selections) {
        const filepath = getName(selection);
        if (path.extname(filepath) === '.ts') {
          // Would normally use a TypeScript parser here
          try {
            const content = await fs.readFile(filepath, 'utf-8');
            const functionMatches = content.match(/function\s+(\w+)/g) || [];
            results[filepath] = functionMatches.map((m) =>
              m.replace('function ', ''),
            );
          } catch (err) {
            results[filepath] = `Error: ${err.message}`;
          }
        }
      }
      return results;
    },
  },
];

async function main() {
  const files = ['file1.ts', 'file2.ts', 'file3.js'];

  const result = await selectOption3({
    options: files,
    getName: (file) => file,
    history: ['Previous selections here...'],
    state: { currentDirectory: process.cwd() },
    transformations,
    customCommands: ['myCustomCommand'],
  });

  console.log({ result });
}

main();
