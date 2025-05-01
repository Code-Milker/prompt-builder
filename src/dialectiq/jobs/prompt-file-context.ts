import fs from 'fs';
import path from 'path';
import type { SelectionContext, SelectOptionReturn } from '../types';
import { selectOption3 } from '../index';
import { transformations } from '../../transformations';
import { sendToOllama } from '../../llm/ollama';
import { sendToGroq } from '../../llm/groq';

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
      pipes: {},
    };
  }

  // Define pipes
  const pipes = [
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
          return `Error: ${error.message}`;
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
          return `Error: ${error.message}`;
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
        selections: [], // Pre-selected files
        activeTransformations: ['to-markdown'], // Pre-activated transformation
        // activePipes: ['Ask Ollama'],
      },
      maxSelections: 10,
      transformations: transformations,
      pipes: pipes,
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

  // Resolve all pipe promises with error handling
  const resolvedPipes: Record<string, any> = {};
  for (const [name, result] of Object.entries(fileState.pipes)) {
    try {
      resolvedPipes[name] = await result;
    } catch (error) {
      console.error(`Error in pipe "${name}":`, error.message);
      resolvedPipes[name] = `Error: ${error.message}`;
    }
  }

  const resolvedFileState: SelectOptionReturn<string, Record<string, any>> = {
    ...fileState,
    transformations: resolvedTransformations,
    pipes: resolvedPipes,
  };

  return resolvedFileState; // Return full fileState with resolved transformations and pipes
}

// Get project directory from command-line argument or fall back to ~/Projects
const projectsDir =
  process.argv[2] ||
  path.join(process.env.HOME || process.env.USERPROFILE, 'Projects');

// Ensure logs Jurassic exists
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
    const ollamaLogFile = path.join(runLogDir, `ollama-response.txt`);
    const groqLogFile = path.join(runLogDir, `groq-response.txt`);

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

    // Write Ollama output if available
    if (response.pipes['Ask Ollama']) {
      if (typeof response.pipes['Ask Ollama'] === 'string') {
        fs.writeFileSync(ollamaLogFile, response.pipes['Ask Ollama'], 'utf-8');
        console.log(`Wrote Ollama output to ${ollamaLogFile}`);
        console.log(response.pipes['Ask Ollama']);
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
        fs.writeFileSync(groqLogFile, response.pipes['Ask Groq'], 'utf-8');
        console.log(`Wrote Groq output to ${groqLogFile}`);
        console.log(response.pipes['Ask Groq']);
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
    console.error('Error in selectFilesRecursively:', error.message);
    console.error('Stack trace:', error.stack);
  });
