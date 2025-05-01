import type { SelectionContext, Transformation, Pipe } from '../types';
import { handleSelectionByType } from './selection';

export function initializeContext<T, S extends Record<string, any>>({
  options,
  state,
  transformations = [],
  pipes = [],
  commands,
  customCommands = [],
}: {
  options: T[];
  state: S;
  transformations?: Transformation[];
  pipes?: Pipe[];
  commands?: string[];
  customCommands?: string[];
}): SelectionContext<T> {
  const defaultCommands = ['single', 'selectAll', 'unselectAll', 'done'];
  const commandList = commands
    ? [...new Set([...commands, 'done'])]
    : [...new Set([...defaultCommands, ...customCommands, 'done'])];

  // Initialize selections from state, filtering for valid options
  const initialSelectedOptions = state.selections
    ? state.selections.filter((opt: T) => options.includes(opt))
    : ([] as T[]);

  // Initialize active transformations from state, filtering for valid names
  const initialActiveTransformations = state.activeTransformations
    ? state.activeTransformations.filter((name: string) =>
        transformations.some((t) => t.name === name),
      )
    : [];

  // Initialize active pipes from state, filtering for valid names
  const initialActivePipes = state.activePipes
    ? state.activePipes.filter((name: string) =>
        pipes.some((p) => p.name === name),
      )
    : [];

  return {
    currentInput: '',
    selectedOptions: initialSelectedOptions,
    availableOptions: [...options],
    errorMessage: '',
    selectionTypes: commandList as readonly string[],
    currentSelectionTypeIndex: 0,
    MAX_DISPLAY_SELECTED: 10,
    activeTransformations: initialActiveTransformations,
    availableTransformations: transformations,
    activePipes: initialActivePipes,
    availablePipes: pipes,
    inputMode: 'input',
  };
}

export function updateSelectionState<T>({
  state,
  selectedOptions,
  getName,
}: {
  state: Record<string, any>;
  selectedOptions: T[];
  getName: (option: T) => string;
}): void {
  const selectedNames = selectedOptions.map(getName);
  state['Selected'] =
    selectedNames.length === 0
      ? 'None'
      : selectedNames.length <= 10
        ? selectedNames.join('\n')
        : `${selectedNames.slice(0, 10).join('\n')}\n... and ${selectedNames.length - 10} more`;
  state['selections'] = selectedOptions;
}

export function switchInputMode<T>({
  context,
  render,
}: {
  context: SelectionContext<T>;
  render: () => void;
}): void {
  if (context.inputMode === 'input') {
    if (context.availableTransformations.length > 0) {
      context.inputMode = 'transformation';
    } else if (context.availablePipes.length > 0) {
      context.inputMode = 'pipe';
    }
  } else if (context.inputMode === 'transformation') {
    if (context.availablePipes.length > 0) {
      context.inputMode = 'pipe';
    } else {
      context.inputMode = 'input';
    }
  } else {
    context.inputMode = 'input';
  }
  context.currentInput = '';
  context.errorMessage = '';
  render();
}

export function appendInput<T>({
  context,
  char,
  render,
}: {
  context: SelectionContext<T>;
  char: string;
  render: () => void;
}): void {
  context.currentInput += char;
  context.errorMessage = '';
  render();
}

export function backspaceInput<T>({
  context,
  render,
}: {
  context: SelectionContext<T>;
  render: () => void;
}): void {
  context.currentInput = context.currentInput.slice(0, -1);
  context.errorMessage = '';
  render();
}

export function toggleTransformation<T>({
  context,
  transformationIndex,
  render,
}: {
  context: SelectionContext<T>;
  transformationIndex: number;
  render: () => void;
}): void {
  const transformation = context.availableTransformations[transformationIndex];
  if (!transformation) {
    context.errorMessage = `Invalid transformation index: ${transformationIndex + 1}`;
    render();
    return;
  }

  const name = transformation.name;
  const index = context.activeTransformations.indexOf(name);

  if (index === -1) {
    context.activeTransformations.push(name);
  } else {
    context.activeTransformations.splice(index, 1);
  }

  context.errorMessage = '';
  render();
}

export function togglePipe<T>({
  context,
  pipeIndex,
  render,
}: {
  context: SelectionContext<T>;
  pipeIndex: number;
  render: () => void;
}): void {
  const pipe = context.availablePipes[pipeIndex];
  if (!pipe) {
    context.errorMessage = `Invalid pipe index: ${pipeIndex + 1}`;
    render();
    return;
  }

  const name = pipe.name;
  const index = context.activePipes.indexOf(name);

  if (index === -1) {
    context.activePipes.push(name);
  } else {
    context.activePipes.splice(index, 1);
  }

  context.errorMessage = '';
  render();
}

export function handleSelection<T>({
  context,
  input,
  getName,
  maxSelections,
  updateState,
  render,
  cleanup,
}: {
  context: SelectionContext<T>;
  input: string;
  getName: (option: T) => string;
  maxSelections: number | null;
  updateState: () => void;
  render: () => void;
  cleanup: () => void;
}): void {
  const type = context.selectionTypes[context.currentSelectionTypeIndex];
  context.currentInput = input;
  if (type === 'done') {
    cleanup();
  } else {
    handleSelectionByType({
      context,
      type,
      getName,
      maxSelections,
      updateState,
      render,
      cleanup,
    });
  }
}

export function executeCommand<T>({
  context,
  getName,
  maxSelections,
  updateState,
  render,
  cleanup,
}: {
  context: SelectionContext<T>;
  getName: (option: T) => string;
  maxSelections: number | null;
  updateState: () => void;
  render: () => void;
  cleanup: () => void;
}): void {
  const { currentInput, selectionTypes, inputMode } = context;

  if (inputMode === 'input') {
    handleSelection({
      context,
      input: currentInput,
      getName,
      maxSelections,
      updateState,
      render,
      cleanup,
    });
    context.currentInput = '';
  } else if (inputMode === 'transformation') {
    if (currentInput) {
      const lowerInput = currentInput.toLowerCase();
      const matchIndex = context.availableTransformations.findIndex((t) =>
        t.name.toLowerCase().includes(lowerInput),
      );
      if (matchIndex !== -1) {
        toggleTransformation({
          context,
          transformationIndex: matchIndex,
          render,
        });
        context.inputMode = 'input';
        context.currentInput = '';
      } else {
        context.errorMessage = 'No matching transformation found';
      }
    } else {
      context.errorMessage = 'Enter a transformation name to select';
    }
    render();
  } else if (inputMode === 'pipe') {
    if (currentInput) {
      const lowerInput = currentInput.toLowerCase();
      const matchIndex = context.availablePipes.findIndex((p) =>
        p.name.toLowerCase().includes(lowerInput),
      );
      if (matchIndex !== -1) {
        togglePipe({
          context,
          pipeIndex: matchIndex,
          render,
        });
        context.inputMode = 'input';
        context.currentInput = '';
      } else {
        context.errorMessage = 'No matching pipe found';
      }
    } else {
      context.errorMessage = 'Enter a pipe name to select';
    }
    render();
  }
}
