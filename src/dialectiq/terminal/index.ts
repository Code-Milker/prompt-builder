// terminal/index.ts
import { stdin, stdout } from 'process';
import type { SelectionContext, TerminalDimensions } from '../types/index';
import {
  switchInputMode,
  appendInput,
  backspaceInput,
  toggleTransformation,
  executeCommand,
} from '../core/context';
import { handleSelection } from '../core/context';

export function setupTerminal(): void {
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  stdout.write('\x1b[?1049h'); // Switch to alternate screen buffer
  stdout.write('\x1b[?25l'); // Hide cursor initially
}

export async function cleanupTerminal<T>({
  resolve,
  state,
  context,
  getName,
}: {
  resolve: (value: Record<string, any>) => void;
  state: Record<string, any>;
  context: SelectionContext<T>;
  getName: (option: T) => string;
}): Promise<void> {
  // Reset terminal state
  stdout.write('\x1b[?1049l'); // Return to main screen buffer
  stdout.write('\x1b[0m'); // Reset all attributes (colors, bold, etc.)
  stdout.write('\x1b[H'); // Move cursor to home (top-left)
  stdout.write('\x1b[J'); // Clear screen from cursor down
  stdout.write('\x1b[?25h'); // Show cursor

  // Disable raw mode and clean up stdin
  stdin.setRawMode(false);
  stdin.removeAllListeners('data');
  stdin.destroy(); // Fully close stdin to release terminal

  // Process transformations
  const transformationResults: Record<string, any> = {};
  for (const transformName of context.activeTransformations) {
    const transformation = context.availableTransformations.find(
      (t) => t.name === transformName,
    );
    if (transformation) {
      const result = transformation.apply(context.selectedOptions, getName);
      transformationResults[transformName] = await result;
    }
  }
  state.transformations = transformationResults;

  // Resolve the promise and flush stdout
  resolve(state);
  stdout.write('\n');
  process.stdout.end(); // Ensure all output is flushed and stdout closes
}

export function getTerminalDimensions(): TerminalDimensions {
  return {
    rows: process.stdout.rows || 24,
    cols: process.stdout.columns || 80,
    paddingTop: 1,
    paddingLeft: 1,
    indent: 2,
  };
}

export function clearScreen(): void {
  stdout.write('\x1b[2J\x1b[H\x1b[0;0r');
}

export function handleInput<T>({
  data,
  context,
  getName,
  maxSelections,
  updateState,
  render,
  cleanup,
}: {
  data: string;
  context: SelectionContext<T>;
  getName: (option: T) => string;
  maxSelections: number | null;
  updateState: () => void;
  render: () => void;
  cleanup: () => void;
}): void {
  // Process input as a Buffer to handle raw mode correctly
  const inputBuffer = Buffer.from(data, 'utf8');
  for (let i = 0; i < inputBuffer.length; i++) {
    const char = String.fromCharCode(inputBuffer[i]);

    if (char === '\x03') {
      // Ctrl+C: Exit without saving
      cleanup();
    } else if (char === '\x04') {
      // Ctrl+D: Trigger "done" command
      const doneIndex = context.selectionTypes.indexOf('done');
      if (doneIndex !== -1) {
        context.currentSelectionTypeIndex = doneIndex;
        context.currentInput = '';
        executeCommand({
          context,
          getName,
          maxSelections,
          updateState,
          render,
          cleanup,
        });
      } else {
        context.errorMessage = 'Done command not available';
        render();
      }
    } else if (char === '\t') {
      // Tab: Switch mode
      switchInputMode({ context, render });
    } else if (char === '\r') {
      // Enter: Execute current command
      executeCommand({
        context,
        getName,
        maxSelections,
        updateState,
        render,
        cleanup,
      });
    } else if (char === '\x7f') {
      // Backspace
      backspaceInput({ context, render });
    } else if (inputBuffer.slice(i, i + 3).toString() === '\x1b[D') {
      // Left Arrow: Previous selection type
      context.currentSelectionTypeIndex = Math.max(
        0,
        context.currentSelectionTypeIndex - 1,
      );
      render();
      i += 2; // Skip the escape sequence
    } else if (inputBuffer.slice(i, i + 3).toString() === '\x1b[C') {
      // Right Arrow: Next selection type
      context.currentSelectionTypeIndex = Math.min(
        context.selectionTypes.length - 1,
        context.currentSelectionTypeIndex + 1,
      );
      render();
      i += 2; // Skip the escape sequence
    } else if (char >= ' ' && char <= '~') {
      // Printable characters
      appendInput({ context, char, render });
    }
  }

  if (
    maxSelections !== null &&
    context.selectedOptions.length >= maxSelections
  ) {
    cleanup();
  }
}
