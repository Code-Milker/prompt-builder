// fileSelectionFlow.ts - Native file selection using Bun’s process spawning

import Bun from 'bun';
import type { Flow } from './types';
import { colors, promptUser, promptForNumber, displayPaginated } from './utils';
import fs from 'fs';
import path from 'path';

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

    console.log('\nAvailable files:');
    files.forEach((file, index) => {
      console.log(`${index + 1}. ${path.relative(process.cwd(), file)}`);
    });

    const selection = await promptUser('Enter file numbers (space) or "all": ');
    if (selection.toLowerCase() === 'all') return files;

    const indices = selection.split(' ').map((s) => parseInt(s.trim(), 10) - 1);
    const selectedFiles = indices
      .filter((i) => i >= 0 && i < files.length)
      .map((i) => files[i]);

    if (selectedFiles.length === 0) {
      console.log('No valid files selected.');
      process.exit(0);
    }

    return selectedFiles;
  }

  // Main execution logic
  async function execute(input?: any): Promise<any> {
    const projectRoot = process.cwd();
    const dirPrompt = await promptUser(
      'Enter directory to search (Enter for current): ',
    );
    const searchDir =
      dirPrompt.trim() === ''
        ? projectRoot
        : path.resolve(projectRoot, dirPrompt);

    console.log('Listing files...');
    const files = await listFiles(searchDir);
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
          'Include full file (f), select range (r), read paginated (p), or skip (s)? ',
        );

        if (choice.toLowerCase() === 'f') {
          content = await Bun.file(file).text();
        } else if (choice.toLowerCase() === 'r') {
          const viewChoice = await promptUser(
            'View paginated (p) or all (a)? ',
          );
          const fileContent = await Bun.file(file).text();
          const lines = fileContent.split('\n');
          const totalLines = lines.length;
          console.log(`\nFile: ${file} (${totalLines} lines)`);

          if (viewChoice.toLowerCase() === 'p') {
            await displayPaginated(lines, totalLines);
          } else {
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
          console.log('Invalid choice. Enter f, r, p, or s.');
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
    name: 'FileSelection',
    description: 'Select and process files using Bun’s native APIs',
    execute,
  };
}
