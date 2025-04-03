#!/usr/bin/env bun
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import Bun from 'bun';

// Promisify exec for async/await
const execPromise = promisify(exec);

// Colors for output
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
};

// Function to copy text to clipboard using platform-specific tools
async function copyToClipboard(text) {
  let command;
  if (process.platform === 'darwin') {
    command = ['pbcopy'];
  } else if (process.platform === 'linux') {
    command = ['xclip', '-selection', 'clipboard'];
  } else if (process.platform === 'win32') {
    command = ['clip'];
  } else {
    console.error('Unsupported platform for clipboard copying');
    return;
  }
  const proc = Bun.spawn(command, { stdin: 'pipe' });
  await proc.stdin.write(text);
  await proc.stdin.end();
  await proc.exited;
}

// Function to select files with fzf
async function selectFilesWithFzf() {
  const projectRoot = process.cwd();
  const findCommand = `find ${projectRoot} -type f -not -path '*/\.git/*' -not -path '*/node_modules/*'`;
  const currentWorkingDirectory = process.cwd();
  const fzfCommand = `${findCommand} | sed -E 's|^${currentWorkingDirectory}/||' | fzf --multi --height 40% --border --preview 'cat {}'`;
  try {
    const { stdout } = await execPromise(fzfCommand);
    const selectedFiles = stdout
      .trim()
      .split('\n')
      .filter((file) => file);
    if (selectedFiles.length === 0) {
      console.log('No files selected');
      process.exit(0);
    }
    return selectedFiles;
  } catch (err) {
    if (err.code === 1) {
      console.log('No files available to select');
      process.exit(0);
    } else if (err.code === 130) {
      console.log('Selection canceled');
      process.exit(0);
    } else {
      console.error('Error using fzf:', err.message);
      process.exit(1);
    }
  }
}

// Function to prompt user for input
async function promptUser(message) {
  return new Promise((resolve) => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    readline.question(message, (answer) => {
      readline.close();
      resolve(answer.trim());
    });
  });
}

// Function to prompt for a number within a range
async function promptForNumber(message, min, max) {
  while (true) {
    const input = await promptUser(message);
    const num = parseInt(input, 10);
    if (!isNaN(num) && num >= min && num <= max) {
      return num;
    }
    console.log(`Please enter a number between ${min} and ${max}.`);
  }
}

// Function to display file content paginated (50 lines at a time)
async function displayPaginated(file, lines, totalLines) {
  const pageSize = 50;
  let currentLine = 0;
  let page = 1;
  while (currentLine < totalLines) {
    const endLine = Math.min(currentLine + pageSize, totalLines);
    console.log(
      `\n--- Page ${page}: lines ${currentLine + 1} to ${endLine} ---`,
    );
    for (let i = currentLine; i < endLine; i++) {
      console.log(`${(i + 1).toString().padStart(4)} ${lines[i]}`);
    }
    currentLine = endLine;
    page++;
    if (currentLine < totalLines) {
      const continueChoice = await promptUser(
        'Press Enter to continue or "q" to stop viewing: ',
      );
      if (continueChoice.toLowerCase() === 'q') {
        break;
      }
    }
  }
}

// Main function to handle file selection and processing
async function main() {
  // Select files with fzf
  const filePaths = await selectFilesWithFzf();

  // Build output with and without colors
  let outputWithColors = '\n**Results:**\n';
  let outputWithoutColors = '\n**Results:**\n';
  const separatorLine = '─'.repeat(50); // A horizontal line for separation

  for (const [index, file] of filePaths.entries()) {
    console.log(`\nProcessing file: ${file}`);
    let content = '';
    let choice;

    do {
      choice = await promptUser(
        'Include full file (f), select range (r), read paginated (p), or skip (s)? ',
      );

      if (choice.toLowerCase() === 'f') {
        // Include entire file
        try {
          content = await Bun.file(file).text();
        } catch (err) {
          console.error(`Error reading file ${file}: ${err.message}`);
          continue;
        }
      } else if (choice.toLowerCase() === 'r') {
        // Select a range of lines
        const viewChoice = await promptUser(
          'View file paginated (p) or all at once (a)? ',
        );
        try {
          const fileContent = await Bun.file(file).text();
          const lines = fileContent.split('\n');
          const totalLines = lines.length;
          console.log(`\nFile: ${file} (${totalLines} lines)`);

          if (viewChoice.toLowerCase() === 'p') {
            await displayPaginated(file, lines, totalLines);
          } else {
            // Print all at once
            lines.forEach((line, i) => {
              console.log(`${(i + 1).toString().padStart(4)} ${line}`);
            });
          }

          // Prompt for start and end lines
          const startPrompt = 'Scroll up to view the file. Enter start line: ';
          const start = await promptForNumber(startPrompt, 1, totalLines);
          const endPrompt = 'Scroll up to view the file. Enter end line: ';
          const end = await promptForNumber(endPrompt, start, totalLines);
          content = lines.slice(start - 1, end).join('\n');
        } catch (err) {
          console.error(`Error reading file ${file}: ${err.message}`);
          continue;
        }
      } else if (choice.toLowerCase() === 'p') {
        // Read file paginated (new option)
        try {
          const fileContent = await Bun.file(file).text();
          const lines = fileContent.split('\n');
          const totalLines = lines.length;
          console.log(`\nFile: ${file} (${totalLines} lines)`);
          await displayPaginated(file, lines, totalLines);
          console.log('Finished reading. Returning to options.');
        } catch (err) {
          console.error(`Error reading file ${file}: ${err.message}`);
          continue;
        }
      } else if (choice.toLowerCase() === 's') {
        console.log('Skipping this file.');
      } else {
        console.log('Invalid choice. Please enter f, r, p, or s.');
      }
    } while (choice.toLowerCase() === 'p'); // Loop if reading paginated, to allow further actions

    if (choice.toLowerCase() === 's') {
      continue;
    }

    // Add content to output if there is any
    if (content) {
      if (index > 0) {
        outputWithColors += `${colors.yellow}${separatorLine} Filepath: ${file} ${separatorLine}${colors.reset}\n`;
        outputWithoutColors += `${separatorLine} Filepath: ${file} ${separatorLine}\n`;
      } else {
        outputWithColors += `${colors.yellow}Filepath: ${file}${colors.reset}\n`;
        outputWithoutColors += `Filepath: ${file}\n`;
      }
      outputWithColors += `${colors.cyan}Content:${colors.reset}\n\`\`\`\n${content}\n\`\`\`\n\n`;
      outputWithoutColors += `Content:\n\`\`\`\n${content}\n\`\`\`\n\n`;
    }
  }

  // Print the output with colors
  console.log(outputWithColors);

  // Copy plain output to clipboard
  await copyToClipboard(outputWithoutColors);
  console.log('Output copied to clipboard.');

  process.exit(0);
}

main();
