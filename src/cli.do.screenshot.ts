import { $ } from 'bun';
import { join } from 'path';
import fs from 'fs/promises';
import { createWorker } from 'tesseract.js';

async function captureScreenshot(): Promise<string | null> {
  // Define the directory for saving screenshots
  const screenshotsDir = join(process.cwd(), 'screenshots');

  // Create the directory if it doesn’t exist
  await fs.mkdir(screenshotsDir, { recursive: true });

  // Generate a unique filename using the current timestamp
  const timestamp = new Date()
    .toISOString()
    .replace(/:/g, '-')
    .replace(/\..+/, '');
  const filename = `screenshot-${timestamp}.png`;
  const screenshotPath = join(screenshotsDir, filename);

  try {
    // Capture the full-screen screenshot and save it to the specified path
    await $`screencapture -x -t png ${screenshotPath}`.quiet();
    console.log(`Screenshot saved to: ${screenshotPath}`);
    return screenshotPath;
  } catch (error) {
    console.error(`Failed to capture screenshot: ${error.message}`);
    return null;
  }
}

async function extractTextFromImage(imagePath: string): Promise<string | null> {
  try {
    console.log('Extracting text from image...');
    const worker = await createWorker();
    // worker.load('eng');
    const {
      data: { text },
    } = await worker.recognize(imagePath);
    await worker.terminate();
    console.log('Text extraction completed.');
    return text || 'No text extracted';
  } catch (error) {
    console.error(`Failed to extract text from image: ${error.message}`);
    return null;
  }
}

async function main() {
  const screenshotPath = await captureScreenshot();
  if (screenshotPath) {
    console.log('Screenshot captured successfully.');
    const extractedText = await extractTextFromImage(screenshotPath);
    if (extractedText) {
      console.log('Extracted Text:');
      console.log(extractedText);
    } else {
      console.log('Failed to extract text from screenshot.');
    }
  } else {
    console.log('Failed to capture screenshot.');
  }
}

main();
