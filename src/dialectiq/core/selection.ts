// core/selection.ts
import type { SelectionContext } from '../types';
import { findMatches, canAddSelection } from './matching';

export function handleSingleSelection<T>({
  context,
  getName,
  maxSelections,
  updateState,
  render,
}: {
  context: SelectionContext<T>;
  getName: (option: T) => string;
  maxSelections: number | null;
  updateState: () => void;
  render: () => void;
}): void {
  const { currentInput, selectedOptions, availableOptions } = context;
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

export function handleRangeSelection<T>({
  context,
  maxSelections,
  updateState,
  render,
}: {
  context: SelectionContext<T>;
  maxSelections: number | null;
  updateState: () => void;
  render: () => void;
}): void {
  const { currentInput, selectedOptions, availableOptions } = context;
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

export function selectAllOptions<T>({
  context,
  updateState,
  render,
}: {
  context: SelectionContext<T>;
  updateState: () => void;
  render: () => void;
}): void {
  const { selectedOptions, availableOptions } = context;
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

export function unselectAllOptions<T>({
  context,
  updateState,
  render,
}: {
  context: SelectionContext<T>;
  updateState: () => void;
  render: () => void;
}): void {
  context.selectedOptions = [];
  context.currentInput = '';
  context.errorMessage = '';
  updateState();
  render();
}

export function handleSelectionByType<T>({
  context,
  type,
  getName,
  maxSelections,
  updateState,
  render,
  cleanup,
}: {
  context: SelectionContext<T>;
  type: string;
  getName: (option: T) => string;
  maxSelections: number | null;
  updateState: () => void;
  render: () => void;
  cleanup: () => void;
}): void {
  if (type === 'done') {
    cleanup();
  } else if (type === 'single') {
    handleSingleSelection({
      context,
      getName,
      maxSelections,
      updateState,
      render,
    });
  } else if (type === 'range') {
    handleRangeSelection({
      context,
      maxSelections,
      updateState,
      render,
    });
  } else if (type === 'selectAll') {
    selectAllOptions({
      context,
      updateState,
      render,
    });
  } else if (type === 'unselectAll') {
    unselectAllOptions({ context, updateState, render });
  }

  if (
    maxSelections !== null &&
    context.selectedOptions.length >= maxSelections
  ) {
    cleanup();
  }
}
