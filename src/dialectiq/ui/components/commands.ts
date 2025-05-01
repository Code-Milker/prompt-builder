import { stdout } from 'process';
import { colors } from '../../ui/utils';
import type { TerminalDimensions } from '../../types';

export function renderCommands({
  selectionTypes,
  index,
  inputMode,
  currentInput,
  line,
  dimensions,
}: {
  selectionTypes: readonly string[];
  index: number;
  inputMode: 'input' | 'command' | 'transformation';
  currentInput: string;
  line: number;
  dimensions: TerminalDimensions;
}): void {
  const { paddingLeft, indent } = dimensions;

  // Color header based on mode
  const headerColor = inputMode === 'command' ? colors.yellow : colors.cyan;
  stdout.write(
    `\x1b[${line};${paddingLeft}H\x1b[K${headerColor}${colors.bold}Commands:${colors.reset}`,
  );

  // Determine highlighted command
  let highlightedIndex = index; // Default to currentSelectionTypeIndex
  if (inputMode === 'command' && currentInput) {
    const lowerInput = currentInput.toLowerCase();
    let maxOverlap = -1;
    selectionTypes.forEach((type, i) => {
      const displayText =
        type === 'done' ? 'done' : type === 'single' ? 'select first' : type;
      const lowerType = displayText.toLowerCase();
      let overlap = 0;
      for (let j = 0; j < Math.min(lowerType.length, lowerInput.length); j++) {
        if (lowerType[j] === lowerInput[j]) {
          overlap++;
        } else {
          break;
        }
      }
      if (overlap > maxOverlap && lowerType.includes(lowerInput)) {
        maxOverlap = overlap;
        highlightedIndex = i;
      }
    });
  }

  // Display each command on its own line with checkbox
  selectionTypes.forEach((type, i) => {
    const text =
      type === 'done' ? 'done' : type === 'single' ? 'select first' : type;
    const isHighlighted = i === highlightedIndex;
    const marker = isHighlighted ? `${colors.yellow}[x]${colors.reset}` : '[ ]';

    let formattedText = text;
    if (isHighlighted) {
      formattedText = `${colors.yellow}${colors.bold}${text}${colors.reset}`;
    } // Non-highlighted commands use default text color (no colors.gray)

    stdout.write(
      `\x1b[${line + 1 + i};${indent}H\x1b[K${marker} ${formattedText}`,
    );
  });
}
