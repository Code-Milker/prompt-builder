// fileSelectionFlow.ts - Native file selection using Bun’s process spawning
import Bun from 'bun';
import fs from 'fs';
import path from 'path';
import {
  colors,
  displayPaginated,
  promptForNumber,
  promptUser,
  selectOption,
} from './cli.use.utils';
import type { Flow } from './cli.use.types';

export function createFileSelectionFlow(): Flow {
  // Helper to list files using Bun’s native APIs
  async function listFiles(
    dir: string,
    maxDepth: number = 3,
  ): Promise<string[]> {
    const files: string[] = [];
    const walkDir = async (currentDir: string, depth: number) => {
      if (depth > maxDepth) return;
      const entries = await fs.promises.readdir(currentDir, {
        withFileTypes: true,
      });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          if (!['.git', 'node_modules', 'dist', 'build'].includes(entry.name)) {
            await walkDir(fullPath, depth + 1);
          }
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    };
    await walkDir(dir, 0);
    return files;
  }

  // Helper to select files interactively
  async function selectFiles(files: string[]): Promise<string[]> {
    if (files.length === 0) {
      console.log('No files found.');
      process.exit(0);
    }

    const selectedFiles = await selectOption(
      files,
      (file) => path.relative(process.cwd(), file),
      (file, input) => {
        const name = path.relative(process.cwd(), file);
        const lowerName = name.toLowerCase();
        const lowerInput = input.toLowerCase();
        const matchIndex = lowerName.indexOf(lowerInput);
        if (matchIndex !== -1 && input.length > 0) {
          const prefix = name.slice(0, matchIndex);
          const match = name.slice(matchIndex, matchIndex + input.length);
          const suffix = name.slice(matchIndex + input.length);
          return `${prefix}${colors.cyan}${match}${colors.reset}${suffix}`;
        }
        return name;
      },
      [], // No history for file selection
      50,
    );

    if (selectedFiles.length === 0) {
      console.log('No files selected.');
      process.exit(0);
    }

    return selectedFiles;
  }

  // Main execution logic
  async function execute(input?: any): Promise<any> {
    const projectRoot = process.cwd();

    console.log('Listing files...');
    const files = await listFiles(projectRoot);
    const selectedFiles = await selectFiles(files);

    let outputWithColors = '\n**Results:**\n';
    let outputWithoutColors = '\n**Results:**\n';
    const separatorLine = '─'.repeat(50);

    for (const [index, file] of selectedFiles.entries()) {
      console.log(`\nProcessing file: ${file}`);
      let content = '';
      let choice;

      do {
        choice = await promptUser(
          'How to process this file? (f: full file, r: select range, p: read paginated, s: skip)\n' +
            ' - f: Include the entire file content.\n' +
            ' - r: Select a range of lines to include (you can view the file first).\n' +
            ' - p: Read the file in paginated mode (50 lines per page), then choose again.\n' +
            ' - s: Skip this file and move to the next.\n' +
            'Enter your choice: ',
        );

        if (choice.toLowerCase() === 'f') {
          content = await Bun.file(file).text();
        } else if (choice.toLowerCase() === 'r') {
          const viewChoice = await promptUser(
            'View file before selecting range? (p: paginated, a: all, n: no)\n' +
              ' - p: View 50 lines at a time (press Enter to continue, q to stop).\n' +
              ' - a: View all lines at once.\n' +
              ' - n: Skip viewing and enter line numbers directly.\n' +
              'Enter your choice: ',
          );
          const fileContent = await Bun.file(file).text();
          const lines = fileContent.split('\n');
          const totalLines = lines.length;
          console.log(`\nFile: ${file} (${totalLines} lines)`);

          if (viewChoice.toLowerCase() === 'p') {
            await displayPaginated(lines, totalLines);
          } else if (viewChoice.toLowerCase() === 'a') {
            lines.forEach((line, i) =>
              console.log(`${(i + 1).toString().padStart(4)} ${line}`),
            );
          }

          const start = await promptForNumber('Start line: ', 1, totalLines);
          const end = await promptForNumber('End line: ', start, totalLines);
          content = lines.slice(start - 1, end).join('\n');
        } else if (choice.toLowerCase() === 'p') {
          const fileContent = await Bun.file(file).text();
          const lines = fileContent.split('\n');
          const totalLines = lines.length;
          console.log(`\nFile: ${file} (${totalLines} lines)`);
          await displayPaginated(lines, totalLines);
          console.log('Finished reading. Returning to options.');
        } else if (choice.toLowerCase() === 's') {
          console.log('Skipping this file.');
        } else {
          console.log('Invalid choice. Please enter f, r, p, or s.');
        }
      } while (choice.toLowerCase() === 'p');

      if (choice.toLowerCase() === 's') continue;

      if (content) {
        if (index > 0) {
          outputWithColors += `${colors.yellow}${separatorLine} Filepath: ${file} ${separatorLine}${colors.reset}\n`;
          outputWithoutColors += `${separatorLine} Filepath: ${file} ${separatorLine}\n`;
        } else {
          outputWithColors += `${colors.yellow}Filepath: ${file}${colors.reset}\n`;
          outputWithoutColors += `Filepath: ${file}\n`;
        }
        outputWithColors += `${colors.cyan}Content:${colors.reset}\n\`\`\`\n${content}\n\`\`\`\n\n`;
        outputWithoutColors += `Content:\n\`\`\`\n${content}\n\`\`\`\n\n`;
      }
    }

    console.log(outputWithColors);
    return outputWithoutColors;
  }

  return {
    name: 'file.selection',
    description: 'Select and process files using Bun’s native APIs',
    execute,
  };
}
