// flowManager.ts - Flow manager implementation

import type { Flow, FlowContext, FlowInput, FlowOutput } from './types';
import {
  colors,
  promptForNumber,
  promptUser,
  copyToSystemClipboard,
} from './utils';

export interface FlowManager {
  registerFlow: (flow: Flow) => void;
  executeFlow: (flowName: string, input?: FlowInput) => Promise<FlowOutput>;
  getAvailableFlows: () => string[];
  runMainLoop: () => Promise<void>;
}
export function createFlowManager(): FlowManager {
  const flows: Record<string, Flow> = {};
  const context: FlowContext = {
    clipboard: null,
    history: [],
  };

  // Register a flow with the manager
  function registerFlow(flow: Flow): void {
    flows[flow.name] = flow;
  }

  // Get list of available flows
  function getAvailableFlows(): string[] {
    return Object.keys(flows);
  }

  // Execute a specific flow by name
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

    // Record flow execution in history
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

  // Show flow selection menu
  async function showFlowMenu(): Promise<string | null> {
    console.log(
      `\n${colors.bold}${colors.green}=== Available Flows ====${colors.reset}`,
    );

    const availableFlows = getAvailableFlows();
    availableFlows.forEach((flowName, index) => {
      const flow = flows[flowName];
      console.log(`${index + 1}. ${flow.name} - ${flow.description}`);
    });

    console.log(`${availableFlows.length + 1}. Exit`);

    const selection = await promptForNumber(
      'Select a flow to execute: ',
      1,
      availableFlows.length + 1,
    );

    if (selection === availableFlows.length + 1) {
      return null; // Exit
    }

    return availableFlows[selection - 1];
  }

  // Main loop
  async function runMainLoop(): Promise<void> {
    while (true) {
      const selectedFlow = await showFlowMenu();

      if (!selectedFlow) {
        console.log('Exiting...');
        break;
      }

      try {
        await executeFlow(selectedFlow);
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
        console.error(
          `${colors.red}Error executing flow: ${error.message}${colors.reset}`,
        );
      }
    }
  }

  return {
    registerFlow,
    executeFlow,
    getAvailableFlows,
    runMainLoop,
  };
}
