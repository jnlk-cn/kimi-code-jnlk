#!/usr/bin/env node
/**
 * Sync KimiCodeBoost skills into Ganymede bundled resources.
 * Pin: see PINNED_TAG below. After sync, re-apply Ganymede patches listed in
 * resources/skills/kimicodeboost/GANYMEDE.md.
 */
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { Readable } from 'node:stream';

const PINNED_TAG = 'v6.0.3';
const REPO = 'jnlk-cn/KimiCodeBoost';
const __dirname = dirname(fileURLToPath(import.meta.url));
const destRoot = join(__dirname, '..', 'resources', 'skills', 'kimicodeboost');

async function main() {
  const tag = process.env.KIMICODEBOOST_TAG ?? PINNED_TAG;
  const url = `https://github.com/${REPO}/archive/refs/tags/${tag}.tar.gz`;
  console.log(`Fetching ${url}`);

  const response = await fetch(url);
  if (!response.ok || response.body === null) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const work = await mkdtemp(join(tmpdir(), 'kimicodeboost-'));
  const archive = join(work, 'archive.tar.gz');
  await pipeline(Readable.fromWeb(response.body), createWriteStream(archive));

  const extractDir = join(work, 'extract');
  await mkdir(extractDir, { recursive: true });
  execFileSync('tar', ['-xzf', archive, '-C', extractDir, '--strip-components=1'], {
    stdio: 'inherit',
  });

  const sourceSkills = join(extractDir, 'skills');
  await mkdir(destRoot, { recursive: true });
  execFileSync('rsync', ['-a', '--delete', '--exclude', 'GANYMEDE.md', `${sourceSkills}/`, `${destRoot}/`], {
    stdio: 'inherit',
  });

  await writeFile(
    join(destRoot, '.synced-from'),
    `${REPO}@${tag}\nsyncedAt=${new Date().toISOString()}\n`,
    'utf8',
  );

  const notesPath = join(destRoot, 'GANYMEDE.md');
  try {
    await readFile(notesPath, 'utf8');
  } catch {
    await writeFile(
      notesPath,
      [
        '# Ganymede patches for vendored KimiCodeBoost skills',
        '',
        `Upstream pin: \`${REPO}@${tag}\`.`,
        '',
        'After running `pnpm sync:kimicodeboost`, re-apply these local edits:',
        '',
        '- `brainstorming/SKILL.md` — visual assistant → GanymedeBrowser',
        '- `writing-plans/SKILL.md` — Ganymede Plans panel YAML frontmatter',
        '',
        'See `ganymede-engineering-bridge` for the durable host-tool mapping.',
        '',
      ].join('\n'),
      'utf8',
    );
  }

  await rm(work, { recursive: true, force: true });
  console.log(`Synced KimiCodeBoost skills → ${destRoot}`);
  console.log('Re-apply Ganymede patches documented in GANYMEDE.md if needed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
