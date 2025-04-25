import Bun from 'bun';
import fs from 'fs';
import path from 'path';
import {
  colors,
  displayPaginated,
  listDirectories,
  promptForNumber,
  promptUser,
  selectOption,
} from '../utils';
import type { Flow } from '../types';
import os from 'os';

export function createFileSelectionFlow(): Flow {
  // Helper to list directories up to a max depth
  // Helper to collect files from directories
  async function collectFilesFromDirs(
    dirs: string[],
    maxDepth: number = 3,
  ): Promise<string[]> {
    const files: string[] = [];
    const walkDir = async (currentDir: string, depth: number) => {
      if (depth > maxDepth) return;
      try {
        const entries = await fs.promises.readdir(currentDir, {
          withFileTypes: true,
        });
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          if (entry.isDirectory()) {
            if (
              !['.git', 'node_modules', 'dist', 'build'].includes(entry.name)
            ) {
              await walkDir(fullPath, depth + 1);
            }
          } else if (entry.isFile()) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        console.log(
          `${colors.red}Error accessing directory ${currentDir}: ${error}${colors.reset}`,
        );
      }
    };
    for (const dir of dirs) {
      await walkDir(dir, 0);
    }
    return files;
  }

  // Helper to select directories interactively
  async function selectDirectories(directories: string[]): Promise<string[]> {
    if (directories.length === 0) {
      console.log('No directories found.');
      process.exit(0);
    }

    const selectedDirs = await selectOption(
      directories,
      (dir) => dir, // Use full path
      (dir, input) => {
        const name = dir; // Use full path
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
      [], // No history for directory selection
      50,
    );

    if (selectedDirs.length === 0) {
      console.log('No directories selected.');
      process.exit(0);
    }

    return selectedDirs;
  }

  // Helper to select files interactively
  async function selectFiles(files: string[]): Promise<string[]> {
    if (files.length === 0) {
      console.log('No files found.');
      process.exit(0);
    }

    const selectedFiles = await selectOption(
      files,
      (file) => file, // Use full path
      (file, input) => {
        const name = file; // Use full path
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

  // Helper to get default directories and check their existence
  async function getDefaultDirectories(): Promise<
    { name: string; path: string }[]
  > {
    const homeDir = os.homedir();
    const defaultDirs = [
      { name: 'Downloads', path: path.join(homeDir, 'Downloads') },
      { name: 'Projects', path: path.join(homeDir, 'Projects') },
      { name: 'arcane-archives', path: path.join(homeDir, 'arcane-archives') },
      { name: 'Current Working Directory', path: process.cwd() },
    ];

    const existingDirs: { name: string; path: string }[] = [];
    for (const dir of defaultDirs) {
      try {
        const stats = await fs.promises.stat(dir.path);
        if (stats.isDirectory()) {
          existingDirs.push(dir);
        }
      } catch (error) {
        // Directory doesn't exist, skip it
      }
    }

    return existingDirs.length > 0
      ? existingDirs
      : [{ name: 'Current Working Directory', path: process.cwd() }];
  }

  // Helper to select root directory
  async function selectRootDirectory(): Promise<string> {
    const dirOptions = await getDefaultDirectories();

    // If only one directory exists (likely cwd), use it directly
    if (dirOptions.length === 1) {
      console.log(`Using default directory: ${dirOptions[0].path}`);
      return dirOptions[0].path;
    }

    const selectedDir = await selectOption(
      dirOptions,
      (option) => `${option.name} (${option.path})`,
      (option, input) => {
        const name = `${option.name} (${option.path})`;
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
      [],
      20,
      1, // Allow only one selection
    );

    if (selectedDir.length === 0) {
      console.log('No directory selected. Exiting.');
      process.exit(0);
    }

    const chosenOption = selectedDir[0];
    if (chosenOption.name === 'Custom Directory') {
      let customPath = '';
      while (!customPath) {
        customPath = await promptUser('Enter the directory path: ');
        customPath = customPath.trim();
        try {
          const stats = await fs.promises.stat(customPath);
          if (!stats.isDirectory()) {
            console.log(
              `${colors.red}Error: ${customPath} is not a directory.${colors.reset}`,
            );
            customPath = '';
          }
        } catch (error) {
          console.log(
            `${colors.red}Error: Invalid directory path ${customPath}.${colors.reset}`,
          );
          customPath = '';
        }
      }
      return path.resolve(customPath);
    }

    return chosenOption.path;
  }

  // Main execution logic
  async function execute(input?: any): Promise<any> {
    console.log('Select a root directory to scan for subdirectories...');
    const projectRoot = await selectRootDirectory();

    console.log(`Listing directories in ${projectRoot}...`);
    const directories = await listDirectories(projectRoot);
    const selectedDirs = await selectDirectories(directories);

    console.log('Selected directories:');
    selectedDirs.forEach((dir) => console.log(`- ${dir}`));

    const processChoice = await promptUser(
      'Process directories? (f: select individual files, c: copy entire directories)\n' +
        ' - f: Select specific files from the chosen directories.\n' +
        ' - c: Include all files from the chosen directories.\n' +
        'Enter your choice: ',
    );

    let files: string[] = [];
    if (processChoice.toLowerCase() === 'f') {
      console.log(`Collecting files from selected directories...`);
      files = await collectFilesFromDirs(selectedDirs);
      if (files.length === 0) {
        console.log('No files found in selected directories.');
        process.exit(0);
      }
      console.log(`Select files to process...`);
      files = await selectFiles(files);
    } else if (processChoice.toLowerCase() === 'c') {
      console.log(`Collecting all files from selected directories...`);
      files = await collectFilesFromDirs(selectedDirs);
      if (files.length === 0) {
        console.log('No files found in selected directories.');
        process.exit(0);
      }
    } else {
      console.log('Invalid choice. Please enter f or c.');
      process.exit(1);
    }

    let outputWithColors = '\n**Results:**\n';
    let outputWithoutColors = '\n**Results:**\n';
    const separatorLine = '─'.repeat(50);

    for (const [index, file] of files.entries()) {
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
    description: 'Select directories and process files using Bun’s native APIs',
    execute,
  };
}
