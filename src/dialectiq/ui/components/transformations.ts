// ui/components/transformations.ts
import { stdout } from 'process';
import { colors } from '../utils.ts';
import type { TerminalDimensions, Transformation } from '../../types';

export function renderTransformations({
  activeTransformations,
  availableTransformations,
  inputMode,
  currentInput,
  startLine,
  dimensions,
}: {
  activeTransformations: string[];
  availableTransformations: Transformation[];
  inputMode: 'input' | 'command' | 'transformation';
  currentInput: string;
  startLine: number;
  dimensions: TerminalDimensions;
}): number {
  const { paddingLeft, indent } = dimensions;
  let currentLine = startLine;

  // Color header based on mode
  const headerColor =
    inputMode === 'transformation' ? colors.magenta : colors.cyan;
  stdout.write(
    `\x1b[${currentLine};${paddingLeft}H\x1b[K${headerColor}${colors.bold}Transformations:${colors.reset}`,
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
    // const transformKey = `${idx + 1}`;

    let formattedName = transform.name;

    // Highlight active transformation in green
    if (isActive) {
      formattedName = `${colors.green}${colors.bold}${transform.name}${colors.reset}`;
    }
    // Highlight matching transformation in magenta when in transformation mode
    else if (inputMode === 'transformation' && currentInput) {
      const lowerName = transform.name.toLowerCase();
      const lowerInput = currentInput.toLowerCase();
      if (lowerName.includes(lowerInput)) {
        formattedName = `${colors.magenta}${colors.bold}${transform.name}${colors.reset}`;
      }
    }

    stdout.write(
      `\x1b[${currentLine};${indent}H\x1b[K${marker} ${formattedName} ${transform.description}`,
    );
    currentLine++;
  });

  return currentLine;
}
