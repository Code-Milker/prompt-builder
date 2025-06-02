import type { SelectionContext, Transformation, Pipe } from '../types';
import { handleSelectionByType } from './selection';
import { canAddSelection, findMatches } from './matching'; // Added findMatches and canAddSelection
import * as fs from 'fs';
import * as path from 'path';

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

  const initialSelectedOptions = state.selections
    ? state.selections.filter((opt: T) =>
        options.some(
          (availableOpt) =>
            JSON.stringify(availableOpt) === JSON.stringify(opt),
        ),
      ) // Basic check for inclusion, might need better `getName` based comparison
    : ([] as T[]);

  const initialActiveTransformations = state.activeTransformations
    ? state.activeTransformations.filter((name: string) =>
        transformations.some((t) => t.name === name),
      )
    : [];

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
  const currentMode = context.inputMode;
  let nextMode: SelectionContext<T>['inputMode'] = 'input';

  if (currentMode === 'input') {
    if (context.availableTransformations.length > 0) {
      nextMode = 'transformation';
    } else if (context.availablePipes.length > 0) {
      nextMode = 'pipe';
    } else {
      nextMode = 'paste';
    }
  } else if (currentMode === 'transformation') {
    if (context.availablePipes.length > 0) {
      nextMode = 'pipe';
    } else {
      nextMode = 'paste';
    }
  } else if (currentMode === 'pipe') {
    nextMode = 'paste';
  } else if (currentMode === 'paste') {
    nextMode = 'input';
  }

  context.inputMode = nextMode;
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
      const transformation = context.availableTransformations.find((t) =>
        t.name.toLowerCase().includes(lowerInput),
      );
      if (transformation) {
        const index = context.availableTransformations.indexOf(transformation);
        toggleTransformation({ context, transformationIndex: index, render });
      } else {
        context.errorMessage = 'No matching transformation found.';
      }
    }
    context.currentInput = '';
    render();
  } else if (inputMode === 'pipe') {
    if (currentInput) {
      const lowerInput = currentInput.toLowerCase();
      const pipe = context.availablePipes.find((p) =>
        p.name.toLowerCase().includes(lowerInput),
      );
      if (pipe) {
        const index = context.availablePipes.indexOf(pipe);
        togglePipe({ context, pipeIndex: index, render });
      } else {
        context.errorMessage = 'No matching pipe found.';
      }
    }
    context.currentInput = '';
    render();
  } else if (inputMode === 'paste') {
    if (context.currentInput.trim() !== '') {
      try {
        const pasteDir = './dialectiq_pastes';
        if (!fs.existsSync(pasteDir)) {
          fs.mkdirSync(pasteDir, { recursive: true });
        }
        const filePath = path.join(
          pasteDir,
          `pasted_content_${Date.now()}.txt`,
        );
        fs.writeFileSync(filePath, context.currentInput);

        // This assumes T can be a string (filepath).
        // If T is a complex object, you'll need to construct an instance of T here
        // which includes the filePath or content. For example:
        // const newFileOption = { path: filePath, name: path.basename(filePath) } as unknown as T;
        // For simplicity, assuming T is string (filePath):
        const newFileOption = filePath as unknown as T;

        // Add to available options if not already present (using getName for comparison)
        // This check might be simplified if T is always string and getName is identity
        const newFileOptionName = getName(newFileOption);
        if (
          !context.availableOptions.find(
            (opt) => getName(opt) === newFileOptionName,
          )
        ) {
          context.availableOptions.push(newFileOption);
        }

        if (
          canAddSelection({
            selectedOptions: context.selectedOptions,
            maxSelections,
          })
        ) {
          if (
            !context.selectedOptions.find(
              (opt) => getName(opt) === newFileOptionName,
            )
          ) {
            context.selectedOptions.push(newFileOption);
          }
          context.currentInput = '';
          context.errorMessage = '';
          context.inputMode = 'input'; // Switch back to input mode
        } else {
          context.errorMessage =
            'Pasted file created but not selected: limit reached or already selected.';
        }
      } catch (e: any) {
        const err = e as Error;
        context.errorMessage = `Error creating file: ${err.message}`;
      }
    } else {
      context.errorMessage = 'No content to paste.';
    }
    // Clear input if it was only whitespace and resulted in "No content to paste"
    if (
      context.currentInput.trim() === '' &&
      context.errorMessage === 'No content to paste.'
    ) {
      context.currentInput = '';
    }
    updateState();
    render();
  }
}
