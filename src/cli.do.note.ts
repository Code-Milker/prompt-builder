#!/usr/bin/env bun
import { $ } from 'bun';

// Reusable function to find windowId for "lester" in window list
function findLesterWindowId(windowList: string): string | null {
  const lines = windowList.split('\n');
  for (const line of lines) {
    if (line.includes('lester')) {
      const parts = line.split('|').map((s) => s.trim());
      return parts[0]; // Return windowId
    }
  }
  return null; // Return null if not found
}

async function executeHammerspoonLua(luaCode: string): Promise<void> {
  try {
    await $`/opt/homebrew/bin/hs -c ${luaCode}`.quiet();
  } catch (error) {
    console.error('Hammerspoon error:', error);
  }
}

async function openWorkoutNote() {
  let windowId = null;
  try {
    const displayInfo =
      await $`system_profiler SPDisplaysDataType | grep Resolution`.text();
    const match = displayInfo.match(/(\d+) x (\d+)/);
    if (!match) throw new Error('Failed to parse screen resolution');
    const screenWidth = Number(match[1]);
    const screenHeight = Number(match[2]);
    const windowWidth = Math.round(screenWidth / 3); // 1/3 width
    const windowHeight = Math.round(screenHeight / 5); // 1/5 height
    console.log(
      `Screen size: ${screenWidth}x${screenHeight}, Window size: ${windowWidth}x${windowHeight}`,
    );

    // Close existing Ghostty windows with title "lester"
    console.log('Checking for existing Ghostty windows with title "lester"');
    let windowList = await $`aerospace list-windows --all`.text();
    let existingWindowId = findLesterWindowId(windowList);
    if (existingWindowId) {
      console.log(
        `Found existing Ghostty window (lester) with ID: ${existingWindowId}, closing it`,
      );
      try {
        await $`aerospace close --window-id ${existingWindowId}`.quiet();
        console.log(`Closed window ID: ${existingWindowId}`);
      } catch (e) {
        console.warn(`Failed to close window ID: ${existingWindowId}:`, e);
      }
    } else {
      console.log('No existing Ghostty windows with title "lester" found.');
    }

    await $`open -na Ghostty --args --title="lester" -e "/opt/homebrew/bin/nvim -c 'lua vim.cmd(\"OpenWorkoutNote\")'"`.quiet();
    console.log('Ghostty opened successfully');

    await $`sleep .1`.quiet(); // Ensure window is ready

    // Find new Ghostty window ID
    windowList = await $`aerospace list-windows --all`.text();
    console.log('Window list:', windowList);
    windowId = findLesterWindowId(windowList);

    if (!windowId) {
      console.warn(
        'New Ghostty window (lester) not found. Skipping layout and resize.',
      );
      return;
    }
    console.log(`Found new Ghostty window (lester) with ID: ${windowId}`);

    // Apply floating layout
    await $`aerospace layout --window-id ${windowId} floating`;

    // await $`sleep 1`.quiet(); // Ensure window is ready
    console.log(`Applied floating layout to window ID: ${windowId}`);

    // Use Hammerspoon to resize and center the window
    const centerX = Math.round((screenWidth - windowWidth) / 2);
    const centerY = Math.round((screenHeight - windowHeight) / 2);

    const luaCode = `
  local win = hs.window.find("lester")
  if win then
    local screen = win:screen():frame()
    local f = win:frame()
    f.x = 0
    f.w = screen.w
    f.y = (screen.h - f.h) / 2
    win:setFrame(f)
  end
`;

    await executeHammerspoonLua(luaCode);
    console.log('Window resized and centered using Hammerspoon');
  } catch (error) {
    console.error('Error executing command:', error);
    if (error.exitCode) console.error(`Exit code: ${error.exitCode}`);
    if (error.stderr) console.error(`STDERR: ${error.stderr.toString()}`);
    process.exit(1);
  }
}

openWorkoutNote();
