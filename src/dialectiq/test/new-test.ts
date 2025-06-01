import fs from 'fs/promises';
import path from 'path';
import { selectOption3 } from '../index';
import { transformations } from '../../transformations';

async function main() {
  const files = ['file1.ts', 'file2.ts', 'file3.js'];

  const result = await selectOption3({
    options: files,
    getName: (file) => file,
    history: ['Previous selections here...'],
    state: { currentDirectory: '/Users/tylerfischer/Projects/prompt-builder' },
    transformations,
    customCommands: ['done'],
  });

  console.log('log41388:', JSON.stringify(result, null, 2));
}

main();