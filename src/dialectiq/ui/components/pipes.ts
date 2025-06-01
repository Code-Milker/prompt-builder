// ui/components/pipes.ts
import { stdout } from 'process';
import { colors } from '../utils';
import type { TerminalDimensions, Pipe } from '../../types';

export function renderPipes({
  activePipes,
  availablePipes,
  inputMode,
  currentInput,
  startLine,
  dimensions,
}: {
  activePipes: string[];
  availablePipes: Pipe[];
  inputMode: 'input' | 'transformation' | 'pipe';
  currentInput: string;
  startLine: number;
  dimensions: TerminalDimensions;
}): number {
  const { paddingLeft, indent } = dimensions;
  let currentLine = startLine;

  // Color header based on mode
  const headerColor = inputMode === 'pipe' ? colors.blue : colors.cyan;
  stdout.write(
    `\x1b[${currentLine};${paddingLeft}H\x1b[K${headerColor}${colors.bold}Pipes:${colors.reset}`,
  );
  currentLine++;

  if (availablePipes.length === 0) {
    stdout.write(`\x1b[${currentLine};${indent}H\x1b[KNone available`);
    currentLine++;
    return currentLine;
  }

  availablePipes.forEach((pipe, idx) => {
    const isActive = activePipes.includes(pipe.name);
    const marker = isActive ? `${colors.green}[x]${colors.reset}` : '[ ]';
    let formattedName = pipe.name;

    // Highlight active pipe in green
    if (isActive) {
      formattedName = `${colors.green}${colors.bold}${pipe.name}${colors.reset}`;
    }
    // Highlight matching pipe in blue when in pipe mode
    else if (inputMode === 'pipe' && currentInput) {
      const lowerName = pipe.name.toLowerCase();
      const lowerInput = currentInput.toLowerCase();
      if (lowerName.includes(lowerInput)) {
        formattedName = `${colors.blue}${colors.bold}${pipe.name}${colors.reset}`;
      }
    }

    stdout.write(
      `\x1b[${currentLine};${indent}H\x1b[K${marker} ${formattedName} ${pipe.description}`,
    );
    currentLine++;
  });

  return currentLine;
}
