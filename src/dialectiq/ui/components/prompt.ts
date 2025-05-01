import { stdout } from 'process';
import type { TerminalDimensions } from '../../types';
import { colors } from '../../ui/utils';

export function renderInputPrompt({
  error,
  input,
  inputMode,
  dimensions,
}: {
  error: string;
  input: string;
  inputMode: 'input' | 'transformation';
  dimensions: TerminalDimensions;
}): void {
  const { rows, paddingLeft } = dimensions;

  let modeLabel = '';
  let modeColor = '';
  switch (inputMode) {
    case 'transformation':
      modeLabel = '(transformations)';
      modeColor = colors.magenta;
      break;
    default:
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
