#!/usr/bin/env bun

import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import readline from 'node:readline';
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
  const projectRoot = process.cwd(); // Use calling directory as root
  const findCommand = `find ${projectRoot} -type f -not -path '*/\.git/*' -not -path '*/node_modules/*'`;
  const currentWorkingDirectory = process.cwd(); // Get current working directory
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

// Main function to handle file selection and processing
async function main() {
  // Select files with fzf
  const filePaths = await selectFilesWithFzf();

  // Set up readline for user input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const projectRoot = process.cwd();

  // Build output with and without colors
  let outputWithColors = '\n**Results:**\n';
  let outputWithoutColors = '\n**Results:**\n';
  const separatorLine = '─'.repeat(50); // A horizontal line for separation
  for (const [index, relativePath] of filePaths.entries()) {
    try {
      const content = await Bun.file(relativePath).text();
      // Add separator before each file except the first one
      if (index > 0) {
        outputWithColors += `${colors.yellow}${separatorLine} Filepath: ${relativePath} ${separatorLine}${colors.reset}\n`;
        outputWithoutColors += `${separatorLine} Filepath: ${relativePath} ${separatorLine}\n`;
      } else {
        // For the first file, no separator above, just label it
        outputWithColors += `${colors.yellow}Filepath: ${relativePath}${colors.reset}\n`;
        outputWithoutColors += `Filepath: ${relativePath}\n`;
      }
      outputWithColors += `${colors.cyan}Content:${colors.reset}\n\`\`\`\n${content}\n\`\`\`\n\n`;
      outputWithoutColors += `Content:\n\`\`\`\n${content}\n\`\`\`\n\n`;
    } catch (err) {
      console.error(`Error reading file ${relativePath}: ${err.message}`);
    }
  }

  // Print the output with colors
  console.log(outputWithColors);

  // Ask user if they want to copy the output to clipboard
  const answer: string = await new Promise((resolve) => {
    rl.question(
      'Do you want to copy this output to the clipboard? (y/n): ',
      resolve,
    );
  });

  if (answer.toLowerCase() === 'y') {
    await copyToClipboard(outputWithoutColors);
    console.log('Output copied to clipboard.');
  } else {
    console.log('Output not copied.');
  }

  rl.close();
}

main();
