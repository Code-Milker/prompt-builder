import { stdout } from 'process';
import type { TerminalDimensions, SelectionContext } from '../../types'; // Added SelectionContext
import { colors } from '../../ui/utils';

export function renderInputPrompt({
  error,
  input,
  inputMode, // Type will be inferred from SelectionContext['inputMode']
  dimensions,
}: {
  error: string;
  input: string;
  inputMode: SelectionContext<any>['inputMode']; // Updated type
  dimensions: TerminalDimensions;
}): void {
  const { rows, paddingLeft } = dimensions;

  let modeLabel = '';
  let modeColor = '';
  switch (inputMode) {
    case 'transformation':
      modeLabel = '(Transformations)';
      modeColor = colors.magenta;
      break;
    case 'pipe':
      modeLabel = '(Pipes)';
      modeColor = colors.blue;
      break;
    case 'paste': // Added paste mode
      modeLabel = '(Paste Text)';
      modeColor = colors.yellow; // Or another color of your choice
      break;
    default: // 'input' mode
      modeLabel = '(Options)';
      modeColor = colors.green;
  }

  const prompt = error
    ? `${colors.red}Error: ${error}${colors.reset}`
    : `${modeColor}${modeLabel}${colors.reset} > ${input}`;

  stdout.write(`\x1b[${rows};${paddingLeft}H\x1b[K${prompt}`);

  // Position cursor appropriately
  if (error) {
    stdout.write('\x1b[?25l'); // Hide cursor
  } else {
    const cursorOffset = modeLabel.length + 2; // Account for mode label and "> "
    stdout.write(
      `\x1b[${rows};${paddingLeft + cursorOffset + input.length}H\x1b[?25h`,
    ); // Show cursor at input position
  }
}
