// ui/components/history.ts
import { stdout } from 'process';
import type { TerminalDimensions } from '../../types';

export function renderHistory({
  history,
  lines,
  dimensions,
}: {
  history: string[];
  lines: number;
  dimensions: TerminalDimensions;
}): void {
  const { paddingLeft, cols } = dimensions;
  
  for (let i = 0; i < lines; i++) {
    const line = history[history.length - lines + i] || '';
    const startLine = i + 1; // Add 1 because terminal is 1-indexed
    stdout.write(
      `\x1b[${startLine};${paddingLeft}H\x1b[K${line.slice(0, cols - paddingLeft - 1)}`,
    );
  }
}
