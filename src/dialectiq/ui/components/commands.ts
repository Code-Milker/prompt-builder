// ui/components/commands.ts
import { stdout } from 'process';
import { colors } from '../../ui/utils';
import type { TerminalDimensions } from '../../types';

export function renderCommands({
  selectionTypes,
  index,
  line,
  dimensions,
}: {
  selectionTypes: readonly string[];
  index: number;
  line: number;
  dimensions: TerminalDimensions;
}): void {
  const { paddingLeft, indent } = dimensions;

  stdout.write(
    `\x1b[${line};${paddingLeft}H\x1b[K${colors.cyan}${colors.bold}Commands:${colors.reset}`,
  );

  const texts = selectionTypes.map((t, i) => {
    const text = t === 'done' ? 'done' : t === 'single' ? 'select first' : t;
    const color =
      i === index ? (t === 'done' ? colors.yellow : '') : colors.gray;
    return `${color}${colors.bold}${text}${colors.reset}`;
  });

  stdout.write(
    `\x1b[${line + 1};${indent}H\x1b[K${colors.yellow}[enter: confirm]${colors.reset} ${texts.join(' | ')}`,
  );
}
