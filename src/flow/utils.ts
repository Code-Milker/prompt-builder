// utils.ts - Shared utility functions for CLI flows

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { createInterface } from 'node:readline';
import Bun from 'bun';
import type { Colors } from './types';

// Promisify exec for async/await
export const execPromise = promisify(exec);

// Colors for output
export const colors: Colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  bold: '\x1b[1m',
};

// Function to prompt user for input
export async function promptUser(message: string): Promise<string> {
  return new Promise((resolve) => {
    const readline = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    readline.question(message, (answer) => {
      readline.close();
      resolve(answer.trim());
    });
  });
}

// Function to prompt for a number within a range
export async function promptForNumber(
  message: string,
  min: number,
  max: number,
): Promise<number> {
  while (true) {
    const input = await promptUser(message);
    const num = parseInt(input, 10);
    if (!isNaN(num) && num >= min && num <= max) {
      return num;
    }
    console.log(`Please enter a number between ${min} and ${max}.`);
  }
}

// Function to print with colors
export function printColored(text: string, color: keyof Colors): void {
  console.log(`${colors[color]}${text}${colors.reset}`);
}

// Copy text to clipboard using platform-specific tools
export async function copyToSystemClipboard(text: string): Promise<void> {
  let command;
  if (process.platform === 'darwin') {
    command = ['pbcopy'];
  } else if (process.platform === 'linux') {
    command = ['xclip', '-selection', 'clipboard'];
  } else if (process.platform === 'win32') {
    command = ['clip'];
  } else {
    console.error('Unsupported platform for clipboard copying');
    return;
  }
  const proc = Bun.spawn(command, { stdin: 'pipe' });
  await proc.stdin.write(text);
  await proc.stdin.end();
  await proc.exited;
}

// Function to display paginated content
export async function displayPaginated(
  lines: string[],
  totalLines: number,
): Promise<void> {
  const pageSize = 50;
  let currentLine = 0;
  let page = 1;

  while (currentLine < totalLines) {
    const endLine = Math.min(currentLine + pageSize, totalLines);
    console.log(
      `\n--- Page ${page}: lines ${currentLine + 1} to ${endLine} ---`,
    );

    for (let i = currentLine; i < endLine; i++) {
      console.log(`${(i + 1).toString().padStart(4)} ${lines[i]}`);
    }

    currentLine = endLine;
    page++;

    if (currentLine < totalLines) {
      const continueChoice = await promptUser(
        'Press Enter to continue or "q" to stop viewing: ',
      );
      if (continueChoice.toLowerCase() === 'q') {
        break;
      }
    }
  }
}
