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
  commands,
  customCommands = [],
}: SelectOptionParams<T, S>): Promise<SelectOptionReturn<T, S>> {
  return new Promise((resolve) => {
    const displayFn =
      display ||
      ((option: T, input: string) =>
        defaultDisplay({ option, input, getName }));

    const context = initializeContext({
      options,
      state,
      transformations,
      commands,
      customCommands,
    });

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

    const cleanup = async () => {
      await cleanupTerminal({
        resolve,
        state,
        context,
        getName,
      });
    };

    setupTerminal();
    updateState();
    render();

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
