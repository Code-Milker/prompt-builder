#!/usr/bin/env bun

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

// Step 1: Declare the Zod type for user input
const InputSchema = z.object({
  filePath: z.string().nonempty('File path is required'),
  selectedText: z.string().optional().default(''), // Allow empty string if no selection
});

// Step 2: Parse user input
async function parseInput(): Promise<z.infer<typeof InputSchema>> {
  // Get file path from command-line argument
  const filePath = process.argv[2];

  // Read selected text from stdin
  const selectedText = await new Promise<string>((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data.trim()));
  });

  // Parse and validate with Zod
  try {
    return InputSchema.parse({ filePath, selectedText });
  } catch (err) {
    console.error(
      'Invalid input:',
      err instanceof z.ZodError ? err.errors : err,
    );
    process.exit(1);
  }
}

// Step 3: Execute user flow (helper functions)
async function getProjectRoot(currentPath: string): Promise<string> {
  let dir = path.dirname(currentPath);
  while (dir !== '/') {
    try {
      await fs.access(path.join(dir, '.git'));
      return dir;
    } catch {
      dir = path.dirname(dir);
    }
  }
  throw new Error('Project root not found (no .git directory)');
}

async function generateTree(dir: string, prefix: string = ''): Promise<string> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let result = '';
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    result += `${prefix}${entry.name}\n`;
    if (entry.isDirectory()) {
      result += await generateTree(path.join(dir, entry.name), prefix + '  ');
    }
  }
  return result;
}

async function executeFlow(input: z.infer<typeof InputSchema>) {
  const { filePath, selectedText } = input;

  // Determine project root and generate tree
  const projectRoot = await getProjectRoot(filePath);
  const tree = await generateTree(projectRoot);
  const relativePath = path.relative(projectRoot, filePath);

  // Format the prompt
  const prompt = `
Project structure:
${tree}
File path: ${relativePath}
Selected code:
${selectedText}
`.trim();

  return prompt;
}

// Step 4: Main function to run the script and return data
async function main() {
  try {
    const input = await parseInput();
    const result = await executeFlow(input);
    console.log(result); // Return data to stdout
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
