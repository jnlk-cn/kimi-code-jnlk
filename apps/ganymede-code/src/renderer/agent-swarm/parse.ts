/** Pure parsing helpers ported from kimi-code AgentSwarm progress / tool-call rendering. */

export type AgentSwarmMemberPhase =
  | 'pending'
  | 'queued'
  | 'suspended'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AgentSwarmResultStatus {
  readonly index: number;
  readonly status: 'completed' | 'failed' | 'cancelled';
  readonly agentId?: string;
  readonly completedText?: string;
  readonly failureText?: string;
}

export interface AgentSwarmResultSummary {
  readonly completed: number;
  readonly failed: number;
  readonly aborted: number;
  readonly parsed: boolean;
  readonly statuses: readonly AgentSwarmResultStatus[];
}

const RESUMED_ITEM_LABEL = '(resumed)';

export function agentSwarmItemsFromArgs(args: Record<string, unknown>): string[] {
  const items = args['items'];
  if (!Array.isArray(items)) return [];
  return items.map(String);
}

export function agentSwarmResumeItemsFromArgs(args: Record<string, unknown>): string[] {
  const resumeAgentIds = args['resume_agent_ids'];
  if (
    typeof resumeAgentIds !== 'object' ||
    resumeAgentIds === null ||
    Array.isArray(resumeAgentIds)
  ) {
    return [];
  }
  return Object.keys(resumeAgentIds).map(() => RESUMED_ITEM_LABEL);
}

export function agentSwarmDescriptionFromArgs(args: Record<string, unknown>): string {
  const description = args['description'];
  return typeof description === 'string' ? description : '';
}

export function agentSwarmPartialItemsFromArguments(argumentsText: string): string[] {
  const match = /"items"\s*:\s*\[/.exec(argumentsText);
  if (match === null) return [];
  const items: string[] = [];
  for (let i = match.index + match[0].length; i < argumentsText.length; i += 1) {
    const ch = argumentsText[i];
    if (ch === ']') return items;
    if (ch !== '"') continue;

    const parsed = parsePartialJsonString(argumentsText, i + 1);
    items.push(parsed.value);
    if (parsed.closed) {
      i = parsed.nextIndex;
      continue;
    }
    return items;
  }
  return items;
}

export function agentSwarmPartialResumeItemsFromArguments(argumentsText: string): string[] {
  const match = /"resume_agent_ids"\s*:\s*\{/.exec(argumentsText);
  if (match === null) return [];
  return Array.from(
    { length: countPartialJsonObjectEntries(argumentsText, match.index + match[0].length) },
    () => RESUMED_ITEM_LABEL,
  );
}

export function agentSwarmPartialDescriptionFromArguments(argumentsText: string): string {
  const match = /"description"\s*:\s*"/.exec(argumentsText);
  if (match === null) return '';
  return parsePartialJsonString(argumentsText, match.index + match[0].length).value;
}

export function agentSwarmWorkItemsStartedFromArguments(argumentsText: string): boolean {
  return /"items"\s*:/.test(argumentsText) || /"resume_agent_ids"\s*:/.test(argumentsText);
}

export function agentSwarmResultSummaryFromOutput(output: string): AgentSwarmResultSummary {
  const statuses = parseAgentSwarmResultStatuses(output);
  let completed = 0;
  let failed = 0;
  let aborted = 0;
  for (const status of statuses) {
    if (status.status === 'completed') completed += 1;
    if (status.status === 'failed') failed += 1;
    if (status.status === 'cancelled') aborted += 1;
  }
  return {
    completed,
    failed,
    aborted,
    parsed: statuses.length > 0,
    statuses,
  };
}

export function formatAgentSwarmSummaryLabel(summary: AgentSwarmResultSummary): string {
  const segments: string[] = [];
  if (summary.completed > 0) segments.push(`${String(summary.completed)} 完成`);
  if (summary.failed > 0) segments.push(`${String(summary.failed)} 失败`);
  if (summary.aborted > 0) segments.push(`${String(summary.aborted)} 中止`);
  if (segments.length > 0) return segments.join(' · ');
  return summary.parsed ? '已完成' : '无结果';
}

export function formatAgentSwarmError(output: string): string {
  const trimmed = output.trim();
  if (trimmed.includes('AgentSwarm must be the only tool call')) {
    return 'AgentSwarm 必须单独调用，不能与同轮其他工具混用。';
  }
  if (trimmed.includes('Multiple AgentSwarm calls are not forbidden')) {
    return '请一次只调用一个 AgentSwarm；等待结果后再发下一个，或合并到同一次调用。';
  }
  if (trimmed.includes('requires at least 2 items')) {
    return 'AgentSwarm 至少需要 2 个 items（除非提供 resume_agent_ids）。';
  }
  if (trimmed.includes('prompt_template is required')) {
    return '提供 items 时必须同时提供包含 {{item}} 的 prompt_template。';
  }
  if (trimmed.includes('prompt_template must include')) {
    return 'prompt_template 必须包含 {{item}} 占位符。';
  }
  if (trimmed.includes('Duplicate subagent prompts')) {
    return '子 Agent 的 prompt 不能重复，请拆分不同的工作范围。';
  }
  if (/permission denied/i.test(trimmed) || /Approval timed out/i.test(trimmed)) {
    return '操作需要批准但未通过或已超时。可在权限菜单切换到「自动安全操作」后重试。';
  }
  const normalized = normalizeFailureText(trimmed);
  return normalized ?? trimmed;
}

export function parseAgentSwarmResultStatuses(output: string): AgentSwarmResultStatus[] {
  const xmlStatuses = parseAgentSwarmXmlResultStatuses(output);
  if (xmlStatuses.length > 0) return xmlStatuses;
  return parseAgentSwarmLegacyResultStatuses(output);
}

function parseAgentSwarmXmlResultStatuses(output: string): AgentSwarmResultStatus[] {
  return forEachSubagentTag(output, (attrs, body, tagIndex) => {
    const explicitIndex = Number(xmlAttribute(attrs, 'index'));
    const index =
      Number.isInteger(explicitIndex) && explicitIndex > 0 ? explicitIndex : tagIndex;
    const outcome = xmlAttribute(attrs, 'outcome');
    if (
      outcome !== 'completed' &&
      outcome !== 'failed' &&
      outcome !== 'aborted' &&
      outcome !== 'cancelled'
    ) {
      return undefined;
    }
    const agentId = xmlAttribute(attrs, 'agent_id');
    return {
      index,
      status: outcome === 'aborted' || outcome === 'cancelled' ? 'cancelled' : outcome,
      agentId,
      completedText: outcome === 'completed' ? body : undefined,
      failureText: outcome === 'failed' ? body : undefined,
    };
  });
}

function parseAgentSwarmLegacyResultStatuses(output: string): AgentSwarmResultStatus[] {
  return forEachAgentBlock(output, (block, index) => {
    const statusMatch = /^status: (completed|failed|aborted|cancelled)$/m.exec(block);
    if (statusMatch === null) return undefined;
    const status = statusMatch[1] as 'completed' | 'failed' | 'aborted' | 'cancelled';
    return {
      index,
      status: status === 'aborted' || status === 'cancelled' ? 'cancelled' : status,
      completedText: status === 'completed' ? parseAgentSwarmCompletedText(block) : undefined,
      failureText: status === 'failed' ? parseAgentSwarmFailureText(block) : undefined,
    };
  });
}

function forEachSubagentTag<T>(
  output: string,
  callback: (attrs: string, body: string, index: number) => T | undefined,
): T[] {
  const result: T[] = [];
  const tagPattern = /<subagent\b([^>]*)>/g;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = tagPattern.exec(output)) !== null) {
    const attrs = match[1] ?? '';
    const closeIndex = output.indexOf('</subagent>', tagPattern.lastIndex);
    if (closeIndex < 0) break;
    const body = output.slice(tagPattern.lastIndex, closeIndex);
    index += 1;
    const value = callback(attrs, body, index);
    if (value !== undefined) result.push(value);
    tagPattern.lastIndex = closeIndex + '</subagent>'.length;
  }
  return result;
}

function forEachAgentBlock<T>(
  output: string,
  callback: (block: string, index: number) => T | undefined,
): T[] {
  const result: T[] = [];
  for (const block of output.split(/\n(?=\[agent \d+\]\n)/)) {
    const indexMatch = /^\[agent (\d+)\]$/m.exec(block);
    if (indexMatch === null) continue;
    const value = callback(block, Number(indexMatch[1]));
    if (value !== undefined) result.push(value);
  }
  return result;
}

function xmlAttribute(attrs: string, name: string): string | undefined {
  const match = new RegExp(`\\b${name}="([^"]*)"`).exec(attrs);
  return match?.[1];
}

function parseAgentSwarmCompletedText(block: string): string | undefined {
  const marker = '\n[summary]\n';
  const markerIndex = block.indexOf(marker);
  if (markerIndex < 0) return undefined;
  return normalizeFinalOutputText(block.slice(markerIndex + marker.length));
}

function parseAgentSwarmFailureText(block: string): string | undefined {
  const match = /^subagent error:\s*([\s\S]*)$/m.exec(block);
  if (match === null) return undefined;
  return normalizeFailureText(match[1]);
}

function normalizeFailureText(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;
  const nestedFailureText = nestedAgentSwarmFailureText(text);
  const normalized = stripAgentSwarmPrefix(collapseWhitespace(nestedFailureText ?? text));
  return normalized.length > 0 ? normalized : undefined;
}

function nestedAgentSwarmFailureText(text: string): string | undefined {
  const xmlFailureText = nestedAgentSwarmXmlFailureText(text);
  if (xmlFailureText !== undefined) {
    return nestedAgentSwarmFailureText(xmlFailureText) ?? xmlFailureText;
  }

  if (!/^\s*agent_swarm:\s*failed\b/m.test(text)) return undefined;
  const match = /^\s*subagent error:\s*([\s\S]*?)(?=\n\[agent \d+\]\n|$)/m.exec(text);
  if (match === null) return undefined;
  const failureText = match[1];
  if (failureText === undefined) return undefined;
  return nestedAgentSwarmFailureText(failureText) ?? failureText;
}

function nestedAgentSwarmXmlFailureText(text: string): string | undefined {
  if (!/<agent_swarm_result\b/.test(text)) return undefined;
  const failed = parseAgentSwarmXmlResultStatuses(text).find((entry) => {
    return entry.status === 'failed' && entry.failureText !== undefined;
  });
  return failed?.failureText;
}

function stripAgentSwarmPrefix(text: string): string {
  return text.replace(/^agent_swarm:\s*(?:failed|completed)?\s*/i, '').trim();
}

function normalizeFinalOutputText(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;
  const normalized = collapseWhitespace(text);
  return normalized.length > 0 ? normalized : undefined;
}

function collapseWhitespace(text: string): string {
  return text.replaceAll(/\s+/g, ' ').trim();
}

function countPartialJsonObjectEntries(text: string, startIndex: number): number {
  let count = 0;
  let expectKey = true;
  for (let i = startIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '}') return count;
    if (ch === ',') {
      expectKey = true;
      continue;
    }
    if (ch !== '"') continue;

    const parsed = parsePartialJsonString(text, i + 1);
    if (expectKey) {
      if (parsed.closed || parsed.value.length > 0) count += 1;
      expectKey = false;
    }
    if (!parsed.closed) return count;
    i = parsed.nextIndex;
  }
  return count;
}

function parsePartialJsonString(
  text: string,
  startIndex: number,
): { value: string; closed: boolean; nextIndex: number } {
  let value = '';
  for (let i = startIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') return { value, closed: true, nextIndex: i };
    if (ch !== '\\') {
      value += ch;
      continue;
    }

    const escaped = text[i + 1];
    if (escaped === undefined) return { value, closed: false, nextIndex: i };
    switch (escaped) {
      case 'n':
        value += '\n';
        break;
      case 't':
        value += '\t';
        break;
      case 'r':
        value += '\r';
        break;
      case 'b':
        value += '\b';
        break;
      case 'f':
        value += '\f';
        break;
      case '"':
      case '\\':
      case '/':
        value += escaped;
        break;
      case 'u': {
        const hex = text.slice(i + 2, i + 6);
        if (hex.length < 4) return { value, closed: false, nextIndex: i };
        const code = Number.parseInt(hex, 16);
        if (Number.isNaN(code)) return { value, closed: false, nextIndex: i };
        value += String.fromCodePoint(code);
        i += 4;
        break;
      }
      default:
        value += escaped;
    }
    i += 1;
  }
  return { value, closed: false, nextIndex: text.length };
}
