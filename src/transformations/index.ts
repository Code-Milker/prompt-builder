import type { Transformation } from '../dialectiq/types';

import fs from 'fs';
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
          if (!fs.existsSync(absolutePath)) {
            console.error(`File not found: ${absolutePath}`);
            contents[relativePath] = `Error: File not found`;
            continue;
          }
          contents[relativePath] = fs.readFileSync(absolutePath, 'utf-8');
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
  {
    name: 'extract-functions',
    description: 'Extract function names from TypeScript files',
    apply: async <T>(selections: T[], getName: (option: T) => string) => {
      const results: Record<string, string[]> = {};
      for (const selection of selections) {
        const relativePath = getName(selection);
        if (path.extname(relativePath) === '.ts') {
          const absolutePath = selection as string; // Fixed: Use selection as absolute path
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
  {
    name: 'to-markdown',
    description: 'Convert file contents to Markdown for LLM prompting',
    apply: <T>(selections: T[], getName: (option: T) => string) => {
      let markdown = `# Files Related to User Prompt\n\nHere are the selected files provided as context for the user prompt:\n\n`;
      for (const selection of selections) {
        const fullPath = selection as string;
        const relativePath = getName(selection);
        let fileContent = 'No content available';
        try {
          if (fs.existsSync(fullPath)) {
            fileContent = fs.readFileSync(fullPath, 'utf-8');
          } else {
            fileContent = `Error: File not found at ${fullPath}`;
          }
        } catch (err) {
          fileContent = `Error: ${(err as Error).message}`;
        }
        const ext = path.extname(relativePath).slice(1).toLowerCase() || '';
        markdown += `## \`${relativePath}\`\n\n`;
        markdown += '```' + ext + '\n';
        markdown += fileContent;
        markdown += '\n```\n\n';
      }
      markdown += '---\n*Use these files to respond to the user prompt.*\n';
      return markdown;
    },
  },
];
