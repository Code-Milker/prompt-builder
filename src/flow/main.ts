#!/usr/bin/env bun
// index.ts - Main CLI driver

import { createFlowManager } from './flow-manager';
import { createFileSelectionFlow } from './file-selection-flow';
import { createTextProcessingFlow } from './text-processing-flow';

async function main() {
  // Create flow manager
  const flowManager = createFlowManager();

  // Register flows
  flowManager.registerFlow(createFileSelectionFlow());
  flowManager.registerFlow(createTextProcessingFlow());

  // Add more flows here by importing and registering them

  // Start the main loop
  await flowManager.runMainLoop();
}

main().catch((err) => {
  console.error('Error in main process:', err);
  process.exit(1);
});
