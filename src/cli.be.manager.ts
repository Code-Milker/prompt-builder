// cli.be.manager.ts - Flow manager implementation
import type { Flow, FlowContext, FlowInput, FlowOutput } from './cli.use.types';
import { colors, selectOption, copyToSystemClipboard } from './cli.use.utils';
import * as readline from 'node:readline';

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

  // --- Utility Function ---

  /** Prompts the user for input */
  async function promptUser(question: string): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

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

  /** Allows interactive selection of flows with enhanced UI */
  async function selectFlows(): Promise<string[]> {
    const allFlows = getAvailableFlows().map((name) => flows[name]);
    const selectedFlows = await selectOption(
      allFlows,
      (flow) => flow.name,
      (flow, input) => {
        const name = flow.name;
        const lowerName = name.toLowerCase();
        const lowerInput = input.toLowerCase();
        const matchIndex = lowerName.indexOf(lowerInput);
        if (matchIndex !== -1 && input.length > 0) {
          const prefix = name.slice(0, matchIndex);
          const match = name.slice(matchIndex, matchIndex + input.length);
          const suffix = name.slice(matchIndex + input.length);
          return `${prefix}${colors.cyan}${match}${colors.reset}${suffix} - ${flow.description}`;
        }
        return `${name} - ${flow.description}`;
      },
      terminalHistory,
    );
    return selectedFlows
      .map((flow) => flow.name)
      .filter((name) => name !== '[Execute Selected Flows]');
  }

  // --- Main Loop ---

  /** Runs the main interactive loop of the flow manager */
  async function runMainLoop(): Promise<void> {
    while (true) {
      const selectedFlowNames = await selectFlows();
      if (selectedFlowNames.length === 0) {
        console.log('Exiting...');
        break;
      }

      // Execute the selected flows
      for (const flowName of selectedFlowNames) {
        try {
          await executeFlow(flowName);
          terminalHistory.push(`Executed flow: ${flowName}`);
          if (context.clipboard) {
            terminalHistory.push(
              `Output: ${context.clipboard.toString().slice(0, 100)}...`,
            );
          }
          console.log(
            `\n${colors.green}Flow completed successfully.${colors.reset}`,
          );

          await copyToSystemClipboard(context.clipboard);
        } catch (error) {
          terminalHistory.push(`Error: ${error.message}`);
          console.error(
            `${colors.red}Error executing flow: ${error.message}${colors.reset}`,
          );
        }
      }

      // Prompt to continue or exit
      // const continueChoice = await promptUser(
      //   'Continue selecting flows? (y/n): ',
      // );
      // if (continueChoice.toLowerCase() !== 'y') {
      console.log('Exiting...');
      break;
      // }
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
