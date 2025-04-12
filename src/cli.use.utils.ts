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

  // process.stdout.write(`\x1b[${y};${x}H${top}`);
  // for (let i = 1; i < height - 1; i++) {
  //   process.stdout.write(`\x1b[${y + i};${x}H${middle}`);
  // }
  // process.stdout.write(`\x1b[${y + height - 1};${x}H${bottom}`);
}

// Function to draw text with a full-width line underneath, with styled segments
export function drawLine(
  x: number,
  y: number,
  segments: { text: string; color?: keyof Colors; bold?: boolean }[],
) {
  const cols = process.stdout.columns || 80;
  const line = '─'.repeat(cols - 1); // Full-width line

  // Build the styled text by concatenating segments
  let styledText = '';
  for (const segment of segments) {
    let segmentText = segment.text;
    // Apply bold if specified
    if (segment.bold) {
      segmentText = `${colors.bold}${segmentText}`;
    }
    // Apply color if specified
    if (segment.color) {
      segmentText = `${colors[segment.color]}${segmentText}${colors.reset}`;
    }
    // Reset bold if it was applied
    if (segment.bold) {
      segmentText = `${segmentText}${colors.reset}`;
    }
    styledText += segmentText;
  }

  // Draw the styled text
  process.stdout.write(`\x1b[${y};${x}H${styledText}`);
  // Draw the full-width line underneath
  process.stdout.write(`\x1b[${y + 1};${x}H${line}`);
}

export async function selectOption<T>(
  options: T[],
  getName: (option: T) => string,
  display: (option: T, input: string) => string,
  history: string[],
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
      const paddingTop = 2; // Padding from the top
      const paddingLeft = 2; // Padding from the left
      const instructionsStart = paddingTop; // Start with padding from the top
      const optionsStart =
        instructionsStart + historyLines + (errorMessage ? 2 : 0); // Adjust for history and error
      const optionsDisplayStart = optionsStart + 2; // After header

      // Clear screen, reset scroll region, and move cursor to top-left
      stdout.write('\x1b[2J\x1b[?1049h\x1b[H\x1b[0;0r');

      // Display history with padding
      for (let i = 0; i < historyLines; i++) {
        const line = history[history.length - historyLines + i] || '';
        stdout.write(
          `\x1b[${instructionsStart + i};${paddingLeft}H\x1b[K${line.slice(0, cols - paddingLeft - 1)}`,
        );
      }

      // Error message (if any) with padding
      if (errorMessage) {
        drawLine(paddingLeft, instructionsStart + historyLines, [
          { text: errorMessage, color: 'red' },
        ]);
      }

      // Header for options with shortcuts, with padding
      drawLine(paddingLeft, optionsStart, [
        {
          text: `Available Options (${selectedOptions.length}/${options.length})`,
          bold: true,
        },
        { text: '  ' }, // Spacer
        { text: '[space: select]', color: 'yellow', bold: true },
        { text: '  ' }, // Spacer
        { text: '[enter: confirm]', color: 'yellow', bold: true },
      ]);

      // Sort selected options alphabetically
      const sortedSelected = [...selectedOptions].sort((a, b) => {
        const aName = getName(a).toLowerCase();
        const bName = getName(b).toLowerCase();
        return aName < bName ? -1 : aName > bName ? 1 : 0;
      });

      // Filter and sort unselected options, including numbers in search
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

      // Display options with numbering and padding
      displayOptions.forEach((opt, index) => {
        const optionNumber = (availableOptions.indexOf(opt) + 1).toString();
        const displayText = display(opt, currentInput);
        const numberedText = `${optionNumber.padStart(2, ' ')}. ${displayText}`;
        const searchText = `${optionNumber} ${displayText.toLowerCase()}`; // Include number in search
        // Highlight if selected
        const finalText = selectedOptions.includes(opt)
          ? `${colors.green}${numberedText}${colors.reset}`
          : numberedText;
        // Apply highlighting for search matches (if needed)
        const isMatch = searchText.includes(lowerInput);
        const outputText =
          isMatch && lowerInput
            ? `${colors.cyan}${finalText}${colors.reset}`
            : finalText;
        stdout.write(
          `\x1b[${optionsDisplayStart + index};${paddingLeft}H\x1b[K${outputText.slice(0, cols - paddingLeft - 1)}`,
        );
      });

      // Input box at the very bottom with padding
      const inputBoxWidth = cols - 2 * paddingLeft;
      const inputBoxHeight = 3; // Increased height to 5 lines
      const inputBoxY = rows - 2; // Ensure it's at the very bottom
      drawBox(paddingLeft, inputBoxY, inputBoxWidth, inputBoxHeight);
      // Draw the input prompt and current input, centered vertically in the taller box
      const inputPrompt = `${colors.green}> ${currentInput}${colors.reset}`;
      const inputPromptY = inputBoxY + Math.floor(inputBoxHeight / 2); // Center vertically
      stdout.write(`\x1b[${inputPromptY};${paddingLeft + 1}H${inputPrompt}`);
      // Move the cursor to the end of the current input and show it
      const cursorX = paddingLeft + 1 + 2 + currentInput.length; // paddingLeft + 1 for box border, 2 for "> ", then input length
      stdout.write(`\x1b[${inputPromptY};${cursorX}H\x1b[?25h`);
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
        const matches = availableOptions.filter((opt, idx) => {
          const optionNumber = (idx + 1).toString();
          const name = getName(opt).toLowerCase();
          const searchText = `${optionNumber} ${name}`;
          return searchText.includes(currentInput.toLowerCase());
        });
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
          const matches = availableOptions.filter((opt, idx) => {
            const optionNumber = (idx + 1).toString();
            const name = getName(opt).toLowerCase();
            const searchText = `${optionNumber} ${name}`;
            return searchText.includes(currentInput.toLowerCase());
          });
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
      // Reset terminal state before exiting
      stdout.write('\x1b[?1049l\x1b[?25h');
      stdin.setRawMode(false);
      stdin.removeListener('data', onData);
      stdout.write('\n');
      resolve(result);
    }

    stdin.on('data', onData);
  });
}
