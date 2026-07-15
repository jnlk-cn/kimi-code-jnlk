#!/usr/bin/env node
/**
 * Sync root CHANGELOG.md version blocks into docs/en/release-notes/changelog.md.
 * Preserves the VitePress frontmatter and page intro on the docs page.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const source = readFileSync(join(repoRoot, 'CHANGELOG.md'), 'utf8');
const firstVersion = source.search(/^## \d/m);
if (firstVersion === -1) {
  console.error('CHANGELOG.md: no version heading found (expected "## <version>")');
  process.exit(1);
}

const versions = source.slice(firstVersion).trimEnd() + '\n';
const target = `---
outline: 2
---

# Changelog

This page documents the changes in each Kimi Code CLI release.

${versions}`;

writeFileSync(join(repoRoot, 'docs/en/release-notes/changelog.md'), target);
console.log('Synced docs/en/release-notes/changelog.md from CHANGELOG.md');
