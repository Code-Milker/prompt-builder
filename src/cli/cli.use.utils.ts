// utils.ts - Shared utility functions for CLI flows
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { createInterface } from 'node:readline';
import Bun from 'bun';
import { stdin, stdout } from 'node:process';
import type { Colors } from './cli.use.types';

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

// Enhanced function to select an option interactively with history
export async function selectOption<T>(
  options: T[],
  getName: (option: T) => string,
  display: (option: T, input: string) => string,
  history: string[],
  promptMessage: string = 'Select an option:',
): Promise<T | null> {
  return new Promise((resolve) => {
    let currentInput = '';
    const filteredOptions = () =>
      options.filter((opt) =>
        getName(opt).toLowerCase().startsWith(currentInput.toLowerCase()),
      );

    function render() {
      const rows = process.stdout.rows || 24; // Default to 24 if not available
      const historyLines = Math.min(5, history.length);
      const optionsStart = historyLines + 1;
      const optionsLines = 5;
      const inputLine = rows;

      // Clear screen
      stdout.write('\x1b[2J\x1b[1;1H');

      // Display history
      for (let i = 0; i < historyLines; i++) {
        const line = history[history.length - historyLines + i];
        stdout.write(`\x1b[${i + 1};1H\x1b[K${line}`);
      }

      // Display options
      const visibleOptions = filteredOptions().slice(0, optionsLines);
      visibleOptions.forEach((opt, index) => {
        const displayText = display(opt, currentInput);
        stdout.write(`\x1b[${optionsStart + index};1H\x1b[K${displayText}`);
      });

      // Clear remaining option lines
      for (let i = visibleOptions.length; i < optionsLines; i++) {
        stdout.write(`\x1b[${optionsStart + i};1H\x1b[K`);
      }

      // Display input
      stdout.write(
        `\x1b[${inputLine};1H\x1b[K${colors.bold}${colors.yellow}${promptMessage}${colors.reset} ${colors.green}${currentInput}${colors.reset}`,
      );
    }

    // Initial render
    render();

    // Enable raw mode
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const onData = (data: string) => {
      const char = data.toString();

      if (char === '\x03' || char === '\x1b') {
        // Ctrl+C or Escape
        cleanupAndExit(null);
      } else if (char === '\r') {
        // Enter
        const matches = filteredOptions();
        if (matches.length === 1) {
          cleanupAndExit(matches[0]);
        } else if (matches.length > 1) {
          history.push('Multiple matches, keep typing...');
          render();
        } else {
          history.push('No matches found');
          render();
        }
      } else if (char === '\x7f') {
        // Backspace
        if (currentInput.length > 0) {
          currentInput = currentInput.slice(0, -1);
          render();
        }
      } else if (char >= ' ' && char <= '~') {
        // Printable characters
        currentInput += char;
        render();
      }
    };

    function cleanupAndExit(result: T | null) {
      stdin.setRawMode(false);
      stdin.removeListener('data', onData);
      stdout.write('\n');
      resolve(result);
    }

    stdin.on('data', onData);
  });
}
