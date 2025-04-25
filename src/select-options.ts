import { stdin, stdout } from 'process';
import { colors } from './cli.use.utils';
import path from 'path';

interface SelectOptionParams<T, S extends Record<string, any>> {
  options: T[];
  getName: (option: T) => string;
  display?: (option: T, input: string) => string;
  history: string[];
  state: S;
  maxDisplay?: number;
  maxSelections?: number | null;
}

type SelectOptionReturn<T, S extends Record<string, any>> = S & {
  selections: T[];
};

function defaultDisplay<T>({
  option,
  input,
  getName,
}: {
  option: T;
  input: string;
  getName: (option: T) => string;
}): string {
  const name = getName(option);
  if (!input) return name;

  const lowerName = name.toLowerCase();
  const lowerInput = input.toLowerCase();
  const inputChars = lowerInput.split('');
  let nameIndex = 0;
  const matchIndices: number[] = [];

  for (const char of inputChars) {
    nameIndex = lowerName.indexOf(char, nameIndex);
    if (nameIndex === -1) return name;
    matchIndices.push(nameIndex);
    nameIndex++;
  }

  let result = '';
  let lastIndex = 0;
  matchIndices.forEach((index) => {
    result += name.slice(lastIndex, index);
    result += `\x1b[36m${name[index]}\x1b[0m`;
    lastIndex = index + 1;
  });
  result += name.slice(lastIndex);

  return result;
}

export async function selectOption2<T, S extends Record<string, any>>({
  options,
  getName,
  display,
  history,
  state,
  maxDisplay,
  maxSelections = null,
}: SelectOptionParams<T, S>): Promise<SelectOptionReturn<T, S>> {
  return new Promise((resolve) => {
    const displayFn =
      display ||
      ((option: T, input: string) =>
        defaultDisplay({ option, input, getName }));
    const context = initializeContext({ options, state });
    const updateState = () =>
      updateSelectionState({
        state,
        selectedOptions: context.selectedOptions,
        getName,
      });
    const render = () =>
      renderInterface({
        context,
        history,
        state,
        getName,
        display: displayFn,
        maxDisplay,
      });
    setupTerminal();
    updateState();
    render();
    const onData = (data: string) =>
      handleInput({
        data,
        context,
        getName,
        maxSelections,
        updateState,
        render,
        cleanup: () => cleanupTerminal({ resolve, state }),
      });
    stdin.on('data', onData);
  });
}

function initializeContext<T, S extends Record<string, any>>({
  options,
  state,
}: {
  options: T[];
  state: S;
}) {
  return {
    currentInput: '',
    selectedOptions: state.selections ? [...state.selections] : ([] as T[]),
    availableOptions: [...options],
    errorMessage: '',
    selectionTypes: [
      'single',
      'range',
      'selectAll',
      'unselectAll',
      'done',
    ] as const,
    currentSelectionTypeIndex: 0,
    MAX_DISPLAY_SELECTED: 10,
  };
}

function updateSelectionState<T>({
  state,
  selectedOptions,
  getName,
}: {
  state: Record<string, any>;
  selectedOptions: T[];
  getName: (option: T) => string;
}) {
  const selectedNames = selectedOptions.map(getName);
  state['Selected'] =
    selectedNames.length === 0
      ? 'None'
      : selectedNames.length <= 10
        ? selectedNames.join('\n')
        : `${selectedNames.slice(0, 10).join('\n')}\n... and ${selectedNames.length - 10} more`;
  state['selections'] = selectedOptions;
}

function renderInterface<T>({
  context,
  history,
  state,
  getName,
  display,
  maxDisplay,
}: {
  context: ReturnType<typeof initializeContext>;
  history: string[];
  state: Record<string, any>;
  getName: (option: T) => string;
  display: (option: T, input: string) => string;
  maxDisplay?: number;
}) {
  const { rows, cols, paddingTop, paddingLeft, indent } =
    getTerminalDimensions();
  const historyLines = Math.min(5, history.length);

  let stateLines = 1;
  Object.entries(state).forEach(([key, value]) => {
    if (key !== 'selections') {
      const lines = value.toString().split('\n');
      stateLines += lines.length;
    }
  });
  const commandLines = 2;
  const optionsHeaderLines = 1;
  const promptLines = 1;
  const spacingLines = 2;

  const usedLines =
    paddingTop +
    historyLines +
    stateLines +
    commandLines +
    optionsHeaderLines +
    promptLines +
    spacingLines;
  const remainingLines = Math.max(5, rows - usedLines);
  const calculatedMaxDisplay = maxDisplay || remainingLines;

  let currentLine = paddingTop + historyLines + 1;

  clearScreen();
  renderHistory({
    history,
    lines: historyLines,
    start: paddingTop,
    left: paddingLeft,
    cols,
  });
  currentLine = renderState({
    state,
    start: paddingTop + historyLines,
    indent,
    left: paddingLeft,
    line: currentLine,
  });
  renderCommands({
    selectionTypes: context.selectionTypes,
    index: context.currentSelectionTypeIndex,
    line: currentLine,
    left: paddingLeft,
    indent,
  });
  currentLine += commandLines + 1;
  renderAvailableOptions({
    selected: context.selectedOptions,
    available: context.availableOptions,
    getName,
    display,
    input: context.currentInput,
    start: currentLine,
    left: paddingLeft,
    cols,
    maxDisplay: calculatedMaxDisplay,
    selectionTypes: context.selectionTypes,
    typeIndex: context.currentSelectionTypeIndex,
  });
  renderInputPrompt({
    rows,
    left: paddingLeft,
    error: context.errorMessage,
    input: context.currentInput,
  });
}

function setupTerminal() {
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
}

function cleanupTerminal<T>({
  resolve,
  state,
}: {
  resolve: (value: Record<string, any>) => void;
  state: Record<string, any>;
}) {
  stdout.write('\x1b[?1049l\x1b[?25h');
  stdin.setRawMode(false);
  stdin.removeAllListeners('data');
  stdout.write('\n');
  resolve(state);
}

function handleInput<T>({
  data,
  context,
  getName,
  maxSelections,
  updateState,
  render,
  cleanup,
}: {
  data: string;
  context: ReturnType<typeof initializeContext>;
  getName: (option: T) => string;
  maxSelections: number | null;
  updateState: () => void;
  render: () => void;
  cleanup: () => void;
}) {
  const char = data.toString();
  const { selectionTypes, availableOptions } = context;

  if (char === '\x03') cleanup();
  else if (char === '\t')
    switchSelectionType({ context, selectionTypes, render });
  else if (char === '\r')
    handleEnter({
      context,
      selectionTypes,
      availableOptions,
      getName,
      maxSelections,
      updateState,
      render,
      cleanup,
    });
  else if (char === '\x7f') backspaceInput({ context, render });
  else if (char >= ' ' && char <= '~') appendInput({ context, char, render });
}

function switchSelectionType({
  context,
  selectionTypes,
  render,
}: {
  context: ReturnType<typeof initializeContext>;
  selectionTypes: readonly string[];
  render: () => void;
}) {
  context.currentSelectionTypeIndex =
    (context.currentSelectionTypeIndex + 1) % selectionTypes.length;
  context.errorMessage = '';
  render();
}

function handleEnter<T>({
  context,
  selectionTypes,
  availableOptions,
  getName,
  maxSelections,
  updateState,
  render,
  cleanup,
}: {
  context: ReturnType<typeof initializeContext>;
  selectionTypes: readonly string[];
  availableOptions: T[];
  getName: (option: T) => string;
  maxSelections: number | null;
  updateState: () => void;
  render: () => void;
  cleanup: () => void;
}) {
  const type = selectionTypes[context.currentSelectionTypeIndex];
  if (type === 'done') cleanup();
  else if (type === 'single')
    handleSingleSelection({
      context,
      availableOptions,
      getName,
      maxSelections,
      updateState,
      render,
    });
  else if (type === 'range')
    handleRangeSelection({
      context,
      availableOptions,
      maxSelections,
      updateState,
      render,
    });
  else if (type === 'selectAll')
    selectAllOptions({
      context,
      availableOptions,
      updateState,
      render,
    });
  else if (type === 'unselectAll')
    unselectAllOptions({ context, updateState, render });

  if (
    maxSelections !== null &&
    context.selectedOptions.length >= maxSelections
  ) {
    cleanup();
  }
}

function appendInput({
  context,
  char,
  render,
}: {
  context: ReturnType<typeof initializeContext>;
  char: string;
  render: () => void;
}) {
  context.currentInput += char;
  context.errorMessage = '';
  render();
}

function backspaceInput({
  context,
  render,
}: {
  context: ReturnType<typeof initializeContext>;
  render: () => void;
}) {
  context.currentInput = context.currentInput.slice(0, -1);
  context.errorMessage = '';
  render();
}

function handleSingleSelection<T>({
  context,
  availableOptions,
  getName,
  maxSelections,
  updateState,
  render,
}: {
  context: ReturnType<typeof initializeContext>;
  availableOptions: T[];
  getName: (option: T) => string;
  maxSelections: number | null;
  updateState: () => void;
  render: () => void;
}) {
  const { currentInput, selectedOptions } = context;
  if (!currentInput) {
    context.errorMessage = 'Enter a search term to select an option.';
    render();
    return;
  }
  const matches = findMatches({
    input: currentInput,
    options: availableOptions,
    getName,
  });
  if (
    matches.length > 0 &&
    canAddSelection({ selectedOptions, maxSelections })
  ) {
    context.selectedOptions.push(matches[0]);
    context.currentInput = '';
    context.errorMessage = '';
    updateState();
  } else {
    context.errorMessage = matches.length
      ? 'Selection limit reached.'
      : 'No options match your search.';
  }
  render();
}

function handleRangeSelection<T>({
  context,
  availableOptions,
  maxSelections,
  updateState,
  render,
}: {
  context: ReturnType<typeof initializeContext>;
  availableOptions: T[];
  maxSelections: number | null;
  updateState: () => void;
  render: () => void;
}) {
  const { currentInput, selectedOptions } = context;
  const rangeMatch = currentInput.match(/^(\d+)-(\d+)$/);
  if (!rangeMatch) {
    context.errorMessage = 'Enter range (e.g., 3-5)';
    render();
    return;
  }
  const [start, end] = [
    parseInt(rangeMatch[1], 10),
    parseInt(rangeMatch[2], 10),
  ];
  if (start <= end && start >= 1 && end <= availableOptions.length) {
    for (let i = start - 1; i < end; i++) {
      if (
        canAddSelection({ selectedOptions, maxSelections }) &&
        !selectedOptions.includes(availableOptions[i])
      ) {
        selectedOptions.push(availableOptions[i]);
      }
    }
    context.currentInput = '';
    context.errorMessage = '';
    updateState();
  } else {
    context.errorMessage = `Invalid range: must be between 1 and ${availableOptions.length}`;
  }
  render();
}

function selectAllOptions<T>({
  context,
  availableOptions,
  updateState,
  render,
}: {
  context: ReturnType<typeof initializeContext>;
  availableOptions: T[];
  updateState: () => void;
  render: () => void;
}) {
  const { selectedOptions } = context;
  availableOptions.forEach((opt) => {
    if (!selectedOptions.includes(opt)) {
      selectedOptions.push(opt);
    }
  });
  context.currentInput = '';
  context.errorMessage = '';
  updateState();
  render();
}

function unselectAllOptions<T>({
  context,
  updateState,
  render,
}: {
  context: ReturnType<typeof initializeContext>;
  updateState: () => void;
  render: () => void;
}) {
  context.selectedOptions = [];
  context.currentInput = '';
  context.errorMessage = '';
  updateState();
  render();
}

function findMatches<T>({
  input,
  options,
  getName,
}: {
  input: string;
  options: T[];
  getName: (option: T) => string;
}): T[] {
  if (!input) return options;

  const lowerInput = input.toLowerCase();
  const inputChars = lowerInput.split('');

  return options.filter((opt) => {
    const name = getName(opt).toLowerCase();
    let nameIndex = 0;

    for (const char of inputChars) {
      nameIndex = name.indexOf(char, nameIndex);
      if (nameIndex === -1) return false;
      nameIndex++;
    }
    return true;
  });
}

function canAddSelection<T>({
  selectedOptions,
  maxSelections,
}: {
  selectedOptions: T[];
  maxSelections: number | null;
}): boolean {
  return maxSelections === null || selectedOptions.length < maxSelections;
}

function getTerminalDimensions() {
  return {
    rows: process.stdout.rows || 24,
    cols: process.stdout.columns || 80,
    paddingTop: 1,
    paddingLeft: 1,
    indent: 2,
  };
}

function clearScreen() {
  stdout.write('\x1b[2J\x1b[?1049h\x1b[H\x1b[0;0r');
}

function renderHistory({
  history,
  lines,
  start,
  left,
  cols,
}: {
  history: string[];
  lines: number;
  start: number;
  left: number;
  cols: number;
}) {
  for (let i = 0; i < lines; i++) {
    const line = history[history.length - lines + i] || '';
    stdout.write(
      `\x1b[${start + i};${left}H\x1b[K${line.slice(0, cols - left - 1)}`,
    );
  }
}

function renderState({
  state,
  start,
  indent,
  left,
  line,
}: {
  state: Record<string, any>;
  start: number;
  indent: number;
  left: number;
  line: number;
}) {
  stdout.write(
    `\x1b[${start};${left}H\x1b[K${colors.cyan}${colors.bold}State:${colors.reset}`,
  );
  Object.entries(state).forEach(([key, value]) => {
    if (key !== 'selections') {
      const lines = value.toString().split('\n');
      stdout.write(`\x1b[${line};${indent}H\x1b[K${key}: ${lines[0]}`);
      lines
        .slice(1)
        .forEach((l, idx) =>
          stdout.write(`\x1b[${line + idx + 1};${indent + 2}H\x1b[K${l}`),
        );
      line += lines.length;
    }
  });
  return line;
}

function renderCommands({
  selectionTypes,
  index,
  line,
  left,
  indent,
}: {
  selectionTypes: readonly string[];
  index: number;
  line: number;
  left: number;
  indent: number;
}) {
  stdout.write(
    `\x1b[${line};${left}H\x1b[K${colors.cyan}${colors.bold}Commands:${colors.reset}`,
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

function renderAvailableOptions<T>({
  selected,
  available,
  getName,
  display,
  input,
  start,
  left,
  cols,
  maxDisplay,
  selectionTypes,
  typeIndex,
}: {
  selected: T[];
  available: T[];
  getName: (option: T) => string;
  display: (option: T, input: string) => string;
  input: string;
  start: number;
  left: number;
  cols: number;
  maxDisplay: number;
  selectionTypes: readonly string[];
  typeIndex: number;
}) {
  let highlightedOptions: Set<T> = new Set();
  let highlightColor: string = colors.cyan;
  const currentType = selectionTypes[typeIndex];
  const lowerInput = input.toLowerCase();

  if (currentType === 'single' && input) {
    const firstMatch = available.find((opt, idx) => {
      const optionNumber = (idx + 1).toString();
      const name = getName(opt).toLowerCase();
      return `${optionNumber} ${name}`.includes(lowerInput);
    });
    if (firstMatch) highlightedOptions.add(firstMatch);
  } else if (currentType === 'range' && input) {
    const rangeMatch = input.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (start <= end && start >= 1 && end <= available.length) {
        for (let i = start - 1; i < end; i++) {
          highlightedOptions.add(available[i]);
        }
      }
    }
  } else if (currentType === 'selectAll') {
    available.forEach((opt) => highlightedOptions.add(opt));
  } else if (currentType === 'unselectAll') {
    selected.forEach((opt) => highlightedOptions.add(opt));
    highlightColor = colors.red;
  }

  // Step 1: Filter options first
  let filteredOptions = input
    ? findMatches({ input, options: available, getName })
    : available;
  const unselectedOptions = filteredOptions.filter(
    (opt) => !selected.includes(opt),
  );
  let totalOptionsToDisplay = [...selected, ...unselectedOptions];
  const totalOptionsCount = totalOptionsToDisplay.length;

  // Step 2: Group filtered options by top-level directory
  const optionsByTopLevelDir: { [topLevelDir: string]: T[] } = {};
  totalOptionsToDisplay.forEach((opt) => {
    const name = getName(opt);
    const topLevelDir = name.includes(path.sep) ? name.split(path.sep)[0] : '.';
    if (!optionsByTopLevelDir[topLevelDir]) {
      optionsByTopLevelDir[topLevelDir] = [];
    }
    optionsByTopLevelDir[topLevelDir].push(opt);
  });

  const topLevelDirs = Object.keys(optionsByTopLevelDir).sort();
  let displayOptions: T[] = [];

  if (totalOptionsCount <= maxDisplay) {
    // Display all options if they fit
    topLevelDirs.forEach((dir) => {
      optionsByTopLevelDir[dir].sort((a, b) =>
        getName(a).localeCompare(getName(b)),
      );
      displayOptions.push(...optionsByTopLevelDir[dir]);
    });
  } else {
    const n = topLevelDirs.length;
    if (n > 0) {
      // Step 3: Calculate base slots per directory based on filtered directories
      const baseSlots = Math.floor(maxDisplay / n);
      let remainingSlots = maxDisplay % n;
      const slotsByDir: { [dir: string]: number } = {};

      // Initial allocation based on filtered file counts
      topLevelDirs.forEach((dir) => {
        const fileCount = optionsByTopLevelDir[dir].length;
        slotsByDir[dir] = Math.min(baseSlots, fileCount);
      });

      // Step 4: Distribute remaining slots to directories with more files
      let totalAssigned = topLevelDirs.reduce(
        (sum, dir) => sum + slotsByDir[dir],
        0,
      );
      remainingSlots = maxDisplay - totalAssigned;
      let dirIndex = 0;
      while (remainingSlots > 0 && dirIndex < topLevelDirs.length) {
        const dir = topLevelDirs[dirIndex];
        if (optionsByTopLevelDir[dir].length > slotsByDir[dir]) {
          slotsByDir[dir]++;
          remainingSlots--;
        }
        dirIndex = (dirIndex + 1) % topLevelDirs.length; // Cycle through dirs to distribute fairly
      }

      // Step 5: Build display options with sorted files
      displayOptions = [];
      topLevelDirs.forEach((dir) => {
        const dirOptions = optionsByTopLevelDir[dir]
          .sort((a, b) => getName(a).localeCompare(getName(b)))
          .slice(0, slotsByDir[dir]);
        displayOptions.push(...dirOptions);
      });

      // Step 6: Fill any remaining space up to maxDisplay
      let currentCount = displayOptions.length;
      if (currentCount < maxDisplay) {
        let slotsToFill = maxDisplay - currentCount;
        dirIndex = 0;
        while (slotsToFill > 0 && dirIndex < topLevelDirs.length) {
          const dir = topLevelDirs[dirIndex];
          const remainingFiles =
            optionsByTopLevelDir[dir].length - slotsByDir[dir];
          if (remainingFiles > 0) {
            const toAdd = Math.min(remainingFiles, slotsToFill);
            const extraOptions = optionsByTopLevelDir[dir]
              .sort((a, b) => getName(a).localeCompare(getName(b)))
              .slice(slotsByDir[dir], slotsByDir[dir] + toAdd);
            displayOptions.push(...extraOptions);
            slotsByDir[dir] += toAdd;
            slotsToFill -= toAdd;
          }
          dirIndex++;
        }
      }

      displayOptions = displayOptions.slice(0, maxDisplay);
    }
  }

  stdout.write(
    `\x1b[${start};${left}H\x1b[K${colors.cyan}${colors.bold}Options (${selected.length}/${available.length})${colors.reset}`,
  );

  displayOptions.forEach((opt, idx) => {
    const num = (idx + 1).toString().padStart(2, ' ');
    const text = `${num}. ${display(opt, input)}`;
    let finalText = text;

    if (selected.includes(opt)) {
      finalText = `${colors.green}${finalText}${colors.reset}`;
    }
    if (highlightedOptions.has(opt)) {
      finalText = `${highlightColor}${finalText}${colors.reset}`;
    }

    stdout.write(
      `\x1b[${start + idx};${left}H\x1b[K${finalText.slice(0, cols - left - 1)}`,
    );
  });
}

function renderInputPrompt({
  rows,
  left,
  error,
  input,
}: {
  rows: number;
  left: number;
  error: string;
  input: string;
}) {
  const prompt = error
    ? `${colors.red}Error: ${error}${colors.reset}`
    : `${colors.green}> ${input}${colors.reset}`;
  stdout.write(`\x1b[${rows};${left + 1}H\x1b[K${prompt}`);
  stdout.write(
    error ? '\x1b[?25l' : `\x1b[${rows};${left + 3 + input.length}H\x1b[?25h`,
  );
}
