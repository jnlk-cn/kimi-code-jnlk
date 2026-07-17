import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Brain, Pencil, Search, Trash2 } from 'lucide-react';

import type { AppSettings, MemoryRecord, ProjectSummary } from '../../shared/contracts';
import { EmptyState, Modal, PageFrame, formatRelative, messageOf } from '../page-chrome';

const api = window.ganymede;

export function MemoryPage(props: {
  readonly project?: ProjectSummary;
  readonly settings: AppSettings;
  readonly onError: (message: string) => void;
  readonly onOpenSettings: () => void;
}): ReactNode {
  const [records, setRecords] = useState<readonly MemoryRecord[]>([]);
  const [query, setQuery] = useState('');
  const [content, setContent] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [scopeAll, setScopeAll] = useState(false);
  const [editing, setEditing] = useState<MemoryRecord>();

  const projectPath = scopeAll ? undefined : props.project?.workDir;

  const refresh = useCallback(() => {
    if (!props.settings.memoryEnabled) {
      setRecords([]);
      return;
    }
    void api
      .searchMemories(query, projectPath)
      .then(setRecords)
      .catch((cause) => props.onError(messageOf(cause)));
  }, [query, projectPath, props.onError, props.settings.memoryEnabled]);

  useEffect(refresh, [refresh]);

  if (!props.settings.memoryEnabled) {
    return (
      <PageFrame icon={<Brain />} title="记忆" subtitle="仅存储在本机、可搜索并可随时删除的项目知识。">
        <EmptyState
          icon={<Brain />}
          title="本地记忆已关闭"
          body="在设置中启用本地记忆后，即可保存跨任务约定与偏好。"
          action={
            <button className="primary-button" onClick={props.onOpenSettings} type="button">
              打开设置
            </button>
          }
        />
      </PageFrame>
    );
  }

  return (
    <PageFrame icon={<Brain />} title="记忆" subtitle="仅存储在本机、可搜索并可随时删除的项目知识。">
      <div className="memory-compose">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="记录约定、偏好或需要跨任务保留的上下文…"
        />
        <input
          value={tagsText}
          onChange={(event) => setTagsText(event.target.value)}
          placeholder="标签，用逗号分隔（可选）"
        />
        <button
          className="primary-button"
          disabled={!content.trim()}
          onClick={() =>
            void api
              .saveMemory({
                content: content.trim(),
                projectPath: props.project?.workDir,
                tags: parseTags(tagsText),
              })
              .then(() => {
                setContent('');
                setTagsText('');
                refresh();
              })
              .catch((cause) => props.onError(messageOf(cause)))
          }
          type="button"
        >
          保存记忆
        </button>
      </div>
      <div className="page-toolbar">
        <div className="memory-search">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索记忆"
          />
        </div>
        <div className="segmented-control" role="tablist" aria-label="记忆范围">
          <button
            aria-selected={!scopeAll}
            className={scopeAll ? undefined : 'selected'}
            onClick={() => setScopeAll(false)}
            type="button"
          >
            当前项目
          </button>
          <button
            aria-selected={scopeAll}
            className={scopeAll ? 'selected' : undefined}
            onClick={() => setScopeAll(true)}
            type="button"
          >
            全部项目
          </button>
        </div>
      </div>
      <div className="memory-grid">
        {records.map((record) => (
          <article key={record.id}>
            <Brain size={15} />
            <p>{record.content}</p>
            {record.tags.length === 0 ? null : (
              <div className="tag-pills">
                {record.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            )}
            <small>{formatRelative(record.updatedAt)}</small>
            <div className="memory-card-actions">
              <button
                aria-label="编辑记忆"
                onClick={() => setEditing(record)}
                title="编辑记忆"
                type="button"
              >
                <Pencil size={13} />
              </button>
              <button
                aria-label="删除记忆"
                onClick={() =>
                  void api.deleteMemory(record.id).then(refresh).catch((cause) => props.onError(messageOf(cause)))
                }
                title="删除记忆"
                type="button"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </article>
        ))}
        {records.length === 0 ? (
          <EmptyState
            icon={<Brain />}
            title={query.trim().length > 0 ? '没有匹配的记忆' : '还没有记忆'}
            body={
              query.trim().length > 0
                ? '试试其他关键词，或切换到全部项目。'
                : '保存约定、偏好或需要跨任务保留的上下文。'
            }
          />
        ) : null}
      </div>
      {editing === undefined ? null : (
        <Modal title="编辑记忆" onClose={() => setEditing(undefined)}>
          <MemoryEditor
            record={editing}
            onClose={() => setEditing(undefined)}
            onSaved={() => {
              setEditing(undefined);
              refresh();
            }}
            onError={props.onError}
          />
        </Modal>
      )}
    </PageFrame>
  );
}

function MemoryEditor(props: {
  readonly record: MemoryRecord;
  readonly onClose: () => void;
  readonly onSaved: () => void;
  readonly onError: (message: string) => void;
}): ReactNode {
  const [content, setContent] = useState(props.record.content);
  const [tagsText, setTagsText] = useState(props.record.tags.join(', '));
  return (
    <>
      <textarea value={content} onChange={(event) => setContent(event.target.value)} />
      <input
        value={tagsText}
        onChange={(event) => setTagsText(event.target.value)}
        placeholder="标签，用逗号分隔"
      />
      <div className="modal-actions">
        <button onClick={props.onClose} type="button">
          取消
        </button>
        <button
          className="primary-button"
          disabled={!content.trim()}
          onClick={() =>
            void api
              .saveMemory({
                id: props.record.id,
                content: content.trim(),
                projectPath: props.record.projectPath,
                tags: parseTags(tagsText),
              })
              .then(props.onSaved)
              .catch((cause) => props.onError(messageOf(cause)))
          }
          type="button"
        >
          保存
        </button>
      </div>
    </>
  );
}

function parseTags(value: string): readonly string[] {
  return value
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}
