// ui/components/state.ts
import { stdout } from 'process';
import type { TerminalDimensions } from '../../types';
import { colors } from '../../ui/utils';

export function renderState({
  state,
  startLine,
  dimensions,
}: {
  state: Record<string, any>;
  startLine: number;
  dimensions: TerminalDimensions;
}): number {
  const { paddingLeft, indent } = dimensions;
  let currentLine = startLine;

  stdout.write(
    `\x1b[${currentLine};${paddingLeft}H\x1b[K${colors.cyan}${colors.bold}State:${colors.reset}`,
  );
  currentLine++;

  Object.entries(state).forEach(([key, value]) => {
    if (key !== 'selections') {
      const lines = value.toString().split('\n');
      stdout.write(`\x1b[${currentLine};${indent}H\x1b[K${key}: ${lines[0]}`);
      lines
        .slice(1)
        .forEach((l, idx) =>
          stdout.write(
            `\x1b[${currentLine + idx + 1};${indent + 2}H\x1b[K${l}`,
          ),
        );
      currentLine += lines.length;
    }
  });

  return currentLine;
}
