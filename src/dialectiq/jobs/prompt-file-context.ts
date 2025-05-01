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
      console.log('Reading directory:', dir);
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
      console.error(`Error reading directory ${dir}:`, error.message);
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
  let fileState;
  try {
    fileState = await selectOption3({
      options: files,
      getName: (file) => path.relative(projectsDir, file), // Relative paths for UI
      history: [''],
      state: {
        'Selected Directory': projectsDir,
        selections: [],
      },
      maxSelections: 10,
      transformations: transformations,
      // customCommands: ['customCommands'],
    });
  } catch (error) {
    console.error('Error in selectOption3:', error.message);
    console.error('Stack trace:', error.stack);
    throw error; // Re-throw to handle in outer catch
  }

  // Resolve all transformation promises with error handling
  const resolvedTransformations: Record<string, any> = {};
  for (const [name, result] of Object.entries(fileState.transformations)) {
    try {
      resolvedTransformations[name] = await result;
    } catch (error) {
      console.error(`Error in transformation "${name}":`, error.message);
      resolvedTransformations[name] = `Error: ${error.message}`;
    }
  }

  const resolvedFileState: SelectOptionReturn<string, Record<string, any>> = {
    ...fileState,
    transformations: resolvedTransformations,
  };

  return resolvedFileState; // Return full fileState with resolved transformations
}

// Get project directory from command-line argument or fall back to ~/Projects
const projectsDir =
  process.argv[2] ||
  path.join(process.env.HOME || process.env.USERPROFILE, 'Projects');

// Ensure logs directory exists
const logsDir = path.join(
  process.env.HOME || process.env.USERPROFILE,
  'Projects/prompt-builder/logs',
);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Write output to logs
console.log('Starting script execution...');
selectFilesRecursively(projectsDir)
  .then((response) => {
    console.log('selectFilesRecursively completed');
    // Generate timestamp for subdirectory
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const runLogDir = path.join(logsDir, timestamp);

    // Create run-specific log directory
    if (!fs.existsSync(runLogDir)) {
      fs.mkdirSync(runLogDir, { recursive: true });
    }

    // File paths
    const jsonLogFile = path.join(runLogDir, `select-option.json`);
    const markdownLogFile = path.join(runLogDir, `prompt-context.md`);

    // Write full response as JSON
    fs.writeFileSync(jsonLogFile, JSON.stringify(response, null, 2), 'utf-8');
    console.log(`Wrote full output to ${jsonLogFile}`);

    // Write to-markdown output if available
    if (response.transformations['to-markdown']) {
      if (typeof response.transformations['to-markdown'] === 'string') {
        fs.writeFileSync(
          markdownLogFile,
          response.transformations['to-markdown'],
          'utf-8',
        );
        console.log(`Wrote to-markdown output to ${markdownLogFile}`);
        console.log(response.transformations['to-markdown']);
      } else {
        console.error(
          'to-markdown output is not a string:',
          response.transformations['to-markdown'],
        );
      }
    } else {
      console.log('No to-markdown output available');
    }
  })
  .catch((error) => {
    console.error('Error in selectFilesRecursively:', error.message);
    console.error('Stack trace:', error.stack);
  });
