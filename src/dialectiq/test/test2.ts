import fs from 'fs';
import path from 'path';
import type { SelectOptionReturn } from '../types';
import { selectOption3 } from '../index';
import { transformations } from '../../transformations';

// Recursively fetch files from a directory and its subdirectories, then select files
export async function selectFilesRecursively(
  projectsDir: string,
): Promise<SelectOptionReturn<string, Record<string, any>>> {
  // Recursively fetch files from the projects directory
  const blacklistedDirs = new Set([
    'node_modules',
    '.git',
    '.DS_Store',
    'logs',
  ]);
  async function getFilesRecursively(dir: string): Promise<string[]> {
    let files: string[] = [];
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile() && !entry.name.startsWith('.')) {
          files.push(fullPath);
        } else if (
          entry.isDirectory() &&
          !entry.name.startsWith('.') &&
          !blacklistedDirs.has(entry.name)
        ) {
          const subFiles = await getFilesRecursively(fullPath);
          files = files.concat(subFiles);
        }
      }
    } catch (error) {
      // Ignore errors for individual directories (e.g., permission denied)
    }
    return files;
  }

  const files = await getFilesRecursively(projectsDir);
  if (files.length === 0) {
    return {
      'Selected Directory': projectsDir,
      selections: [],
      Selected: 'None',
      transformations: {},
    };
  }

  // Select files from the directory with transformations
  const fileState = await selectOption3({
    options: files,
    getName: (file) => path.relative(projectsDir, file), // Relative paths for UI
    history: [
      'Select files from the directory (use Tab to change selection mode, Enter to confirm).',
    ],
    state: {
      'Selected Directory': projectsDir,
      selections: [],
    },
    maxSelections: 10,
    transformations: transformations,
    customCommands: ['customCommands'],
  });

  // Resolve all transformation promises
  const resolvedTransformations: Record<string, any> = {};
  for (const [name, result] of Object.entries(fileState.transformations)) {
    resolvedTransformations[name] = await result; // Await Promise to get resolved value
  }

  const resolvedFileState: SelectOptionReturn<string, Record<string, any>> = {
    ...fileState,
    transformations: resolvedTransformations,
  };

  return resolvedFileState; // Return full fileState with resolved transformations
}

const projectsDir = path.join(
  process.env.HOME || process.env.USERPROFILE,
  'Projects',
);

// Ensure logs directory exists
const projectRoot = path.resolve(__dirname, '../../..'); // From src/dialectiq/test to project root
const logsDir = path.join(projectRoot, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Write output to logs
selectFilesRecursively(projectsDir)
  .then((response) => {
    // Generate unique filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonLogFile = path.join(logsDir, `select-option-${timestamp}.json`);
    const markdownLogFile = path.join(logsDir, `select-option-${timestamp}.md`);

    // Write full response as JSON
    fs.writeFileSync(jsonLogFile, JSON.stringify(response, null, 2), 'utf-8');
    console.log(`Wrote full output to ${jsonLogFile}`);

    // Write to-markdown output if available
    if (response.transformations['to-markdown']) {
      fs.writeFileSync(
        markdownLogFile,
        response.transformations['to-markdown'],
        'utf-8',
      );
      console.log(`Wrote to-markdown output to ${markdownLogFile}`);
      console.log(response.transformations['to-markdown']);
    } else {
      console.log('No to-markdown output available');
    }
  })
  .catch((error) => {
    console.error('Error in selectFilesRecursively:', error);
  });
