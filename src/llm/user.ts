import { promptUser } from '../utils';
import fs from 'fs'; // For synchronous fs.readFileSync
import path from 'path';
import { selectOption3 } from '../dialectiq/index';
import type { SelectOptionReturn, Transformation } from '../dialectiq/types';
import { transformations } from '../transformations';

// Prompt user for a question or command
export async function getUserQuestion(): Promise<string | null> {
  const userInput = await promptUser('Ask your question: ');
  if (
    userInput.toLowerCase() === 'exit' ||
    userInput.toLowerCase() === 'quit'
  ) {
    return null;
  }
  return userInput;
}

// Let user select a directory from ~/Projects, then select files within that directory
export async function selectDirectory(
  projectsDir: string,
  state?: { 'Projects Directory'?: string; selections?: string[] },
): Promise<SelectOptionReturn<string, Record<string, any>>> {
  let directories: string[] = [];
  try {
    const entries = await fs.promises.readdir(projectsDir, {
      withFileTypes: true,
    });
    directories = entries
      .filter(
        (entry) =>
          entry.isDirectory() &&
          !entry.name.startsWith('.') &&
          entry.name !== 'node_modules' &&
          entry.name !== 'logs',
      )
      .map((entry) => path.join(projectsDir, entry.name));
  } catch (error) {
    return {
      'Projects Directory': projectsDir,
      selections: [],
      Selected: 'None',
      transformations: {},
    };
  }

  if (directories.length === 0) {
    return {
      'Projects Directory': projectsDir,
      selections: [],
      Selected: 'None',
      transformations: {},
    };
  }

  // First call: Select a directory
  const initialState = state || {
    'Projects Directory': projectsDir,
    selections: [],
  };
  const dirState = await selectOption3({
    options: directories,
    getName: (dir) => path.basename(dir),
    history: ['Select one directory and press Enter to confirm.'],
    state: initialState,
    maxSelections: 1,
  });

  if (dirState.selections.length === 0) {
    return {
      'Projects Directory': projectsDir,
      selections: [],
      Selected: 'None',
      transformations: {},
    };
  }

  const selectedDir = dirState.selections[0];

  // Recursively fetch files from the selected directory and its subdirectories
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

  const files = await getFilesRecursively(selectedDir);
  if (files.length === 0) {
    return {
      'Selected Directory': selectedDir,
      selections: [],
      Selected: 'None',
      transformations: {},
    };
  }

  // Second call: Select files from the directory with transformations
  const fileState = await selectOption3({
    options: files,
    getName: (file) => path.relative(selectedDir, file), // Relative paths for UI
    history: [
      'Select files from the directory (use Tab to change selection mode, Enter to confirm).',
    ],
    state: {
      'Selected Directory': selectedDir,
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
