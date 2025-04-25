// index.ts
import { stdin } from 'process';
import { initializeContext, updateSelectionState } from './core/context';
import { setupTerminal, cleanupTerminal, handleInput } from './terminal';
import { renderInterface } from './ui/renderer';
import { defaultDisplay } from './core/matching';
import type { SelectOptionParams, SelectOptionReturn } from './types';

export async function selectOption3<T, S extends Record<string, any>>({
  options,
  getName,
  display,
  history,
  state,
  maxDisplay,
  maxSelections = null,
  transformations = [],
  customCommands = [],
}: SelectOptionParams<T, S>): Promise<SelectOptionReturn<T, S>> {
  return new Promise((resolve) => {
    // Initialize
    const displayFn =
      display ||
      ((option: T, input: string) =>
        defaultDisplay({ option, input, getName }));

    const context = initializeContext({
      options,
      state,
      transformations,
      customCommands,
    });

    // Setup functions
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

    const cleanup = () =>
      cleanupTerminal({
        resolve,
        state,
        context,
        getName,
      });

    // Setup terminal and initial render
    setupTerminal();
    updateState();
    render();

    // Handle input
    stdin.on('data', (data) =>
      handleInput({
        data: data.toString(),
        context,
        getName,
        maxSelections,
        updateState,
        render,
        cleanup,
      }),
    );
  });
}
