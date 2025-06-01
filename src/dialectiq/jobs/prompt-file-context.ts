import fs from 'fs/promises';
import path from 'path';
import type { Pipe, SelectionContext, SelectOptionReturn } from '../types';
import { selectOption3 } from '../index';
import { transformations } from '../../transformations';
import { sendToOllama } from '../../llm/ollama';
import { sendToGroq } from '../../llm/groq';

// Recursively fetch files from a directory and its subdirectories, then select files
export async function selectFilesRecursively(
  projectsDir: string,
  preSelectedFiles: string[] = [],
): Promise<SelectOptionReturn<string, Record<string, any>>> {
  // Recursively fetch files from the projects directory, respecting root .gitignore
  const blacklistedDirs = new Set([
    'node_modules',
    '.git',
    '.DS_Store',
    'logs',
  ]);

  // Parse .gitignore patterns from the root directory
  const gitignorePatterns: string[] = [];
  const gitignorePath = path.join(projectsDir, '.gitignore');
  try {
    const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
    gitignorePatterns.push(
      ...gitignoreContent
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#')),
    );
  } catch (error) {
    // No .gitignore file or error reading it, proceed without patterns
    console.log(`No .gitignore found at ${gitignorePath}`);
  }

  // Simple matcher for .gitignore patterns
  function isIgnored(relativePath: string): boolean {
    for (const pattern of gitignorePatterns) {
      // Directory pattern (e.g., "dist/" or "dist")
      if (pattern.endsWith('/')) {
        const dirPattern = pattern.slice(0, -1);
        if (
          relativePath === dirPattern ||
          relativePath.startsWith(dirPattern + '/')
        ) {
          return true;
        }
      }
      // Exact file or directory match
      else if (relativePath === pattern) {
        return true;
      }
      // Extension pattern (e.g., "*.log")
      else if (pattern.startsWith('*.')) {
        const ext = pattern.slice(1).toLowerCase();
        if (relativePath.toLowerCase().endsWith(ext)) {
          return true;
        }
      }
      // Basic wildcard pattern (e.g., "logs/*")
      else if (pattern.includes('*')) {
        const regexPattern =
          '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
        if (new RegExp(regexPattern).test(relativePath)) {
          return true;
        }
      }
    }
    return false;
  }

  async function getFilesRecursively(dir: string): Promise<string[]> {
    let files: string[] = [];
    try {
      console.log('Reading directory:', dir);
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(projectsDir, fullPath);

        // Skip if path matches .gitignore patterns
        if (relativePath && isIgnored(relativePath)) {
          continue;
        }

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
      console.error(
        `Error reading directory ${dir}:`,
        (error as Error).message,
      );
    }
    return files;
  }

  const files = await getFilesRecursively(projectsDir);
  if (files.length === 0 && preSelectedFiles.length === 0) {
    return {
      'Selected Directory': projectsDir,
      selections: [],
      Selected: 'None',
      transformations: {},
      pipes: {},
    };
  }

  // Validate pre-selected files
  const validPreSelectedFiles = await Promise.all(
    preSelectedFiles.map(async (file) => {
      try {
        await fs.access(file);
        return file;
      } catch {
        console.warn(`Pre-selected file not accessible: ${file}`);
        return null;
      }
    }),
  ).then((results) => results.filter((file): file is string => file !== null));

  // Define pipes
  const pipes: Pipe[] = [
    {
      name: 'Apply File Changes To Directory',
      description:
        'This will take updated project files from another source and apply them to the provided directory (defaults to current directory)',
      apply: async <T>(
        context: SelectionContext<T>,
        state: Record<string, any>,
        getName: (option: T) => string,
      ) => {
        const targetDir = state['Selected Directory'];
        const sourceDir = state['Source Directory'];
        const inputFile = state['inputFile'];

        if (!targetDir) {
          return {
            error:
              'Target directory not specified in state["Selected Directory"]',
          };
        }
        if (!sourceDir) {
          return {
            error:
              'Source directory not specified in state["Source Directory"]',
          };
        }
        if (!inputFile) {
          return { error: 'Input file not specified in state["inputFile"]' };
        }

        try {
          // Read the input file
          const inputContent = await fs.readFile(inputFile, 'utf8');
          const filePaths = inputContent
            .split('#')
            .map((p) => p.trim())
            .filter((p) => p);

          const results: {
            successful: { source: string; target: string }[];
            failed: {
              source: string;
              target: string;
              error: string;
              validationFailed?: boolean;
            }[];
          } = {
            successful: [],
            failed: [],
          };

          // Validation hook (override this as needed)
          const validate = async (
            sourcePath: string,
            targetPath: string,
          ): Promise<boolean> => {
            // Default validation: check if target file exists and is readable
            try {
              await fs.access(targetPath);
              return true;
            } catch {
              return false; // Fail if target file is not accessible
            }
          };

          // Process each file
          for (const relativePath of filePaths) {
            const sourcePath = path.join(sourceDir, relativePath);
            const targetPath = path.join(targetDir, relativePath);

            try {
              // Ensure the target directory exists
              await fs.mkdir(path.dirname(targetPath), { recursive: true });

              // Copy the file
              await fs.copyFile(sourcePath, targetPath);

              // Run validation
              const isValid = await validate(sourcePath, targetPath);
              if (isValid) {
                results.successful.push({
                  source: sourcePath,
                  target: targetPath,
                });
              } else {
                results.failed.push({
                  source: sourcePath,
                  target: targetPath,
                  error: 'Validation failed',
                  validationFailed: true,
                });
              }
            } catch (error) {
              results.failed.push({
                source: sourcePath,
                target: targetPath,
                error: (error as Error).message,
              });
            }
          }

          return {
            context: {
              selectedDirectory: targetDir,
              sourceDirectory: sourceDir,
              inputFile,
              processedFiles: filePaths,
            },
            results,
          };
        } catch (error) {
          return {
            error: `Failed to read input file: ${(error as Error).message}`,
          };
        }
      },
    },
    {
      name: 'Ask Ollama',
      description: 'Send context to Ollama LLM',
      apply: async <T>(
        context: SelectionContext<T>,
        state: Record<string, any>,
        getName: (option: T) => string,
      ) => {
        const contextString = JSON.stringify(
          {
            selectedDirectory: state['Selected Directory'],
            selections: context.selectedOptions.map(getName),
            transformations: state.transformations,
          },
          null,
          2,
        );
        try {
          return await sendToOllama(
            [
              {
                role: 'system',
                content:
                  'You are a helpful AI assistant. Analyze the provided context and provide a response.',
              },
              { role: 'user', content: contextString },
            ],
            { model: 'wizardlm2:7b' },
          );
        } catch (error) {
          return `Error: ${(error as Error).message}`;
        }
      },
    },
    {
      name: 'Ask Groq',
      description: 'Send context to Groq LLM',
      apply: async <T>(
        context: SelectionContext<T>,
        state: Record<string, any>,
        getName: (option: T) => string,
      ) => {
        const contextString = JSON.stringify(
          {
            selectedDirectory: state['Selected Directory'],
            selections: context.selectedOptions.map(getName),
            transformations: state.transformations,
          },
          null,
          2,
        );
        try {
          return await sendToGroq(
            [
              {
                role: 'system',
                content:
                  'You are a helpful AI assistant. Analyze the provided context and provide a response.',
              },
              { role: 'user', content: contextString },
            ],
            { taskType: 'general' },
          );
        } catch (error) {
          return `Error: ${(error as Error).message}`;
        }
      },
    },
  ];

  // Select files from the directory with transformations and pipes
  let fileState;
  try {
    fileState = await selectOption3({
      options: files,
      getName: (file) => path.relative(projectsDir, file), // Relative paths for UI
      history: [''],
      state: {
        'Selected Directory': projectsDir,
        selections: validPreSelectedFiles, // Pre-selected open buffers
        activeTransformations: ['to-markdown'], // Pre-activated transformation
        // activePipes: ['Ask Ollama'],
      },
      maxSelections: 10,
      transformations: transformations,
      pipes: pipes,
    });
  } catch (error) {
    console.error('Error in selectOption3:', (error as Error).message);
    console.error('Stack trace:', (error as Error).stack);
    throw error; // Re-throw to handle in outer catch
  }

  // Resolve all transformation promises with error handling
  const resolvedTransformations: Record<string, any> = {};
  for (const [name, result] of Object.entries(fileState.transformations)) {
    try {
      resolvedTransformations[name] = await result;
    } catch (error) {
      console.error(
        `Error in transformation "${name}":`,
        (error as Error).message,
      );
      resolvedTransformations[name] = `Error: ${(error as Error).message}`;
    }
  }

  // Resolve all pipe promises with error handling
  const resolvedPipes: Record<string, any> = {};
  for (const [name, result] of Object.entries(fileState.pipes)) {
    try {
      resolvedPipes[name] = await result;
    } catch (error) {
      console.error(`Error in pipe "${name}":`, (error as Error).message);
      resolvedPipes[name] = `Error: ${(error as Error).message}`;
    }
  }

  const resolvedFileState: SelectOptionReturn<string, Record<string, any>> = {
    ...fileState,
    transformations: resolvedTransformations,
    pipes: resolvedPipes,
  };

  return resolvedFileState; // Return full fileState with resolved transformations and pipes
}

// Get project directory and pre-selected files from command-line arguments
const projectsDir =
  process.argv[2] ||
  path.join(process.env.HOME || process.env.USERPROFILE, 'Projects');
let preSelectedFiles: string[] = [];
if (process.argv[3]) {
  try {
    preSelectedFiles = JSON.parse(process.argv[3]);
  } catch (error) {
    console.error(
      'Error parsing pre-selected files:',
      (error as Error).message,
    );
  }
}

// Ensure logs directory exists
const logsDir = path.join(
  process.env.HOME || process.env.USERPROFILE,
  'Projects/prompt-builder/logs',
);
try {
  await fs.mkdir(logsDir, { recursive: true });
} catch (error) {
  console.error(
    `Error creating logs directory ${logsDir}:`,
    (error as Error).message,
  );
}

// Write output to logs
console.log('Starting script execution...');
selectFilesRecursively(projectsDir, preSelectedFiles)
  .then(async (response) => {
    console.log('selectFilesRecursively completed');
    // Generate timestamp for subdirectory
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const runLogDir = path.join(logsDir, timestamp);

    // Create run-specific log directory
    try {
      await fs.mkdir(runLogDir, { recursive: true });
    } catch (error) {
      console.error(
        `Error creating log directory ${runLogDir}:`,
        (error as Error).message,
      );
      return;
    }

    // File paths
    const jsonLogFile = path.join(runLogDir, `select-option.json`);
    const markdownLogFile = path.join(runLogDir, `prompt-context.md`);
    const ollamaLogFile = path.join(runLogDir, `ollama-response.txt`);
    const groqLogFile = path.join(runLogDir, `groq-response.txt`);

    // Write full response as JSON
    try {
      await fs.writeFile(
        jsonLogFile,
        JSON.stringify(response, null, 2),
        'utf-8',
      );
      console.log(`Wrote full output to ${jsonLogFile}`);
    } catch (error) {
      console.error(
        `Error writing JSON log to ${jsonLogFile}:`,
        (error as Error).message,
      );
    }

    // Write to-markdown output if available
    if (response.transformations['to-markdown']) {
      if (typeof response.transformations['to-markdown'] === 'string') {
        try {
          await fs.writeFile(
            markdownLogFile,
            response.transformations['to-markdown'],
            'utf-8',
          );
          console.log(`Wrote to-markdown output to ${markdownLogFile}`);
          console.log(response.transformations['to-markdown']);
        } catch (error) {
          console.error(
            `Error writing markdown log to ${markdownLogFile}:`,
            (error as Error).message,
          );
        }
      } else {
        console.error(
          'to-markdown output is not a string:',
          response.transformations['to-markdown'],
        );
      }
    } else {
      console.log('No to-markdown output available');
    }

    // Write Ollama output if available
    if (response.pipes['Ask Ollama']) {
      if (typeof response.pipes['Ask Ollama'] === 'string') {
        try {
          await fs.writeFile(
            ollamaLogFile,
            response.pipes['Ask Ollama'],
            'utf-8',
          );
          console.log(`Wrote Ollama output to ${ollamaLogFile}`);
          console.log(response.pipes['Ask Ollama']);
        } catch (error) {
          console.error(
            `Error writing Ollama log to ${ollamaLogFile}:`,
            (error as Error).message,
          );
        }
      } else {
        console.error(
          'Ollama output is not a string:',
          response.pipes['Ask Ollama'],
        );
      }
    } else {
      console.log('No Ollama output available');
    }

    // Write Groq output if available
    if (response.pipes['Ask Groq']) {
      if (typeof response.pipes['Ask Groq'] === 'string') {
        try {
          await fs.writeFile(groqLogFile, response.pipes['Ask Groq'], 'utf-8');
          console.log(`Wrote Groq output to ${groqLogFile}`);
          console.log(response.pipes['Ask Groq']);
        } catch (error) {
          console.error(
            `Error writing Groq log to ${groqLogFile}:`,
            (error as Error).message,
          );
        }
      } else {
        console.error(
          'Groq output is not a string:',
          response.pipes['Ask Groq'],
        );
      }
    } else {
      console.log('No Groq output available');
    }
  })
  .catch((error) => {
    console.error('Error in selectFilesRecursively:', (error as Error).message);
    console.error('Stack trace:', (error as Error).stack);
  });
