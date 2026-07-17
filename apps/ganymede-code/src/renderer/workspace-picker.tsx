import type { ReactNode } from 'react';
import { Folder, FolderGit2, FolderOpen, FolderPlus, Plus } from 'lucide-react';

import type { ProjectSummary } from '../shared/contracts';
import {
  AppMenuPopover,
  type AppMenuItem,
  type MenuAnchor,
} from './app-menu';

export function buildWorkspacePickerItems(props: {
  readonly projects: readonly ProjectSummary[];
  readonly activeProject?: ProjectSummary;
  readonly additionalDirs?: readonly string[];
  readonly onSelectProject: (project: ProjectSummary) => void;
  readonly onOpenFromDisk: () => void;
  readonly onAddAdditionalDir: () => void;
}): readonly AppMenuItem[] {
  const dirs = props.additionalDirs ?? props.activeProject?.additionalDirs ?? [];
  const items: AppMenuItem[] = [
    ...props.projects.map((project) => ({
      id: project.workDir,
      label: project.name,
      description: project.isGitRepository ? project.branch : '非 Git 目录',
      icon: project.isGitRepository ? <FolderGit2 /> : <Folder />,
      checked: project.workDir === props.activeProject?.workDir,
      onSelect: () => props.onSelectProject(project),
    })),
  ];

  if (dirs.length > 0) {
    items.push({ id: 'additional-dirs-separator', separator: true });
    for (const dir of dirs) {
      items.push({
        id: `additional-dir:${dir}`,
        label: dir.split('/').at(-1) ?? dir,
        description: '辅助目录',
        icon: <Plus />,
        disabled: true,
      });
    }
  }

  items.push(
    { id: 'workspace-actions-separator', separator: true },
    {
      id: 'open-from-disk',
      label: '从电脑选择或新建目录…',
      icon: <FolderOpen />,
      onSelect: props.onOpenFromDisk,
    },
    {
      id: 'add-additional-dir',
      label: '添加辅助目录…',
      icon: <FolderPlus />,
      disabled: props.activeProject === undefined,
      onSelect: props.onAddAdditionalDir,
    },
  );

  return items;
}

export function WorkspacePickerPopover(props: {
  readonly anchor: MenuAnchor;
  readonly items: readonly AppMenuItem[];
  readonly onClose: () => void;
  readonly placement?: 'top-start' | 'bottom-start' | 'bottom-end';
}): ReactNode {
  return (
    <AppMenuPopover
      anchor={props.anchor}
      ariaLabel="工作区选择器"
      items={props.items}
      onClose={props.onClose}
      placement={props.placement ?? 'bottom-start'}
      searchPlaceholder="搜索项目…"
    />
  );
}
