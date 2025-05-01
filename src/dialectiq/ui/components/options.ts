// ui/components/options.ts
import { stdout } from 'process';
import { colors } from '../../ui/utils';
import type { SelectionContext, TerminalDimensions } from '../../types';

export function renderAvailableOptions<T>({
  context,
  displayOptions,
  getName,
  display,
  startLine,
  dimensions,
}: {
  context: SelectionContext<T>;
  displayOptions: T[];
  getName: (option: T) => string;
  display: (option: T, input: string) => string;
  startLine: number;
  dimensions: TerminalDimensions;
}): void {
  const { paddingLeft, cols } = dimensions;
  const {
    selectedOptions,
    availableOptions,
    currentInput,
    selectionTypes,
    currentSelectionTypeIndex,
  } = context;

  let highlightedOptions: Set<T> = new Set();
  let highlightColor: string = colors.cyan;
  const currentType = selectionTypes[currentSelectionTypeIndex];
  const lowerInput = currentInput.toLowerCase();

  // Determine which options to highlight based on selection type
  if (currentType === 'single' && currentInput) {
    const firstMatch = availableOptions.find((opt, idx) => {
      const optionNumber = (idx + 1).toString();
      const name = getName(opt).toLowerCase();
      return `${optionNumber} ${name}`.includes(lowerInput);
    });
    if (firstMatch) highlightedOptions.add(firstMatch);
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
    highlightColor = colors.red;
  }

  // Get display text for current command
  const currentCommand =
    currentType === 'done'
      ? 'done'
      : currentType === 'single'
        ? 'select first'
        : currentType;

  // Render the header with command and navigation indicator
  stdout.write(
    `\x1b[${startLine};${paddingLeft}H\x1b[K${colors.cyan}${colors.bold}Options (${selectedOptions.length}/${availableOptions.length}) | Command: ${currentCommand} [←/→]${colors.reset}`,
  );

  // Render each option
  displayOptions.forEach((opt, idx) => {
    const num = (idx + 1).toString().padStart(2, ' ');
    const text = `${num}. ${display(opt, currentInput)}`;
    let finalText = text;

    if (selectedOptions.includes(opt)) {
      finalText = `${colors.green}${finalText}${colors.reset}`;
    }
    if (highlightedOptions.has(opt)) {
      finalText = `${highlightColor}${finalText}${colors.reset}`;
    }

    stdout.write(
      `\x1b[${startLine + 1 + idx};${paddingLeft}H\x1b[K${finalText.slice(0, cols - paddingLeft - 1)}`,
    );
  });
}
