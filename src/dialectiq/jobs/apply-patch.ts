//example usage
//cat << 'EOF' > /Users/tylerfischer/Projects/prompt-builder/temp-patch.txt && bun /Users/tylerfischer/Projects/prompt-builder/src/dialectiq/jobs/apply-patch.ts --base-dir /Users/tylerfischer/Projects/prompt-builder --input /Users/tylerfischer/Projects/prompt-builder/temp-patch.txt && rm /Users/tylerfischer/Projects/prompt-builder/temp-patch.txt
// # src/dialectiq/test/new-test.ts
// import fs from 'fs/promises';
// import path from 'path';
// import { selectOption3 } from '../index';
// import { transformations } from '../../transformations';
//
// async function main() {
//   const files = ['file1.ts', 'file2.ts', 'file3.js'];
//
//   const result = await selectOption3({
//     options: files,
//     getName: (file) => file,
//     history: ['Previous selections here...'],
//     state: { currentDirectory: '/Users/tylerfischer/Projects/prompt-builder' },
//     transformations,
//     customCommands: ['done'],
//   });
//
//   console.log('log41388:', JSON.stringify(result, null, 2));
// }
//
// main();
//
// # src/dialectiq/test/test.ts
// import fs from 'fs/promises';
// import path from 'path';
// import { selectOption3 } from '../index';
// import { transformations } from '../../transformations';
//
// async function main() {
//   const files = ['file1.ts', 'file2.ts', 'file3.js'];
//
//   const result = await selectOption3({
//     options: files,
//     getName: (file) => file,
//     history: ['Previous selections here...'],
//     state: { currentDirectory: '/Users/tylerfischer/Projects/prompt-builder' },
//     transformations,
//     customCommands: ['done'],
//   });
//
//   console.log('log41388:', JSON.stringify(result, null, 2));
// }
//
// main();
// EOF
import fs from 'fs/promises';
import path from 'path';
import { diffLines } from 'diff';
import readline from 'readline';

interface FileChange {
  path: string;
  content: string;
}

async function parsePatchContent(patchContent: string): Promise<FileChange[]> {
  const lines = patchContent.split('\n');
  const fileChanges: FileChange[] = [];
  let currentPath: string | null = null;
  let currentContent: string[] = [];

  for (const line of lines) {
    if (line.startsWith('# ')) {
      if (currentPath) {
        fileChanges.push({
          path: currentPath,
          content: currentContent.join('\n').trim(),
        });
      }
      currentPath = line.slice(2).trim();
      currentContent = [];
    } else if (currentPath) {
      currentContent.push(line);
    }
  }

  if (currentPath) {
    fileChanges.push({
      path: currentPath,
      content: currentContent.join('\n').trim(),
    });
  }

  return fileChanges;
}

async function showBeforeAfter(
  fileChanges: FileChange[],
  baseDir: string,
): Promise<void> {
  for (const change of fileChanges) {
    const fullPath = path.join(baseDir, change.path);
    let existingContent = '';
    let fileExists = true;
    try {
      existingContent = await fs.readFile(fullPath, 'utf-8');
    } catch {
      existingContent = '';
      fileExists = false;
    }

    if (existingContent === change.content) {
      console.log(`\nNo changes for ${change.path}`);
      continue;
    }

    console.log(`\nChanges for ${change.path}:`);

    // Compute the diff using diffLines
    const diff = diffLines(existingContent, change.content, {
      newlineIsToken: true,
    });

    // Prepare "Before" section (highlight removed lines in red)
    console.log('\nBefore:');
    console.log('-------');
    let beforeLines: string[] = [];
    if (!fileExists) {
      beforeLines.push('[New file - does not exist]');
    } else {
      diff.forEach((part) => {
        const lines = part.value.split('\n').filter((line) => line !== '');
        if (part.removed) {
          // Highlight removed lines in red
          lines.forEach((line) => beforeLines.push(`\x1b[31m${line}\x1b[0m`));
        } else if (!part.added) {
          // Unchanged lines in neutral color
          lines.forEach((line) => beforeLines.push(line));
        }
      });
    }
    console.log(beforeLines.length ? beforeLines.join('\n') : '[Empty file]');
    console.log('-------');

    // Prepare "After" section (highlight added lines in green)
    console.log('\nAfter:');
    console.log('------');
    let afterLines: string[] = [];
    diff.forEach((part) => {
      const lines = part.value.split('\n').filter((line) => line !== '');
      if (part.added) {
        // Highlight added lines in green
        lines.forEach((line) => afterLines.push(`\x1b[32m${line}\x1b[0m`));
      } else if (!part.removed) {
        // Unchanged lines in neutral color
        lines.forEach((line) => afterLines.push(line));
      }
    });
    console.log(afterLines.join('\n'));
    console.log('------');
  }
}

async function applyPatch({
  patchContent,
  baseDir,
  showDiffOnly = false,
}: {
  patchContent: string;
  baseDir: string;
  showDiffOnly?: boolean;
}): Promise<void> {
  try {
    const fileChanges = await parsePatchContent(patchContent);

    if (fileChanges.length === 0) {
      console.log('No file changes found in patch content.');
      return;
    }

    if (showDiffOnly) {
      await showBeforeAfter(fileChanges, baseDir);
      return;
    }

    await showBeforeAfter(fileChanges, baseDir);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question(
        '\nDo you want to apply these changes? (y/n): ',
        (response) => {
          resolve(response);
          rl.close();
        },
      );
    });

    if (answer.toLowerCase() !== 'y') {
      console.log('Changes not applied.');
      return;
    }

    for (const change of fileChanges) {
      const fullPath = path.join(baseDir, change.path);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, change.content, 'utf-8');
      console.log(`Updated ${fullPath}`);
    }

    console.log('Patch applied successfully.');
  } catch (error) {
    console.error('Error applying patch:', error.message);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  let patchFilePath: string | undefined;
  let baseDir: string | undefined;
  let showDiffOnly = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && i + 1 < args.length) {
      patchFilePath = args[i + 1];
      i++;
    } else if (args[i] === '--base-dir' && i + 1 < args.length) {
      baseDir = args[i + 1];
      i++;
    } else if (args[i] === '--diff') {
      showDiffOnly = true;
    }
  }

  if (!baseDir || !patchFilePath) {
    console.error(
      'Usage: bun apply-patch.ts --base-dir <base-directory> --input <patch-file-path> [--diff]',
    );
    process.exit(1);
  }

  try {
    const patchContent = await fs.readFile(patchFilePath, 'utf-8');
    await applyPatch({ patchContent, baseDir, showDiffOnly });
  } catch (error) {
    console.error('Error in main:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { applyPatch, parsePatchContent };
