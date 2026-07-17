import { dump as dumpYaml, load as loadYaml } from 'js-yaml';

export type PlanTodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface PlanDocumentTodo {
  readonly id: string;
  readonly content: string;
  readonly status: PlanTodoStatus;
}

export interface PlanDocumentMeta {
  readonly name?: string;
  readonly overview?: string;
}

export interface PlanDocument {
  readonly meta: PlanDocumentMeta;
  readonly todos: readonly PlanDocumentTodo[];
  readonly body: string;
  readonly hasFrontmatter: boolean;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

const PLAN_TODO_STATUSES: readonly PlanTodoStatus[] = [
  'pending',
  'in_progress',
  'completed',
  'cancelled',
];

function isPlanTodoStatus(value: unknown): value is PlanTodoStatus {
  return typeof value === 'string' && (PLAN_TODO_STATUSES as readonly string[]).includes(value);
}

function normalizeTodoStatus(value: unknown): PlanTodoStatus | undefined {
  if (isPlanTodoStatus(value)) return value;
  if (value === 'done') return 'completed';
  return undefined;
}

function parseTodos(raw: unknown): PlanDocumentTodo[] {
  if (!Array.isArray(raw)) return [];
  const todos: PlanDocumentTodo[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const id = typeof record['id'] === 'string' ? record['id'].trim() : '';
    const content =
      typeof record['content'] === 'string'
        ? record['content'].trim()
        : typeof record['title'] === 'string'
          ? record['title'].trim()
          : '';
    const status = normalizeTodoStatus(record['status']);
    if (id.length === 0 || content.length === 0 || status === undefined) continue;
    todos.push({ id, content, status });
  }
  return todos;
}

function parseMeta(raw: Record<string, unknown>): PlanDocumentMeta {
  const name = typeof raw['name'] === 'string' ? raw['name'].trim() : undefined;
  const overview = typeof raw['overview'] === 'string' ? raw['overview'].trim() : undefined;
  return {
    name: name !== undefined && name.length > 0 ? name : undefined,
    overview: overview !== undefined && overview.length > 0 ? overview : undefined,
  };
}

export function parsePlanDocument(content: string): PlanDocument {
  const match = FRONTMATTER_RE.exec(content);
  if (match === null) {
    return {
      meta: {},
      todos: [],
      body: content,
      hasFrontmatter: false,
    };
  }

  const yamlText = match[1] ?? '';
  const body = match[2] ?? '';
  try {
    const parsed = loadYaml(yamlText);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { meta: {}, todos: [], body: content, hasFrontmatter: false };
    }
    const record = parsed as Record<string, unknown>;
    return {
      meta: parseMeta(record),
      todos: parseTodos(record['todos']),
      body,
      hasFrontmatter: true,
    };
  } catch {
    return { meta: {}, todos: [], body: content, hasFrontmatter: false };
  }
}

export function serializePlanDocument(doc: {
  readonly meta: PlanDocumentMeta;
  readonly todos: readonly PlanDocumentTodo[];
  readonly body: string;
}): string {
  const frontmatter: Record<string, unknown> = {};
  if (doc.meta.name !== undefined) frontmatter['name'] = doc.meta.name;
  if (doc.meta.overview !== undefined) frontmatter['overview'] = doc.meta.overview;
  frontmatter['todos'] = doc.todos.map((todo) => ({
    id: todo.id,
    content: todo.content,
    status: todo.status,
  }));
  const yaml = dumpYaml(frontmatter, {
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
  }).trimEnd();
  const body = doc.body.replace(/^\r?\n/, '');
  return `---\n${yaml}\n---\n${body.length > 0 ? `\n${body}` : ''}`;
}

export function planTodoProgressSummary(todos: readonly PlanDocumentTodo[]): string {
  if (todos.length === 0) return '';
  const completed = todos.filter(
    (todo) => todo.status === 'completed' || todo.status === 'cancelled',
  ).length;
  return `${String(completed)}/${String(todos.length)} 已完成`;
}

export function extractMermaidFence(markdown: string): string | undefined {
  return /```mermaid\r?\n([\s\S]*?)\r?\n```/.exec(markdown)?.[1];
}
