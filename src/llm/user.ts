import { promptUser, selectOption } from '../cli.use.utils';
import fs from 'fs';
import path from 'path';

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

// Let user select a directory from ~/Projects
export async function selectDirectory(
  projectsDir: string,
): Promise<string | null> {
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
    return null; // Error handling delegated to caller
  }

  if (directories.length === 0) return null;

  const selectedDirs = await selectOption<string>(
    directories,
    (dir) => path.basename(dir),
    (dir, input) => {
      const name = path.basename(dir);
      const lowerInput = input.toLowerCase();
      if (lowerInput && name.toLowerCase().includes(lowerInput)) {
        const index = name.toLowerCase().indexOf(lowerInput);
        const before = name.slice(0, index);
        const match = name.slice(index, index + input.length);
        const after = name.slice(index + input.length);
        return `${before}${match}${after} (${dir})`;
      }
      return `${name} (${dir})`;
    },
    [],
    10,
    1,
  );

  return selectedDirs.length > 0 ? selectedDirs[0] : null;
}
