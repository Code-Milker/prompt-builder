// ui/components/transformations.ts
import { stdout } from 'process';
import { colors } from '../utils';
import type { TerminalDimensions, Transformation } from '../../types';

export function renderTransformations({
  activeTransformations,
  availableTransformations,
  startLine,
  dimensions,
}: {
  activeTransformations: string[];
  availableTransformations: Transformation[];
  startLine: number;
  dimensions: TerminalDimensions;
}): number {
  const { paddingLeft, indent } = dimensions;
  let currentLine = startLine;

  stdout.write(
    `\x1b[${currentLine};${paddingLeft}H\x1b[K${colors.cyan}${colors.bold}Transformations:${colors.reset}`,
  );
  currentLine++;

  if (availableTransformations.length === 0) {
    stdout.write(`\x1b[${currentLine};${indent}H\x1b[KNone available`);
    currentLine++;
    return currentLine;
  }

  availableTransformations.forEach((transform, idx) => {
    const isActive = activeTransformations.includes(transform.name);
    const marker = isActive ? `${colors.green}[x]${colors.reset}` : '[ ]';
    const transformKey = `${idx + 1}`;

    stdout.write(
      `\x1b[${currentLine};${indent}H\x1b[K${marker} ${transformKey}: ${transform.name} - ${transform.description}`,
    );
    currentLine++;
  });

  return currentLine;
}
