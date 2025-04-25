#!/usr/bin/env bun

import { createFlowManager } from './manager';
import { createFileSelectionFlow } from './files';
import { createLightControlFlow } from './lights';
import { createTextProcessingFlow } from './text/text';
import { createLLMAgentFlow } from './llm/llm'; // Add this import

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
