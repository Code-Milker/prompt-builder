// utils.ts - Shared utility functions for CLI flows
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { createInterface } from 'node:readline';
import Bun from 'bun';
import { stdin, stdout } from 'node:process';
import type { Colors } from './cli.use.types';

// Promisify exec for async/await
export const executivePromise = promisify(exec);

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

// Function to draw a box
export function drawBox(
  x: number,
  y: number,
  width: number,
  height: number,
  title: string = '',
) {
  const horizontal = '─'.repeat(width - 2);
  const top = `┌${horizontal}┐`;
  const bottom = `└${horizontal}┘`;
  const middle = `│${' '.repeat(width - 2)}│`;

  process.stdout.write(`\x1b[${y};${x}H${top}`);
  for (let i = 1; i < height - 1; i++) {
    process.stdout.write(`\x1b[${y + i};${x}H${middle}`);
  }
  process.stdout.write(`\x1b[${y + height - 1};${x}H${bottom}`);

  if (title) {
    const titleX = x + Math.floor((width - title.length) / 2);
    process.stdout.write(`\x1b[${y};${titleX}H${title}`);
  }
}

export async function selectOption<T>(
  options: T[],
  getName: (option: T) => string,
  display: (option: T, input: string) => string,
  history: string[],
  promptMessage: string = 'Select an option:',
  maxDisplay: number = 10,
  maxSelections?: number, // Optional limit on number of selections
): Promise<T[]> {
  return new Promise((resolve) => {
    let currentInput = '';
    let selectedOptions: T[] = [];
    let availableOptions = [...options];
    let errorMessage = ''; // To display error when trying to confirm without selections

    function render() {
      const rows = process.stdout.rows || 24;
      const cols = process.stdout.columns || 80;
      const historyLines = Math.min(5, history.length);
      const optionsStart = historyLines + 3;

      // Clear screen
      stdout.write('\x1b[2J\x1b[1;1H');

      // Display history
      for (let i = 0; i < historyLines; i++) {
        const line = history[history.length - historyLines + i] || '';
        stdout.write(`\x1b[${i + 1};1H\x1b[K${line.slice(0, cols - 1)}`);
      }

      // Header
      stdout.write(
        `\x1b[${historyLines + 1};1H${colors.bold}Available Options (${selectedOptions.length}/${options.length})${colors.reset}`,
      );
      stdout.write(`\x1b[${historyLines + 2};1H${'─'.repeat(cols - 1)}`);

      // Sort selected options alphabetically
      const sortedSelected = [...selectedOptions].sort((a, b) => {
        const aName = getName(a).toLowerCase();
        const bName = getName(b).toLowerCase();
        return aName < bName ? -1 : aName > bName ? 1 : 0;
      });

      // Filter and sort unselected options
      const lowerInput = currentInput.toLowerCase();
      const sortedUnselected = availableOptions
        .filter((opt) => !selectedOptions.includes(opt))
        .sort((a, b) => {
          const aName = getName(a).toLowerCase();
          const bName = getName(b).toLowerCase();
          const aMatch = aName.includes(lowerInput);
          const bMatch = bName.includes(lowerInput);
          return aMatch && !bMatch ? -1 : !aMatch && bMatch ? 1 : 0;
        });

      // Combine selected and unselected options, with selected at the top
      const displayOptions = [...sortedSelected, ...sortedUnselected].slice(
        0,
        maxDisplay,
      );

      // Display options
      displayOptions.forEach((opt, index) => {
        let displayText = display(opt, currentInput);
        if (selectedOptions.includes(opt)) {
          displayText = `${colors.green}${displayText}${colors.reset}`;
        }
        stdout.write(
          `\x1b[${optionsStart + index};1H\x1b[K${displayText.slice(0, cols - 1)}`,
        );
      });

      // Instruction box
      const instructionWidth = cols - 4;
      const instructionHeight = 5;
      const instructionY = rows - 8;
      drawBox(
        2,
        instructionY,
        instructionWidth,
        instructionHeight,
        'Instructions',
      );
      const instructions = [
        promptMessage,
        'Type to filter, Space to select, Enter to confirm',
        errorMessage ? `${colors.red}${errorMessage}${colors.reset}` : '',
      ].filter(Boolean); // Remove empty error message
      instructions.forEach((line, index) => {
        const padding = Math.floor((instructionWidth - 2 - line.length) / 2);
        stdout.write(`\x1b[${instructionY + 1 + index};3H${line}`);
      });

      // Input box at bottom
      const inputBoxWidth = cols - 2;
      const inputBoxHeight = 3;
      const inputBoxY = rows - inputBoxHeight;
      drawBox(1, inputBoxY, inputBoxWidth, inputBoxHeight);
      stdout.write(
        `\x1b[${inputBoxY + 1};2H${colors.green}> ${currentInput}${colors.reset}`,
      );
    }

    render();

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const onData = (data: string) => {
      const char = data.toString();
      if (char === '\x03') {
        // Ctrl+C: cancel
        cleanupAndExit([]);
      } else if (char === ' ') {
        // Space: toggle selection of first match
        const matches = availableOptions.filter((opt) =>
          getName(opt).toLowerCase().includes(currentInput.toLowerCase()),
        );
        if (matches.length > 0) {
          const selected = matches[0];
          // Only allow selection if under maxSelections limit (if defined)
          if (
            !selectedOptions.includes(selected) &&
            (maxSelections === undefined ||
              selectedOptions.length < maxSelections)
          ) {
            selectedOptions.push(selected);
          } else if (selectedOptions.includes(selected)) {
            selectedOptions = selectedOptions.filter((opt) => opt !== selected);
          }
          currentInput = '';
          errorMessage = ''; // Clear error message on successful action
          render();
        }
      } else if (char === '\r') {
        // Enter: select partially typed option (if any) and confirm
        if (currentInput) {
          const matches = availableOptions.filter((opt) =>
            getName(opt).toLowerCase().includes(currentInput.toLowerCase()),
          );
          if (matches.length > 0) {
            const selected = matches[0];
            if (
              !selectedOptions.includes(selected) &&
              (maxSelections === undefined ||
                selectedOptions.length < maxSelections)
            ) {
              selectedOptions.push(selected);
            }
          }
        }
        // Check if at least one option is selected
        if (selectedOptions.length === 0) {
          errorMessage = 'You must select at least one option.';
          render();
        } else {
          cleanupAndExit(selectedOptions);
        }
      } else if (char === '\x7f') {
        // Backspace
        currentInput = currentInput.slice(0, -1);
        errorMessage = ''; // Clear error message on input change
        render();
      } else if (char >= ' ' && char <= '~') {
        // Printable characters: add to filter input
        currentInput += char;
        errorMessage = ''; // Clear error message on input change
        render();
      }
    };

    function cleanupAndExit(result: T[]) {
      stdin.setRawMode(false);
      stdin.removeListener('data', onData);
      stdout.write('\n');
      resolve(result);
    }

    stdin.on('data', onData);
  });
}
