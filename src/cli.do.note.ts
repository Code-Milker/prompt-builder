#!/usr/bin/env bun
import { $ } from 'bun';

// Configurable constants
const WINDOW_TITLE = 'lester';
const WINDOW_WIDTH_RATIO = 1 / 3;
const WINDOW_HEIGHT_RATIO = 1 / 5;
const GHOSTTY_PATH = '/opt/homebrew/bin/nvim';
const HAMMERSPOON_PATH = '/opt/homebrew/bin/hs';

async function findWindowId(title: string): Promise<string | null> {
  const windowList = await $`aerospace list-windows --all`.text();
  const line = windowList.split('\n').find((l) => l.includes(title));
  return line?.split('|').map((s) => s.trim())[0] ?? null;
}

async function executeHammerspoonLua(luaCode: string): Promise<void> {
  try {
    await $`${HAMMERSPOON_PATH} -c ${luaCode}`.quiet();
  } catch (error) {
    console.error('Hammerspoon error:', error);
    throw error;
  }
}

async function getScreenDimensions(): Promise<{
  width: number;
  height: number;
}> {
  const displayInfo =
    await $`system_profiler SPDisplaysDataType | grep Resolution`.text();
  const match = displayInfo.match(/(\d+) x (\d+)/);
  if (!match) throw new Error('Failed to parse screen resolution');
  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

async function moveToCurrentWorkspace(windowId: string) {
  // Get the current workspace name
  const currentWorkspaceOutput =
    await $`aerospace list-workspaces --focused`.text();
  const currentWorkspace = currentWorkspaceOutput.trim();

  if (!currentWorkspace)
    throw new Error('Failed to determine current workspace');

  // Move the window to the current workspace and focus it
  await $`aerospace move-node-to-workspace ${currentWorkspace} --window-id ${windowId}`.quiet();
  await $`aerospace focus --window-id ${windowId}`.quiet();
}

async function createNewWindow() {
  await $`open -na Ghostty --args --title="${WINDOW_TITLE}" -e "${GHOSTTY_PATH} -c 'lua vim.cmd(\"OpenWorkoutNote\")'"`.quiet();
  await $`sleep 0.5`.quiet(); // Wait for window creation
}

async function setupWindowLayout(windowId: string) {
  await $`aerospace layout --window-id ${windowId} floating`.quiet();
}

async function positionFullWidthWindow() {
  const { width: screenWidth, height: screenHeight } =
    await getScreenDimensions();
  const windowHeight = Math.round(screenHeight * WINDOW_HEIGHT_RATIO);
  const luaCode = `
    local win = hs.window.find("${WINDOW_TITLE}")
    if win then
      local screen = win:screen():frame()
      win:setFrame({
        x = screen.w / 4,
        y = 0,
        w = screen.w / 2,
        h = ${windowHeight}
      })
    end
  `;
  await executeHammerspoonLua(luaCode);
}

async function openWorkoutNote() {
  try {
    const { width, height } = await getScreenDimensions();
    console.log(`Screen size: ${width}x${height}`);
    const existingWindowId = await findWindowId(WINDOW_TITLE);
    if (existingWindowId) {
      console.log(
        `Moving existing window ID: ${existingWindowId} to current workspace`,
      );
      await moveToCurrentWorkspace(existingWindowId);
      await positionFullWidthWindow();
    } else {
      await createNewWindow();
      const windowId = await findWindowId(WINDOW_TITLE);
      if (!windowId) throw new Error('Window not found after creation');
      await positionFullWidthWindow();
      await setupWindowLayout(windowId);
    }
    console.log('Window setup completed successfully');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

openWorkoutNote();
