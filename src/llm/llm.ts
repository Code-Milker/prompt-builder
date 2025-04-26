import { selectDirectory, getUserQuestion } from './user';
import { fetchContext, generateResponse } from './agent';
import path from 'path';
import type { Flow } from '../types';
import { initializeLogFile, logMessage, getLatestAction } from './dialog';
import { buildPrompt } from './prompts';

// Simple ASCII spinner
function startSpinner(message: string): () => void {
  const spinnerChars = ['|', '/', '-', '\\'];
  let index = 0;
  process.stdout.write(`${message} `);
  const interval = setInterval(() => {
    process.stdout.write(`\r${message} ${spinnerChars[index]}`);
    index = (index + 1) % spinnerChars.length;
  }, 100);
  return () => {
    clearInterval(interval);
    process.stdout.write('\r' + ' '.repeat(message.length + 2) + '\r');
  };
}

export function createLLMAgentFlow(): Flow {
  async function execute(): Promise<any> {
    const prompt = buildPrompt()
      .addRoleContext([
        {
          type: 'role',
          data: { role: 'Assistant' },
        },
      ])
      .addRulesContext([
        {
          type: 'rules',
          data: { rules: ['Respond concisely'] },
        },
      ]);
    const logFile = initializeLogFile();
    logMessage('system', 'LLM Agent is ready.', logFile);

    const projectsDir = path.join(
      process.env.HOME || process.env.USERPROFILE,
      'Projects',
    );
    const selectedDir = await selectDirectory(projectsDir);
    if (!selectedDir) {
      logMessage('user', 'No directory selected.', logFile, {
        action: 'select_directory',
        path: null,
      });
      return 'No directory selected.';
    }
    logMessage('user', `Selected directory: ${selectedDir}`, logFile, {
      action: 'select_directory',
      path: selectedDir,
    });
    console.log('Logged select_directory:', selectedDir);

    const context = await fetchContext(selectedDir[0]);
    const relativePaths = Object.keys(context);
    logMessage('system', 'Fetched file contents', logFile, {
      action: 'fetch_files',
      files: relativePaths,
      files_content: context,
    });

    // Add file context
    const fetchFilesAction = getLatestAction(logFile, 'fetch_files');
    if (
      fetchFilesAction &&
      fetchFilesAction.files &&
      fetchFilesAction.files_content
    ) {
      const fileContexts = fetchFilesAction.files.map((filePath: string) => ({
        type: 'file' as const,
        data: {
          path: filePath,
          content: fetchFilesAction.files_content[filePath],
        },
      }));
      prompt.addFileContext(fileContexts);
      console.log('Added file contexts:', fetchFilesAction.files);
    } else {
      console.log('Error: No fetch_files action found in log.');
    }

    // Add value context
    const selectDirAction = getLatestAction(logFile, 'select_directory');
    if (selectDirAction && selectDirAction.path) {
      prompt.addValueContext([
        {
          type: 'value',
          data: { value: selectDirAction.path },
        },
      ]);
      console.log('Added value context:', selectDirAction.path);
    } else {
      console.log('Error: No select_directory action found in log.');
    }

    while (true) {
      const userInput = await getUserQuestion();
      if (userInput === null) break;
      const finalPrompt = prompt.addUserQuestion(userInput);
      const promptJson = finalPrompt.buildJson();
      console.log('Final prompt JSON:', promptJson);

      // Start spinner
      const stopSpinner = startSpinner('Generating response');
      try {
        const response = await generateResponse(finalPrompt, logFile);
        stopSpinner();
        logMessage('assistant', response, logFile);
        console.log('Response:', response);
      } catch (error) {
        stopSpinner();
        console.error('Error generating response:', error.message);
        logMessage('system', `Error: ${error.message}`, logFile);
      }
    }

    logMessage('system', 'Conversation ended.', logFile);
    return 'Conversation ended.';
  }

  return {
    name: 'llm.agent',
    description: 'Interact with an Ollama LLM with project file context',
    execute,
  };
}
