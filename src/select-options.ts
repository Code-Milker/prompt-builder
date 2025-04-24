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

  // Find the positions of each character in the fuzzy match
  for (const char of inputChars) {
    nameIndex = lowerName.indexOf(char, nameIndex);
    if (nameIndex === -1) return name; // If any character doesn't match, return unhighlighted
    matchIndices.push(nameIndex);
    nameIndex++;
  }

  // Build the highlighted string by inserting color codes around matched characters
  let result = '';
  let lastIndex = 0;
  matchIndices.forEach((index) => {
    result += name.slice(lastIndex, index); // Text before the match
    result += `\x1b[36m${name[index]}\x1b[0m`; // Highlight the matched character
    lastIndex = index + 1;
  });
  result += name.slice(lastIndex); // Text after the last match

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

  // Calculate lines used by history, state, commands, and other UI elements
  let stateLines = 1; // "State:" header
  Object.entries(state).forEach(([key, value]) => {
    if (key !== 'selections') {
      const lines = value.toString().split('\n');
      stateLines += lines.length;
    }
  });
  const commandLines = 2; // "Commands:" header + commands line
  const optionsHeaderLines = 1; // "Options (x/y)" line
  const promptLines = 1; // Input prompt line
  const spacingLines = 2; // Space between sections (e.g., between history and state, state and commands)

  // Calculate remaining lines for options
  const usedLines =
    paddingTop +
    historyLines +
    stateLines +
    commandLines +
    optionsHeaderLines +
    promptLines +
    spacingLines;
  const remainingLines = Math.max(5, rows - usedLines); // Ensure at least 5 lines for options
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
  currentLine += commandLines + 1; // Adjust for commands and spacing
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

  // Auto-complete if maxSelections is reached
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

    // Fuzzy match: Check if each character in the input can be found in sequence in the name
    for (const char of inputChars) {
      nameIndex = name.indexOf(char, nameIndex);
      if (nameIndex === -1) return false; // Character not found, no match
      nameIndex++; // Move to the next position after the found character
    }
    return true; // All characters matched in sequence
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

  // Step 1: Filter options based on input
  let filteredOptions = available;
  if (input) {
    filteredOptions = findMatches({ input, options: available, getName });
  }

  // Step 2: Combine selected and unselected options
  const unselectedOptions = filteredOptions.filter(
    (opt) => !selected.includes(opt),
  );
  let totalOptionsToDisplay = [...selected, ...unselectedOptions];

  // Step 3: Group options by subdirectory (or '.' for root-level files)
  const optionsBySubdir: { [subdir: string]: T[] } = {};
  totalOptionsToDisplay.forEach((opt) => {
    const name = getName(opt);
    const subdir = name.includes(path.sep) ? path.dirname(name) : '.'; // Use '.' for files in the root
    if (!optionsBySubdir[subdir]) {
      optionsBySubdir[subdir] = [];
    }
    optionsBySubdir[subdir].push(opt);
  });

  // Sort subdirectories alphabetically
  const subdirs = Object.keys(optionsBySubdir).sort();

  // Step 4: Limit to maxDisplay and distribute across subdirs
  let displayOptions: T[] = [];
  const totalOptionsCount = totalOptionsToDisplay.length;

  // If there are fewer options than maxDisplay, show all, but still group and sort
  if (totalOptionsCount <= maxDisplay) {
    subdirs.forEach((subdir) => {
      optionsBySubdir[subdir].sort((a, b) =>
        getName(a).localeCompare(getName(b)),
      );
      displayOptions.push(...optionsBySubdir[subdir]);
    });
  } else {
    // Distribute display slots across subdirectories
    const minSlotsPerSubdir = 1;
    let remainingSlots = maxDisplay - subdirs.length; // Reserve 1 slot per subdir
    if (remainingSlots < 0) remainingSlots = 0;

    // Calculate total files across all subdirs for proportional distribution
    const totalFiles = subdirs.reduce(
      (sum, subdir) => sum + optionsBySubdir[subdir].length,
      0,
    );
    const slotsBySubdir: { [subdir: string]: number } = {};

    // First pass: Assign minimum slots
    subdirs.forEach((subdir) => {
      slotsBySubdir[subdir] = Math.min(
        minSlotsPerSubdir,
        optionsBySubdir[subdir].length,
      );
    });

    // Second pass: Distribute remaining slots proportionally
    if (remainingSlots > 0) {
      const totalRemainingFiles = subdirs.reduce(
        (sum, subdir) =>
          sum +
          Math.max(0, optionsBySubdir[subdir].length - slotsBySubdir[subdir]),
        0,
      );
      subdirs.forEach((subdir) => {
        const additionalSlots =
          totalRemainingFiles > 0
            ? Math.floor(
                (Math.max(
                  0,
                  optionsBySubdir[subdir].length - slotsBySubdir[subdir],
                ) /
                  totalRemainingFiles) *
                  remainingSlots,
              )
            : 0;
        slotsBySubdir[subdir] += additionalSlots;
      });

      // Third pass: Distribute any leftover slots due to rounding
      let allocatedSlots = subdirs.reduce(
        (sum, subdir) => sum + slotsBySubdir[subdir],
        0,
      );
      let leftoverSlots = maxDisplay - allocatedSlots;
      let idx = 0;
      while (leftoverSlots > 0 && idx < subdirs.length) {
        const subdir = subdirs[idx];
        if (slotsBySubdir[subdir] < optionsBySubdir[subdir].length) {
          slotsBySubdir[subdir]++;
          leftoverSlots--;
        }
        idx++;
      }
    }

    // Build displayOptions, sorting within each subdirectory
    displayOptions = [];
    subdirs.forEach((subdir) => {
      const subdirOptions = optionsBySubdir[subdir]
        .sort((a, b) => getName(a).localeCompare(getName(b))) // Sort within each subdir
        .slice(0, slotsBySubdir[subdir]);
      displayOptions.push(...subdirOptions);
    });

    // Ensure we don't exceed maxDisplay
    displayOptions = displayOptions.slice(0, maxDisplay);
  }

  stdout.write(
    `\x1b[${start};${left}H\x1b[K${colors.cyan}${colors.bold}Options (${selected.length}/${available.length})${colors.reset}`,
  );

  // Number options sequentially based on display order
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
