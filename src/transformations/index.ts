import type { Transformation } from '../dialectiq/types';

import fs from 'fs'; // For synchronous fs.readFileSync
import path from 'path';
export const transformations: Transformation[] = [
  {
    name: 'uppercase',
    description: 'Convert selected text to uppercase',
    apply: <T>(selections: T[], getName: (option: T) => string) => {
      return selections.map((s) => getName(s).toUpperCase());
    },
  },
  {
    name: 'fetch-content',
    description: 'Get file content for selected files',
    apply: <T>(selections: T[], getName: (option: T) => string) => {
      const contents: Record<string, string> = {};
      for (const selection of selections) {
        const relativePath = getName(selection);
        const absolutePath = selection as string;
        try {
          // Check if file exists and is readable before reading
          if (!fs.existsSync(absolutePath)) {
            console.error(`File not found: ${absolutePath}`);
            contents[relativePath] = `Error: File not found`;
            continue;
          }
          contents[relativePath] = fs.readFileSync(absolutePath, 'utf-8');
          // console.log(`Successfully read: ${relativePath}`);
        } catch (err) {
          console.error(
            `Error reading ${absolutePath}: ${(err as Error).message}`,
          );
          contents[relativePath] = `Error: ${(err as Error).message}`;
        }
      }
      return contents;
    },
  },
  ,
  {
    name: 'extract-functions',
    description: 'Extract function names from TypeScript files',
    apply: async <T>(selections: T[], getName: (option: T) => string) => {
      const results: Record<string, string[]> = {};
      for (const selection of selections) {
        const relativePath = getName(selection); // Relative path for key
        if (path.extname(relativePath) === '.ts') {
          const absolutePath = relativePath; // Absolute path for reading
          try {
            const content = await fs.promises.readFile(absolutePath, 'utf-8');
            const functionMatches = content.match(/function\s+(\w+)/g) || [];
            results[relativePath] = functionMatches.map((m) =>
              m.replace('function ', ''),
            );
          } catch (err) {
            results[relativePath] = [`Error: ${(err as Error).message}`];
          }
        }
      }
      return results;
    },
  },
];
