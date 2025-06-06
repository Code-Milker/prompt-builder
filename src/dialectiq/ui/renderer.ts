// ui/renderer.ts
import { getTerminalDimensions, clearScreen } from '../terminal';
import { renderHistory } from './components/history';
import { renderState } from './components/state';
import { renderAvailableOptions } from './components/options';
import { renderInputPrompt } from './components/prompt';
import { renderTransformations } from './components/transformations';
import { renderPipes } from './components/pipes';
import { findMatches, groupOptionsByDirectory } from '../core/matching';
import type {
  SelectionContext,
  TerminalDimensions,
  Transformation,
  Pipe,
} from '../types';
import { colors } from './utils';
import { stdout } from 'bun';

export function renderInterface<T>({
  context,
  history,
  state,
  getName,
  display,
  maxDisplay,
}: {
  context: SelectionContext<T>;
  history: string[];
  state: Record<string, any>;
  getName: (option: T) => string;
  display: (option: T, input: string) => string;
  maxDisplay?: number;
}): void {
  const dimensions = getTerminalDimensions();
  const { rows, paddingTop } = dimensions;

  // Calculate available space
  const historyLines = Math.min(5, history.length);
  let stateLines = calculateStateLines(state);
  const transformationLines = calculateTransformationLines(
    context.availableTransformations,
  );
  const pipeLines = calculatePipeLines(context.availablePipes);
  const optionsHeaderLines = 1;
  const promptLines = 1;
  const spacingLines = 3; // Spacing for transformations and pipes sections

  const usedLines =
    paddingTop +
    historyLines +
    stateLines +
    transformationLines +
    pipeLines +
    optionsHeaderLines +
    promptLines +
    spacingLines;

  const remainingLines = Math.max(5, rows - usedLines);
  const calculatedMaxDisplay = maxDisplay || remainingLines;

  let currentLine = paddingTop + historyLines + 1;

  // Prepare display options
  const displayOptions = prepareDisplayOptions({
    context,
    getName,
    maxDisplay: calculatedMaxDisplay,
  });

  // Render components
  clearScreen();
  renderHistory({
    history,
    lines: historyLines,
    dimensions,
  });

  currentLine = renderState({
    state,
    startLine: paddingTop + historyLines,
    dimensions,
  });

  currentLine = renderTransformations({
    activeTransformations: context.activeTransformations,
    availableTransformations: context.availableTransformations,
    inputMode: context.inputMode,
    currentInput: context.currentInput,
    startLine: currentLine,
    dimensions,
  });

  currentLine += 1; // Add spacing

  currentLine = renderPipes({
    activePipes: context.activePipes,
    availablePipes: context.availablePipes,
    inputMode: context.inputMode,
    currentInput: context.currentInput,
    startLine: currentLine,
    dimensions,
  });

  currentLine += 1; // Add spacing

  renderAvailableOptions({
    context,
    displayOptions,
    getName,
    display,
    startLine: currentLine,
    dimensions,
  });

  renderInputPrompt({
    error: context.errorMessage,
    input: context.currentInput,
    inputMode: context.inputMode,
    dimensions,
  });

  // Render help text for mode switching at the bottom
  renderModeHelp(dimensions);
}

function renderModeHelp(dimensions: TerminalDimensions): void {
  const { rows, paddingLeft } = dimensions;
  const helpLine = rows - 2;
  // stdout.write(
  //   `\x1b[${helpLine};${paddingLeft}H\x1b[K${colors.dim}[Tab] Switch mode | [Enter] Apply command | [←/→] Change command`,
  // );
}

function calculateStateLines(state: Record<string, any>): number {
  let lines = 1; // Header line
  Object.entries(state).forEach(([key, value]) => {
    if (key !== 'selections') {
      lines += value.toString().split('\n').length;
    }
  });
  return lines;
}

function calculateTransformationLines(
  transformations: Transformation[],
): number {
  return transformations.length === 0 ? 2 : transformations.length + 1;
}

function calculatePipeLines(pipes: Pipe[]): number {
  return pipes.length === 0 ? 2 : pipes.length + 1;
}

function prepareDisplayOptions<T>({
  context,
  getName,
  maxDisplay,
}: {
  context: SelectionContext<T>;
  getName: (option: T) => string;
  maxDisplay: number;
}): T[] {
  const { selectedOptions, availableOptions, currentInput } = context;

  // Filter available options based on input
  const matchingOptions =
    currentInput && context.inputMode === 'input'
      ? findMatches({ input: currentInput, options: availableOptions, getName })
      : availableOptions;

  // Get matching unselected options
  const matchingUnselected = matchingOptions.filter(
    (opt) => !selectedOptions.includes(opt),
  );

  // Combine selected options with matching unselected options
  const totalOptionsToDisplay = [...selectedOptions, ...matchingUnselected];

  // Group and limit to maxDisplay
  const displayOptions = groupOptionsByDirectory({
    options: totalOptionsToDisplay,
    getName,
    maxDisplay,
  });

  return displayOptions;
}
