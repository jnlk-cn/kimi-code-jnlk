import type { Agent } from '../..';
import type { PermissionPolicy, PermissionPolicyContext, PermissionPolicyResult } from '../types';

const ASK_MODE_DENIED_TOOLS = new Set([
  'Write',
  'Edit',
  'AgentSwarm',
  'EnterPlanMode',
  'ExitPlanMode',
  'CreateGoal',
  'CronCreate',
  'CronDelete',
  'TaskStop',
]);

/** Heuristic: Bash commands that look like they mutate the filesystem or system state. */
const MUTATING_BASH_PATTERN =
  /\b(rm|rmdir|mv|cp|mkdir|touch|chmod|chown|ln|tee|dd|truncate|mkfifo|install|sed\s+-i|perl\s+-i|git\s+(add|commit|push|checkout|merge|rebase|reset|clean|stash)|npm\s+(install|uninstall|publish)|pnpm\s+(add|remove|publish)|yarn\s+(add|remove)|pip\s+install|cargo\s+(install|publish)|docker\s+(rm|rmi|run|build|compose)|kubectl\s+(apply|delete|create)|>\s*|>>\s*)\b/i;

export class AskModeGuardDenyPermissionPolicy implements PermissionPolicy {
  readonly name = 'ask-mode-guard-deny';

  constructor(private readonly agent: Agent) {}

  evaluate(context: PermissionPolicyContext): PermissionPolicyResult | undefined {
    if (!this.agent.askMode.isActive) return;

    const toolName = context.toolCall.name;
    if (ASK_MODE_DENIED_TOOLS.has(toolName)) {
      return {
        kind: 'deny',
        message:
          `${toolName} is not available in ask mode. Ask mode is read-only — switch to agent mode to make changes.`,
      };
    }

    if (toolName === 'Bash') {
      const command = bashCommand(context);
      if (command !== undefined && MUTATING_BASH_PATTERN.test(command)) {
        return {
          kind: 'deny',
          message:
            'Bash commands that modify files or system state are not available in ask mode. Use read-only commands only, or switch to agent mode.',
        };
      }
    }

    if (toolName === 'Agent') {
      const subagentType = subagentTypeArg(context);
      if (subagentType === 'coder' || subagentType === undefined) {
        return {
          kind: 'deny',
          message:
            'Coder / default subagents are not available in ask mode because they can modify files. Use explore (read-only) or switch to agent mode.',
        };
      }
    }

    return;
  }
}

function bashCommand(context: PermissionPolicyContext): string | undefined {
  const args = context.args;
  if (args === undefined || typeof args !== 'object' || args === null) return undefined;
  const command = (args as Record<string, unknown>)['command'];
  return typeof command === 'string' ? command : undefined;
}

function subagentTypeArg(context: PermissionPolicyContext): string | undefined {
  const args = context.args;
  if (args === undefined || typeof args !== 'object' || args === null) return undefined;
  const value = (args as Record<string, unknown>)['subagent_type'];
  return typeof value === 'string' ? value : undefined;
}
