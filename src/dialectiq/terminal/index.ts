// terminal/index.ts

import { stdin, stdout } from 'process';
import type { SelectionContext, TerminalDimensions } from '../types';

import {
  switchSelectionType,
  appendInput,
  backspaceInput,
  toggleTransformation,
} from '../core/context';
import { handleSelectionByType } from '../core/selection';

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
  stdout.write('\x1b[?1049l'); // Return to main screen buffer
  stdout.write('\x1b[?25h'); // Show cursor
  stdin.setRawMode(false);
  stdin.removeAllListeners('data');
  stdout.write('\n');

  // Apply transformations and await their results
  const transformationResults: Record<string, any> = {};

  for (const transformName of context.activeTransformations) {
    const transformation = context.availableTransformations.find(
      (t) => t.name === transformName,
    );
    if (transformation) {
      const result = transformation.apply(context.selectedOptions, getName);
      transformationResults[transformName] = await result; // Await the promise if it exists
    }
  }

  // Include resolved transformation results in state
  state.transformations = transformationResults;

  resolve(state);
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
  const char = data.toString();

  if (char === '\x03') {
    // Ctrl+C
    cleanup();
  } else if (char === '\t') {
    // Tab
    switchSelectionType({ context, render });
  } else if (char === '\r') {
    // Enter
    const type = context.selectionTypes[context.currentSelectionTypeIndex];
    handleSelectionByType({
      context,
      type,
      getName,
      maxSelections,
      updateState,
      render,
      cleanup,
    });
  } else if (char === '\x7f') {
    // Backspace
    backspaceInput({ context, render });
  } else if (char >= '1' && char <= '9') {
    // Check if it's a transformation command (prefixed with t)
    if (context.currentInput === 't') {
      const idx = parseInt(char, 10) - 1;
      if (idx >= 0 && idx < context.availableTransformations.length) {
        toggleTransformation({ context, transformationIndex: idx, render });
        context.currentInput = '';
      } else {
        appendInput({ context, char, render });
      }
    } else {
      appendInput({ context, char, render });
    }
  } else if (char === 't' && context.currentInput === '') {
    // Start transformation selection mode
    appendInput({ context, char, render });
  } else if (char >= ' ' && char <= '~') {
    // Printable characters
    appendInput({ context, char, render });
  }

  // Check selection limit
  if (
    maxSelections !== null &&
    context.selectedOptions.length >= maxSelections
  ) {
    cleanup();
  }
}
