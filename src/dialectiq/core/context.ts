// core/context.ts

import type { SelectionContext, Transformation } from '../types';

export function initializeContext<T, S extends Record<string, any>>({
  options,
  state,
  transformations = [],
  customCommands = [],
}: {
  options: T[];
  state: S;
  transformations?: Transformation[];
  customCommands?: string[];
}): SelectionContext<T> {
  const defaultCommands = [
    'single',
    'range',
    'selectAll',
    'unselectAll',
    'done',
  ];
  const commands = [...defaultCommands, ...customCommands];

  return {
    currentInput: '',
    selectedOptions: state.selections ? [...state.selections] : ([] as T[]),
    availableOptions: [...options],
    errorMessage: '',
    selectionTypes: commands as readonly string[],
    currentSelectionTypeIndex: 0,
    MAX_DISPLAY_SELECTED: 10,
    activeTransformations: [],
    availableTransformations: transformations,
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

export function switchSelectionType<T>({
  context,
  render,
}: {
  context: SelectionContext<T>;
  render: () => void;
}): void {
  context.currentSelectionTypeIndex =
    (context.currentSelectionTypeIndex + 1) % context.selectionTypes.length;
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

// New function to handle transformation toggling
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
