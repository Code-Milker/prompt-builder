// index.ts
import { stdin } from 'process';
import { initializeContext, updateSelectionState } from './core/context';
import { setupTerminal, cleanupTerminal, handleInput } from './terminal';
import { renderInterface } from './ui/renderer';
import { defaultDisplay } from './core/matching';
import type {
  SelectionContext,
  SelectOptionParams,
  SelectOptionReturn,
} from './types';
import { sendToOllama } from '../llm/ollama';
import { sendToGroq } from '../llm/groq';

export async function selectOption3<T, S extends Record<string, any>>({
  options,
  getName,
  display,
  history,
  state,
  maxDisplay,
  maxSelections = null,
  transformations = [],
  pipes = [],
  commands,
  customCommands = [],
}: SelectOptionParams<T, S>): Promise<SelectOptionReturn<T, S>> {
  return new Promise((resolve) => {
    const displayFn =
      display ||
      ((option: T, input: string) =>
        defaultDisplay({ option, input, getName }));

    const defaultPipes = [
      {
        name: 'Ask Ollama',
        description: 'Send context to Ollama LLM',
        apply: async <U>(
          context: SelectionContext<U>,
          state: Record<string, any>,
          getName: (option: U) => string,
        ) => {
          const contextString = JSON.stringify(
            {
              selectedDirectory: state['Selected Directory'],
              selections: context.selectedOptions.map(getName),
              transformations: state.transformations,
            },
            null,
            2,
          );
          try {
            return await sendToOllama(
              [
                {
                  role: 'system',
                  content:
                    'You are a helpful AI assistant. Analyze the provided context and provide a response.',
                },
                { role: 'user', content: contextString },
              ],
              { taskType: 'general' },
            );
          } catch (error) {
            return `Error: ${error.message}`;
          }
        },
      },
      {
        name: 'Ask Groq',
        description: 'Send context to Groq LLM',
        apply: async <U>(
          context: SelectionContext<U>,
          state: Record<string, any>,
          getName: (option: U) => string,
        ) => {
          const contextString = JSON.stringify(
            {
              selectedDirectory: state['Selected Directory'],
              selections: context.selectedOptions.map(getName),
              transformations: state.transformations,
            },
            null,
            2,
          );
          try {
            return await sendToGroq(
              [
                {
                  role: 'system',
                  content:
                    'You are a helpful AI assistant. Analyze the provided context and provide a response.',
                },
                { role: 'user', content: contextString },
              ],
              { taskType: 'general' },
            );
          } catch (error) {
            return `Error: ${error.message}`;
          }
        },
      },
    ];

    const context = initializeContext({
      options,
      state,
      transformations,
      pipes: pipes.length > 0 ? pipes : defaultPipes,
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
