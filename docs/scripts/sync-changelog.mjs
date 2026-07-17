#!/usr/bin/env node
/**
 * Sync root CHANGELOG.md and CHANGELOG.zh-CN.md into docs release-notes pages.
 * Preserves the VitePress frontmatter and page intro on each docs page.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

function extractVersionBlocks(sourcePath, label) {
  const source = readFileSync(join(repoRoot, sourcePath), 'utf8');
  const firstVersion = source.search(/^## \d/m);
  if (firstVersion === -1) {
    console.error(`${sourcePath}: no version heading found (expected "## <version>")`);
    process.exit(1);
  }
  return source.slice(firstVersion).trimEnd() + '\n';
}

const enVersions = extractVersionBlocks('CHANGELOG.md', 'English');
writeFileSync(
  join(repoRoot, 'docs/en/release-notes/changelog.md'),
  `---
outline: 2
---

# Changelog

This page documents the changes in each Kimi Code CLI release.

${enVersions}`,
);
console.log('Synced docs/en/release-notes/changelog.md from CHANGELOG.md');

const zhVersions = extractVersionBlocks('CHANGELOG.zh-CN.md', 'Chinese');
writeFileSync(
  join(repoRoot, 'docs/zh/release-notes/changelog.md'),
  `---
outline: 2
---

# 变更记录

本页记录 Kimi Code CLI 每个版本的变更内容。

${zhVersions}`,
);
console.log('Synced docs/zh/release-notes/changelog.md from CHANGELOG.zh-CN.md');
