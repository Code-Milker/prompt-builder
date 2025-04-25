

// ui/components/prompt.ts
import { stdout } from 'process';
import type { TerminalDimensions } from '../../types';
import { colors } from '../../ui/utils';

export function renderInputPrompt({
  error,
  input,
  dimensions,
}: {
  error: string;
  input: string;
  dimensions: TerminalDimensions;
}): void {
  const { rows, paddingLeft } = dimensions;

  const prompt = error
    ? `${colors.red}Error: ${error}${colors.reset}`
    : `${colors.green}> ${input}${colors.reset}`;

  stdout.write(`\x1b[${rows};${paddingLeft}H\x1b[K${prompt}`);

  // Position cursor appropriately
  if (error) {
    stdout.write('\x1b[?25l'); // Hide cursor
  } else {
    stdout.write(`\x1b[${rows};${paddingLeft + 2 + input.length}H\x1b[?25h`); // Show cursor at input position
  }
}
