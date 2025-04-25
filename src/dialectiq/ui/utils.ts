// ui/utils.ts

export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
};

export function formatText(
  text: string,
  options: {
    color?: keyof typeof colors;
    bg?: keyof typeof colors;
    bold?: boolean;
    dim?: boolean;
    italic?: boolean;
    underline?: boolean;
  },
): string {
  let formatted = '';
  if (options.color) formatted += colors[options.color];
  if (options.bg) formatted += colors[options.bg];
  if (options.bold) formatted += colors.bold;
  if (options.dim) formatted += colors.dim;
  if (options.italic) formatted += colors.italic;
  if (options.underline) formatted += colors.underline;

  formatted += text + colors.reset;
  return formatted;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export function padText(
  text: string,
  length: number,
  align: 'left' | 'right' | 'center' = 'left',
): string {
  if (text.length >= length) return text.slice(0, length);

  const padding = ' '.repeat(length - text.length);

  if (align === 'right') return padding + text;
  if (align === 'center') {
    const leftPad = ' '.repeat(Math.floor((length - text.length) / 2));
    const rightPad = ' '.repeat(Math.ceil((length - text.length) / 2));
    return leftPad + text + rightPad;
  }

  return text + padding; // left align default
}
