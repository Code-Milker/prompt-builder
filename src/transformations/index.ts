import type { Transformation } from '../dialectiq/types';
import fs from 'fs';
import path from 'path';

export const transformations: Transformation[] = [
  {
    name: 'uppercase',
    description: '',
    apply: <T>(selections: T[], getName: (option: T) => string) => {
      return selections.map((s) => getName(s).toUpperCase());
    },
  },
  {
    name: 'fetch-content',
    description: '',
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
    description: '',
    apply: async <T>(selections: T[], getName: (option: T) => string) => {
      const results: Record<string, string[]> = {};
      for (const selection of selections) {
        const relativePath = getName(selection);
        if (path.extname(relativePath) === '.ts') {
          const absolutePath = selection as string;
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
    description:
      'Convert selected files to markdown with centered file names, file numbering, and clear delimiters',
    apply: <T>(selections: T[], getName: (option: T) => string) => {
      let markdown = '';
      const maxWidth = 80; // Maximum width for centered file name line
      const totalFiles = selections.length;

      selections.forEach((selection, index) => {
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

        // File number (e.g., File 1/13)
        const fileNumber = `File ${index + 1}/${totalFiles}`;

        // Center the file name
        const fileName = `${fileNumber} Path ${relativePath}`;
        const paddingLength = Math.max(0, (maxWidth - fileName.length - 6) / 2); // 6 for '###' on both sides
        const leftPadding = ' '.repeat(Math.floor(paddingLength));
        const rightPadding = ' '.repeat(Math.ceil(paddingLength));
        const centeredFileName = `###${leftPadding}${fileName}${rightPadding}###`;

        // Add section to markdown
        markdown += `\n${centeredFileName}\n${fileContent}`;
      });

      return markdown.trim();
    },
  },
];
