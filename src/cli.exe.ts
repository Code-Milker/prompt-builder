#!/usr/bin/env bun

import { createFlowManager } from './cli.be.manager';
import { createFileSelectionFlow } from './cli.do.file';
import { createLightControlFlow } from './cli.do.light';
import { createTextProcessingFlow } from './cli.do.text';

async function main() {
  const flowManager = createFlowManager();
  flowManager.registerFlow(createFileSelectionFlow());
  flowManager.registerFlow(createTextProcessingFlow());
  flowManager.registerFlow(createLightControlFlow()); // Register lights flow

  await flowManager.runMainLoop();
}

main().catch((err) => {
  console.error('Error in main process:', err);
  process.exit(1);
});
