// core/context.ts
import type { SelectionContext, Transformation } from '../types';
import { handleSelectionByType } from './selection';

export function initializeContext<T, S extends Record<string, any>>({
  options,
  state,
  transformations = [],
  commands,
  customCommands = [],
}: {
  options: T[];
  state: S;
  transformations?: Transformation[];
  commands?: string[];
  customCommands?: string[];
}): SelectionContext<T> {
  const defaultCommands = ['single', 'selectAll', 'unselectAll', 'done']; // Exclude 'range'
  const commandList = commands
    ? [...new Set([...commands, 'done'])] // Ensure 'done' is included
    : [...new Set([...defaultCommands, ...customCommands, 'done'])]; // Fallback with customCommands

  return {
    currentInput: '',
    selectedOptions: state.selections ? [...state.selections] : ([] as T[]),
    availableOptions: [...options],
    errorMessage: '',
    selectionTypes: commandList as readonly string[],
    currentSelectionTypeIndex: 0,
    MAX_DISPLAY_SELECTED: 10,
    activeTransformations: [],
    availableTransformations: transformations,
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
    context.inputMode = 'command';
  } else if (context.inputMode === 'command') {
    context.inputMode =
      context.availableTransformations.length > 0 ? 'transformation' : 'input';
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
  } else if (inputMode === 'command') {
    if (currentInput) {
      const lowerInput = currentInput.toLowerCase();
      let bestMatchIndex = -1;
      let maxOverlap = -1;

      selectionTypes.forEach((type, idx) => {
        const displayText =
          type === 'done' ? 'done' : type === 'single' ? 'select first' : type;
        const lowerType = displayText.toLowerCase();
        let overlap = 0;
        for (
          let i = 0;
          i < Math.min(lowerType.length, lowerInput.length);
          i++
        ) {
          if (lowerType[i] === lowerInput[i]) {
            overlap++;
          } else {
            break;
          }
        }
        if (overlap > maxOverlap && lowerType.includes(lowerInput)) {
          maxOverlap = overlap;
          bestMatchIndex = idx;
        }
      });

      if (bestMatchIndex !== -1) {
        context.currentSelectionTypeIndex = bestMatchIndex;
        context.currentInput = '';
        context.inputMode = 'input';
        render();
      } else {
        context.errorMessage =
          'No matching command found. Press Tab to switch to input mode.';
        render();
      }
    } else {
      const type = selectionTypes[context.currentSelectionTypeIndex];
      context.currentInput = '';
      context.inputMode = 'input';
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
  }
}
