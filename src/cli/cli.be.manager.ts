// flowManager.ts - Flow manager implementation

import type { Flow, FlowContext, FlowInput, FlowOutput } from './cli.use.types';
import {
  colors,
  promptForNumber,
  promptUser,
  copyToSystemClipboard,
  selectOption, // Import the enhanced selectOption function
} from './cli.use.utils';

/** Interface defining the FlowManager's methods */
export interface FlowManager {
  registerFlow: (flow: Flow) => void;
  executeFlow: (flowName: string, input?: FlowInput) => Promise<FlowOutput>;
  getAvailableFlows: () => string[];
  runMainLoop: () => Promise<void>;
}

/** Creates and returns a FlowManager instance */
export function createFlowManager(): FlowManager {
  const flows: Record<string, Flow> = {};
  const context: FlowContext = {
    clipboard: null,
    history: [],
  };
  const terminalHistory: string[] = []; // Array to store terminal history for display

  // --- Core Functions ---

  /** Registers a new flow with the manager */
  function registerFlow(flow: Flow): void {
    flows[flow.name] = flow;
  }

  /** Returns an array of all registered flow names */
  function getAvailableFlows(): string[] {
    return Object.keys(flows);
  }

  /** Executes a flow by name with optional input */
  async function executeFlow(
    flowName: string,
    input?: FlowInput,
  ): Promise<FlowOutput> {
    if (!flows[flowName]) {
      throw new Error(`Flow '${flowName}' not found`);
    }

    const flow = flows[flowName];
    console.log(
      `\n${colors.bold}${colors.cyan}Executing flow: ${flow.name} - ${flow.description}${colors.reset}\n`,
    );

    const flowInput = input || context.clipboard;
    const output = await flow.execute(flowInput);

    // Record flow execution in context history
    context.history.push({
      flowName,
      input: flowInput,
      output,
      timestamp: new Date(),
    });

    // Store output in clipboard for potential next flow
    context.clipboard = output;

    return output;
  }

  // --- Interactive Flow Selection ---

  /** Allows interactive selection of a flow with enhanced UI */
  async function selectFlow(): Promise<string | null> {
    const allFlows = getAvailableFlows().map((name) => flows[name]);
    const selectedFlow = await selectOption(
      allFlows,
      (flow) => flow.name,
      (flow, input) => {
        const prefix = flow.name.slice(0, input.length);
        const suffix = flow.name.slice(input.length);
        return `${colors.cyan}${prefix}${colors.reset}${suffix} - ${flow.description}`;
      },
      terminalHistory,
      'Select a flow:',
    );
    return selectedFlow ? selectedFlow.name : null;
  }

  // --- Main Loop ---

  /** Runs the main interactive loop of the flow manager */
  async function runMainLoop(): Promise<void> {
    while (true) {
      const selectedFlow = await selectFlow();

      if (!selectedFlow) {
        console.log('Exiting...');
        break;
      }

      try {
        await executeFlow(selectedFlow);
        terminalHistory.push(`Executed flow: ${selectedFlow}`);
        if (context.clipboard) {
          terminalHistory.push(
            `Output: ${context.clipboard.toString().slice(0, 100)}...`,
          );
        }
        console.log(
          `\n${colors.green}Flow completed successfully.${colors.reset}`,
        );

        // Ask if user wants to copy output to system clipboard
        if (context.clipboard) {
          const copyChoice = await promptUser(
            'Copy output to system clipboard? (y/n): ',
          );
          if (copyChoice.toLowerCase() === 'y') {
            if (typeof context.clipboard === 'string') {
              await copyToSystemClipboard(context.clipboard);
            } else {
              await copyToSystemClipboard(
                JSON.stringify(context.clipboard, null, 2),
              );
            }
            console.log('Output copied to clipboard.');
          }
        }
      } catch (error) {
        terminalHistory.push(`Error: ${error.message}`);
        console.error(
          `${colors.red}Error executing flow: ${error.message}${colors.reset}`,
        );
      }
    }
  }

  // Return the FlowManager instance
  return {
    registerFlow,
    executeFlow,
    getAvailableFlows,
    runMainLoop,
  };
}
