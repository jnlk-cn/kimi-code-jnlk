#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

if (process.platform !== 'darwin') {
  process.stdout.write('Skipping macOS Computer Use helper on this platform.\n');
  process.exit(0);
}

const outputDir = join(root, 'resources', 'bin');
const output = join(outputDir, 'ganymede-computer-use');
await mkdir(outputDir, { recursive: true });

const code = await new Promise((resolve, reject) => {
  const child = spawn(
    'xcrun',
    [
      'swiftc',
      join(root, 'native', 'macos', 'GanymedeComputerUse.swift'),
      '-o',
      output,
      '-framework',
      'AppKit',
      '-framework',
      'ApplicationServices',
      '-framework',
      'ScreenCaptureKit',
    ],
    { cwd: root, stdio: 'inherit' },
  );
  child.once('error', reject);
  child.once('close', resolve);
});

if (code !== 0) {
  throw new Error(`Swift helper compilation failed with exit code ${String(code)}.`);
}
