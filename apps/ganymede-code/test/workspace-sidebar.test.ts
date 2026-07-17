import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import type { ProjectSummary, TaskSummary } from '../src/shared/contracts';
import {
  archivedProjectMenuItems,
  DEFAULT_RECENT_TASK_COUNT,
  visibleProjectTasks,
} from '../src/renderer/components/workspace-sidebar';
import {
  WORKSPACE_DOCK_SECTIONS,
  WORKSPACE_UTILITY_PANEL_MENU,
  WORKSPACE_UTILITY_PANELS,
} from '../src/renderer/components/workspace-panels';

function task(id: string, updatedAt: number, pinned = false): TaskSummary {
  return {
    id,
    title: `Task ${id}`,
    workDir: '/workspace/example',
    createdAt: updatedAt - 1_000,
    updatedAt,
    archived: false,
    pinned,
    unread: false,
    target: 'local',
  };
}

describe('visibleProjectTasks', () => {
  it('keeps every pinned task and limits only recent unpinned tasks', () => {
    const tasks = [
      ...Array.from({ length: 10 }, (_, index) => task(`pinned-${String(index)}`, 500 - index, true)),
      ...Array.from({ length: 12 }, (_, index) => task(`recent-${String(index)}`, 400 - index)),
    ];

    const result = visibleProjectTasks(tasks, undefined, false);

    expect(result.tasks.filter((item) => item.pinned)).toHaveLength(10);
    expect(result.tasks.filter((item) => !item.pinned)).toHaveLength(DEFAULT_RECENT_TASK_COUNT);
    expect(result.hiddenCount).toBe(4);
  });

  it('keeps an older active task visible outside the recent limit', () => {
    const tasks = Array.from({ length: 10 }, (_, index) => task(`task-${String(index)}`, 100 - index));

    const result = visibleProjectTasks(tasks, 'task-9', false);

    expect(result.tasks.map((item) => item.id)).toContain('task-9');
    expect(result.tasks).toHaveLength(DEFAULT_RECENT_TASK_COUNT + 1);
    expect(result.hiddenCount).toBe(1);
  });

  it('shows short and empty task lists without a reveal affordance', () => {
    const short = [task('one', 3), task('two', 2), task('three', 1)];

    expect(visibleProjectTasks(short, undefined, false)).toEqual({
      tasks: short,
      hiddenCount: 0,
    });
    expect(visibleProjectTasks([], undefined, false)).toEqual({ tasks: [], hiddenCount: 0 });
  });

  it('returns the complete existing order when all tasks are revealed', () => {
    const tasks = [task('older', 1), task('newer', 2), task('pinned', 3, true)];

    expect(visibleProjectTasks(tasks, undefined, true)).toEqual({
      tasks,
      hiddenCount: 0,
    });
  });
});

describe('archivedProjectMenuItems', () => {
  const project: ProjectSummary = {
    workDir: '/workspace/archived',
    name: 'archived',
    updatedAt: 1,
    sessionCount: 2,
    pinned: false,
    additionalDirs: [],
    isGitRepository: false,
  };

  it('offers restore and reveal actions without restoring on row click', () => {
    const onRestore = vi.fn();
    const onProjectReveal = vi.fn();
    const items = archivedProjectMenuItems(project, {
      onProjectReveal,
    } as never, onRestore);

    expect(items.map((item) => item.label)).toEqual(['恢复到侧栏', '在 Finder 中显示']);
    items[0]?.onSelect?.();
    expect(onRestore).toHaveBeenCalledTimes(1);
    items[1]?.onSelect?.();
    expect(onProjectReveal).toHaveBeenCalledWith(project);
  });
});

describe('WORKSPACE_UTILITY_PANEL_MENU', () => {
  it('labels Sites as 本地站点 and keeps inbox in the right rail dock', () => {
    expect(WORKSPACE_UTILITY_PANEL_MENU.find((item) => item.panel === 'sites')?.label).toBe('本地站点');
    expect(WORKSPACE_UTILITY_PANELS).toContain('inbox');
  });
});

describe('WORKSPACE_DOCK_SECTIONS', () => {
  it('groups dock tools with dividers between dev, task, inbox, extensions, and git', () => {
    expect(WORKSPACE_DOCK_SECTIONS.map((section) => section.items.map((item) => item.panel))).toEqual([
      ['terminal', 'files', 'browser'],
      ['summary', 'review', 'plans', 'agents'],
      ['inbox', 'scheduled'],
      ['plugins', 'sites', 'memory'],
      ['pulls', 'git-sync'],
    ]);
  });
});

describe('workspace rail embedded layout CSS', () => {
  const stylesCss = readFileSync(
    join(import.meta.dirname, '../src/renderer/styles.css'),
    'utf8',
  );
  const railCss = readFileSync(
    join(import.meta.dirname, '../src/renderer/components/workspace-rail.css'),
    'utf8',
  );

  it('scopes legacy side-panel width/position rules away from embedded panels', () => {
    const blocks = [
      ...stylesCss.matchAll(
        /\.side-panel(?:\.[a-z-]+)*(?::not\(\.embedded\))?[^{]*\{[^}]*\}/g,
      ),
    ].map((match) => match[0]);

    for (const block of blocks) {
      // Ignore helpful shrink rules (min-width:0 / max-width:100%) that aid embedded layout.
      const hasFixedWidth = /(?:^|[^-\w])width\s*:/.test(block);
      const hasAbsolute = /position\s*:\s*absolute/.test(block);
      const minWidthValue = block.match(/min-width\s*:\s*([^;]+)/)?.[1]?.trim();
      const hasNonZeroMinWidth =
        minWidthValue !== undefined && !/^0(?:px|%)?$/.test(minWidthValue);
      if (!hasFixedWidth && !hasAbsolute && !hasNonZeroMinWidth) continue;
      expect(block, `legacy width/position must exclude embedded:\n${block}`).toMatch(
        /:not\(\.embedded\)/,
      );
    }
  });

  it('defines a full embedded side-panel reset that fills the rail body', () => {
    expect(railCss).toMatch(
      /\.workspace-rail-content__body\s*>\s*\.side-panel\.embedded\s*\{[^}]*width:\s*100%/,
    );
    expect(railCss).toMatch(
      /\.workspace-rail-content__body\s*>\s*\.side-panel(?:\.embedded)?[^}]*max-width:\s*none/,
    );
    expect(railCss).toMatch(
      /\.workspace-rail-content__body\s*>\s*\.side-panel(?:\.embedded)?[^}]*align-self:\s*stretch/,
    );
  });

  it('keeps review changed-files flex rules syntactically valid', () => {
    expect(railCss).not.toMatch(/}\s*\n\s*flex\s*:/);
    expect(railCss).toMatch(
      /\.workspace-rail-content\s+\.changed-files\s*\{\s*flex:\s*0\s+1\s+36%/,
    );
  });
});
