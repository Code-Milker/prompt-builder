#!/usr/bin/env bun
import { $ } from 'bun';

async function openWorkoutNote() {
  await $`open -na Ghostty --args -e "/opt/homebrew/bin/nvim -c 'lua vim.defer_fn(function() vim.cmd(\"OpenWorkoutNote\") end, 100)'"`;
}

await openWorkoutNote();
