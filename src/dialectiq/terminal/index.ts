// terminal/index.ts
import { stdin, stdout } from 'process';
import type { SelectionContext, TerminalDimensions } from '../types';

export function setupTerminal(): void {
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  stdout.write('\x1b[?1049h'); // Switch to alternate screen buffer
  stdout.write('\x1b[?25l'); // Hide cursor initially
}

export function cleanupTerminal<T>({
  resolve,
  state,
}: {
  resolve: (value: Record<string, any>) => void;
  state: Record<string, any>;
}): void {
  stdout.write('\x1b[?1049l'); // Return to main screen buffer
  stdout.write('\x1b[?25h'); // Show cursor
  stdin.setRawMode(false);
  stdin.removeAllListeners('data');
  stdout.write('\n');
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

import {
  switchSelectionType,
  appendInput,
  backspaceInput,
} from '../core/context';
import { handleSelectionByType } from '../core/selection';

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
