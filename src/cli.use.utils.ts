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
  gray: '\x1b[90m', // Added gray for non-selected modes
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
  const bottom = `└${horizontal}┘`;
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
    let errorMessage = ''; // To display error in the input box
    const selectionTypes = [
      'single',
      'allHighlighted',
      'range',
      'selectAll',
      'unselectAll',
    ] as const;
    type SelectionType = (typeof selectionTypes)[number];
    let currentSelectionTypeIndex = 0; // Start with 'single'

    function render() {
      const rows = process.stdout.rows || 24;
      const cols = process.stdout.columns || 80;
      const historyLines = Math.min(5, history.length);
      const paddingTop = 1; // Padding from the top
      const paddingLeft = 1; // Padding from the left
      const indent = 2; // Indentation for commands and options (align with option numbers)
      const instructionsStart = paddingTop; // Start with padding from the top
      const commandsStart = instructionsStart + historyLines; // After history
      const spaceSelectLine = commandsStart + 1; // Line for [space: select]
      const enterConfirmLine = spaceSelectLine + 1; // Line for [enter: confirm] and modes
      const optionsStart = enterConfirmLine + 1; // After commands
      const optionsDisplayStart = optionsStart + 1; // After the line underneath

      // Clear screen, reset scroll region, and move cursor to top-left
      stdout.write('\x1b[2J\x1b[?1049h\x1b[H\x1b[0;0r');

      // Display history with padding
      for (let i = 0; i < historyLines; i++) {
        const line = history[history.length - historyLines + i] || '';
        stdout.write(
          `\x1b[${instructionsStart + i};${paddingLeft}H\x1b[K${line.slice(0, cols - paddingLeft - 1)}`,
        );
      }

      // Commands section
      stdout.write(
        `\x1b[${commandsStart};${paddingLeft}H\x1b[K${colors.cyan}${colors.bold}Commands:${colors.reset}`,
      );
      stdout.write(
        `\x1b[${spaceSelectLine};${indent}H\x1b[K${colors.yellow}[space: select]${colors.reset}`,
      );
      let enterConfirmText = `${colors.yellow}[enter: confirm]${colors.reset} `;
      selectionTypes.forEach((type, index) => {
        const displayText =
          type === 'single'
            ? 'select first match'
            : type === 'allHighlighted'
              ? 'select all matches'
              : type === 'range'
                ? 'select range'
                : type === 'selectAll'
                  ? 'select all'
                  : 'unselect all';
        const color =
          index === currentSelectionTypeIndex ? colors.green : colors.gray;
        const bold = index === currentSelectionTypeIndex ? colors.bold : '';
        enterConfirmText += `${color}${bold}${displayText}${colors.reset}${index < selectionTypes.length - 1 ? ' | ' : ''}`;
      });
      stdout.write(
        `\x1b[${enterConfirmLine};${indent}H\x1b[K${enterConfirmText}`,
      );

      // Available Options header
      drawLine(paddingLeft, optionsStart, [
        {
          text: `Available Options (${selectedOptions.length}/${options.length})`,
          color: 'cyan',
          bold: true,
        },
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

      // Determine which options to highlight based on the current selection type
      let highlightedOptions: Set<T> = new Set();
      let highlightColor: keyof Colors = 'cyan'; // Default highlight color
      const currentType = selectionTypes[currentSelectionTypeIndex];
      if (currentType === 'single' && currentInput) {
        const firstMatch = availableOptions.find((opt, idx) => {
          const optionNumber = (idx + 1).toString();
          const name = getName(opt).toLowerCase();
          const searchText = `${optionNumber} ${name}`;
          return searchText.includes(lowerInput);
        });
        if (firstMatch) highlightedOptions.add(firstMatch);
      } else if (currentType === 'allHighlighted' && currentInput) {
        availableOptions.forEach((opt, idx) => {
          const optionNumber = (idx + 1).toString();
          const name = getName(opt).toLowerCase();
          const searchText = `${optionNumber} ${name}`;
          if (searchText.includes(lowerInput)) {
            highlightedOptions.add(opt);
          }
        });
      } else if (currentType === 'range' && currentInput) {
        const rangeMatch = currentInput.match(/^(\d+)-(\d+)$/);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1], 10);
          const end = parseInt(rangeMatch[2], 10);
          if (start <= end && start >= 1 && end <= availableOptions.length) {
            for (let i = start - 1; i < end; i++) {
              highlightedOptions.add(availableOptions[i]);
            }
          }
        }
      } else if (currentType === 'selectAll') {
        availableOptions.forEach((opt) => highlightedOptions.add(opt));
      } else if (currentType === 'unselectAll') {
        selectedOptions.forEach((opt) => highlightedOptions.add(opt));
        highlightColor = 'red'; // Use red for unselect all
      }

      // Display options with numbering and padding
      displayOptions.forEach((opt, index) => {
        const optionNumber = (availableOptions.indexOf(opt) + 1).toString();
        const displayText = display(opt, currentInput);
        const numberedText = `${optionNumber.padStart(2, ' ')}. ${displayText}`;
        const searchText = `${optionNumber} ${displayText.toLowerCase()}`; // Include number in search
        // Highlight if selected
        let finalText = selectedOptions.includes(opt)
          ? `${colors.green}${numberedText}${colors.reset}`
          : numberedText;
        // Apply highlighting based on the current selection type
        if (highlightedOptions.has(opt)) {
          finalText = `${colors[highlightColor]}${finalText}${colors.reset}`;
        }
        stdout.write(
          `\x1b[${optionsDisplayStart + index};${paddingLeft}H\x1b[K${finalText.slice(0, cols - paddingLeft - 1)}`,
        );
      });

      // Input box at the very bottom with padding
      const inputBoxWidth = cols - 2 * paddingLeft;
      const inputBoxHeight = 5; // Increased height to 5 lines
      const inputBoxY = rows - inputBoxHeight; // Ensure it's at the very bottom
      drawBox(paddingLeft, inputBoxY, inputBoxWidth, inputBoxHeight);
      // Draw the input prompt and current input, or error message if present
      const inputPrompt = errorMessage
        ? `${colors.red}Error: ${errorMessage} (type to clear)${colors.reset}`
        : `${colors.green}> ${currentInput}${colors.reset}`;
      const inputPromptY = inputBoxY + Math.floor(inputBoxHeight / 2); // Center vertically
      stdout.write(`\x1b[${inputPromptY};${paddingLeft + 1}H${inputPrompt}`);
      // Move the cursor to the end of the current input and show it (only if no error)
      if (!errorMessage) {
        const cursorX = paddingLeft + 1 + 2 + currentInput.length; // paddingLeft + 1 for box border, 2 for "> ", then input length
        stdout.write(`\x1b[${inputPromptY};${cursorX}H\x1b[?25h`);
      } else {
        // Hide cursor when error message is displayed
        stdout.write(`\x1b[?25l`);
      }
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
      } else if (char === '\t') {
        // Tab: cycle through selection types and clear input
        currentSelectionTypeIndex =
          (currentSelectionTypeIndex + 1) % selectionTypes.length;
        currentInput = ''; // Clear input on tab
        errorMessage = ''; // Clear error message
        render();
      } else if (char === '\r') {
        // Enter: execute based on current selection type
        const currentType = selectionTypes[currentSelectionTypeIndex];
        if (currentType === 'single') {
          // Single select: select the first match and confirm
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
            } else {
              errorMessage = 'No options match your search.';
              render();
              return;
            }
          }
          // Check if at least one option is selected
          if (selectedOptions.length === 0) {
            errorMessage = 'You must select at least one option.';
            render();
          } else {
            cleanupAndExit(selectedOptions);
          }
        } else if (currentType === 'allHighlighted') {
          // Select all highlighted options
          if (currentInput) {
            const matches = availableOptions.filter((opt, idx) => {
              const optionNumber = (idx + 1).toString();
              const name = getName(opt).toLowerCase();
              const searchText = `${optionNumber} ${name}`;
              return searchText.includes(currentInput.toLowerCase());
            });
            if (matches.length > 0) {
              matches.forEach((opt) => {
                if (
                  !selectedOptions.includes(opt) &&
                  (maxSelections === undefined ||
                    selectedOptions.length < maxSelections)
                ) {
                  selectedOptions.push(opt);
                } else if (selectedOptions.includes(opt)) {
                  selectedOptions = selectedOptions.filter((o) => o !== opt);
                }
              });
              currentInput = '';
              errorMessage = ''; // Clear error message
              render();
            } else {
              errorMessage = 'No options match your search.';
              render();
            }
          } else {
            errorMessage = 'Enter a search term to highlight options.';
            render();
          }
        } else if (currentType === 'range') {
          // Select range
          const rangeInput = currentInput.trim();
          const rangeMatch = rangeInput.match(/^(\d+)-(\d+)$/);
          if (rangeMatch) {
            const start = parseInt(rangeMatch[1], 10);
            const end = parseInt(rangeMatch[2], 10);
            if (start <= end && start >= 1 && end <= availableOptions.length) {
              for (let i = start - 1; i < end; i++) {
                const opt = availableOptions[i];
                if (
                  !selectedOptions.includes(opt) &&
                  (maxSelections === undefined ||
                    selectedOptions.length < maxSelections)
                ) {
                  selectedOptions.push(opt);
                } else if (selectedOptions.includes(opt)) {
                  selectedOptions = selectedOptions.filter((o) => o !== opt);
                }
              }
              currentInput = '';
              errorMessage = ''; // Clear error message
              render();
            } else {
              errorMessage = `Invalid range: must be between 1 and ${availableOptions.length}`;
              render();
            }
          } else {
            errorMessage = 'Enter range (e.g., 3-5)';
            render();
          }
        } else if (currentType === 'selectAll') {
          // Select all options
          availableOptions.forEach((opt) => {
            if (
              !selectedOptions.includes(opt) &&
              (maxSelections === undefined ||
                selectedOptions.length < maxSelections)
            ) {
              selectedOptions.push(opt);
            }
          });
          currentInput = '';
          errorMessage = '';
          render();
        } else if (currentType === 'unselectAll') {
          // Unselect all options
          selectedOptions = [];
          currentInput = '';
          errorMessage = '';
          render();
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
