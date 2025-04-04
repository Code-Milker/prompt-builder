#!/usr/bin/env bun

import { createFlowManager } from "./cli.be.manager";
import { createFileSelectionFlow } from "./cli.do.file";
import { createTextProcessingFlow } from "./cli.do.text";

async function main() {
  // Create flow manager
  const flowManager = createFlowManager();
  flowManager.registerFlow(createFileSelectionFlow());
  flowManager.registerFlow(createTextProcessingFlow());

  // Start the main loop
  await flowManager.runMainLoop();
}

main().catch((err) => {
  console.error('Error in main process:', err);
  process.exit(1);
});
