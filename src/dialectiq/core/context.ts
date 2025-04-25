// core/context.ts

import type { SelectionContext } from '../types';

export function initializeContext<T, S extends Record<string, any>>({
  options,
  state,
}: {
  options: T[];
  state: S;
}): SelectionContext<T> {
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
