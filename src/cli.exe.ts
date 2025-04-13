#!/usr/bin/env bun

import { createFlowManager } from './cli.be.manager';
import { createFileSelectionFlow } from './cli.do.file';
import { createLightControlFlow } from './cli.do.light';
import { createTextProcessingFlow } from './cli.do.text';
import { createLLMAgentFlow } from './cli.be.llm'; // Add this import

async function main() {
  const flowManager = createFlowManager();
  flowManager.registerFlow(createFileSelectionFlow());
  flowManager.registerFlow(createTextProcessingFlow());
  flowManager.registerFlow(createLightControlFlow());
  flowManager.registerFlow(createLLMAgentFlow()); // Register the LLM agent flow

  await flowManager.runMainLoop();
}

main().catch((err) => {
  console.error('Error in main process:', err);
  process.exit(1);
});
