import type {
  HostToolDefinition,
  HostToolHandler,
} from '@moonshot-ai/kimi-code-sdk';

import type { DebugProbe } from '../shared/contracts';
import type { AppStore } from './store';
import type { BrowserManager } from './browser-manager';
import type { ChromeBridge } from './native-bridge';
import type { ComputerUse } from './computer-use';
import type { AutomationManager } from './automation-manager';
import type { WorkspaceService } from './workspace-service';
import type { ProjectIndexService } from './project-index/project-index-service';

export interface HostToolRegistration {
  readonly definition: HostToolDefinition;
  readonly handler: HostToolHandler;
}

export interface DebugHostTools {
  readonly listProbes: (sessionId: string) => readonly DebugProbe[];
  readonly registerProbe: (
    sessionId: string,
    input: {
      readonly file: string;
      readonly label: string;
      readonly marker: string;
      readonly line?: number;
      readonly id?: string;
    },
  ) => readonly DebugProbe[];
  readonly unregisterProbe: (sessionId: string, id: string) => readonly DebugProbe[];
  readonly requestVerification: (
    sessionId: string,
    input: { readonly steps: readonly string[]; readonly hypothesis?: string },
  ) => Promise<{
    readonly outcome: 'fixed' | 'not_fixed' | 'cancelled';
    readonly userNotes?: string;
    readonly registeredProbes: readonly DebugProbe[];
  }>;
}

export function createHostTools(deps: {
  readonly store: AppStore;
  readonly browser: BrowserManager;
  readonly chrome: ChromeBridge;
  readonly computer: ComputerUse;
  readonly automations: AutomationManager;
  readonly workspace: WorkspaceService;
  readonly projectIndex: ProjectIndexService;
  readonly debug: DebugHostTools;
}): readonly HostToolRegistration[] {
  const browserTabs = new Map<string, string>();
  return [
    {
      definition: {
        name: 'GanymedeCodebaseSearch',
        description:
          'Search the locally indexed project codebase by meaning or keywords. Prefer this when you do not know exact symbol names; use Grep for precise regex or identifier lookups.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            projectPath: { type: 'string' },
            mode: { type: 'string', enum: ['hybrid', 'semantic', 'lexical'] },
            limit: { type: 'number' },
          },
          required: ['query', 'projectPath'],
        },
      },
      handler: async (raw) => {
        if (!deps.store.getSettings().indexEnabled) return fail('Project index is disabled.');
        const args = record(raw);
        const hits = await deps.projectIndex.search({
          workDir: string(args['projectPath']),
          query: string(args['query']),
          mode:
            args['mode'] === 'semantic' || args['mode'] === 'lexical' || args['mode'] === 'hybrid'
              ? args['mode']
              : 'hybrid',
          limit: typeof args['limit'] === 'number' ? args['limit'] : 12,
        });
        return ok({
          count: hits.length,
          hits: hits.map((hit) => ({
            path: hit.path,
            startLine: hit.startLine,
            endLine: hit.endLine,
            source: hit.source,
            score: hit.score,
            snippet: hit.snippet.slice(0, 800),
          })),
        });
      },
    },
    {
      definition: {
        name: 'GanymedeBrowser',
        description:
          'Operate the Ganymede built-in browser. Use it to preview localhost, inspect pages, click, type, and capture screenshots.',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['navigate', 'inspect', 'screenshot', 'click', 'type', 'state'],
            },
            url: { type: 'string' },
            x: { type: 'number' },
            y: { type: 'number' },
            text: { type: 'string' },
          },
          required: ['action'],
        },
      },
      handler: async (raw, context) => {
        const args = record(raw);
        let tabId = browserTabs.get(context.sessionId);
        if (tabId === undefined) {
          const tab = await deps.browser.create(context.sessionId, optionalString(args['url']));
          tabId = tab.id;
          browserTabs.set(context.sessionId, tab.id);
        }
        switch (string(args['action'])) {
          case 'navigate':
            await deps.browser.navigate(tabId, string(args['url']));
            return ok({ tabId });
          case 'inspect':
          case 'state':
            return ok(await deps.browser.inspect(tabId));
          case 'screenshot':
            return {
              output: [
                {
                  type: 'image_url',
                  imageUrl: { url: await deps.browser.screenshot(tabId) },
                },
              ],
            };
          case 'click':
            await deps.browser.click(tabId, number(args['x']), number(args['y']));
            return ok(true);
          case 'type':
            await deps.browser.type(tabId, string(args['text']));
            return ok(true);
          default:
            return fail('Unsupported browser action.');
        }
      },
    },
    {
      definition: {
        name: 'GanymedeChrome',
        description:
          'Operate an explicitly connected Chrome tab through the Ganymede browser extension.',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['state', 'navigate', 'inspect', 'screenshot', 'click', 'type'],
            },
            url: { type: 'string' },
            x: { type: 'number' },
            y: { type: 'number' },
            text: { type: 'string' },
          },
          required: ['action'],
        },
      },
      handler: async (raw) => {
        const args = record(raw);
        const action = string(args['action']);
        const result = await deps.chrome.send(action, {
          url: optionalString(args['url']),
          x: args['x'],
          y: args['y'],
          text: optionalString(args['text']),
        });
        return ok(result);
      },
    },
    {
      definition: {
        name: 'GanymedeComputer',
        description:
          'Use macOS Screen Recording and Accessibility, after user approval, to inspect and operate desktop applications.',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['permissions', 'windows', 'frontmost', 'screenshot', 'click', 'type', 'key', 'scroll'],
            },
            x: { type: 'number' },
            y: { type: 'number' },
            text: { type: 'string' },
            keyCode: { type: 'number' },
            deltaX: { type: 'number' },
            deltaY: { type: 'number' },
          },
          required: ['action'],
        },
      },
      handler: async (raw) => {
        const args = record(raw);
        const action = string(args['action']);
        if (['click', 'type', 'key', 'scroll'].includes(action)) {
          const frontmost = record(await deps.computer.call('frontmost'));
          const allowlist = deps.store.getSettings().computerAllowlist;
          const appName = optionalString(frontmost['name']);
          const bundleId = optionalString(frontmost['bundleId']);
          if (
            !allowlist.some((allowed) => allowed === appName || allowed === bundleId)
          ) {
            return fail(
              `The frontmost app (${appName ?? bundleId ?? 'unknown'}) is not in the Computer Use allowlist.`,
            );
          }
        }
        const result = await deps.computer.call(action, {
          x: args['x'],
          y: args['y'],
          text: args['text'],
          keyCode: args['keyCode'],
          deltaX: args['deltaX'],
          deltaY: args['deltaY'],
        });
        if (action === 'screenshot' && typeof result === 'string') {
          return { output: [{ type: 'image_url', imageUrl: { url: result } }] };
        }
        return ok(result);
      },
    },
    {
      definition: {
        name: 'GanymedeMemory',
        description:
          'Search, save, or delete user-controlled local memories. Never save secrets without an explicit user request.',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['search', 'save', 'delete'] },
            query: { type: 'string' },
            id: { type: 'string' },
            projectPath: { type: 'string' },
            content: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
          },
          required: ['action'],
        },
      },
      handler: (raw) => {
        if (!deps.store.getSettings().memoryEnabled) return fail('Local memory is disabled.');
        const args = record(raw);
        switch (string(args['action'])) {
          case 'search':
            return ok(
              deps.store.searchMemories(
                optionalString(args['query']) ?? '',
                optionalString(args['projectPath']),
              ),
            );
          case 'save': {
            const tags = strings(args['tags']);
            return ok(
              deps.store.saveMemory({
                id: optionalString(args['id']),
                projectPath: optionalString(args['projectPath']),
                content: string(args['content']),
                tags: tags.length > 0 ? tags : ['agent'],
              }),
            );
          }
          case 'delete':
            deps.store.deleteMemory(string(args['id']));
            return ok(true);
          default:
            return fail('Unsupported memory action.');
        }
      },
    },
    {
      definition: {
        name: 'GanymedeSchedule',
        description:
          'Create and manage local scheduled coding tasks. Schedules use every:15m, ISO timestamps, or RFC 5545 RRULE.',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['list', 'create', 'run', 'delete'] },
            id: { type: 'string' },
            name: { type: 'string' },
            prompt: { type: 'string' },
            projectPath: { type: 'string' },
            schedule: { type: 'string' },
            target: { type: 'string', enum: ['local', 'worktree'] },
          },
          required: ['action'],
        },
      },
      handler: async (raw) => {
        const args = record(raw);
        switch (string(args['action'])) {
          case 'list':
            return ok(deps.automations.list());
          case 'create':
            return ok(
              deps.automations.save({
                name: string(args['name']),
                prompt: string(args['prompt']),
                projectPath: string(args['projectPath']),
                schedule: string(args['schedule']),
                nextRunAt: Date.now(),
                enabled: true,
                mode: 'new-task',
                target: args['target'] === 'local' ? 'local' : 'worktree',
              }),
            );
          case 'run':
            await deps.automations.run(string(args['id']));
            return ok(true);
          case 'delete':
            deps.automations.delete(string(args['id']));
            return ok(true);
          default:
            return fail('Unsupported schedule action.');
        }
      },
    },
    {
      definition: {
        name: 'GanymedeSites',
        description:
          'Register, list, and serve local interactive sites generated by the agent.',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['list', 'register', 'serve'] },
            id: { type: 'string' },
            title: { type: 'string' },
            path: { type: 'string' },
          },
          required: ['action'],
        },
      },
      handler: async (raw) => {
        const args = record(raw);
        switch (string(args['action'])) {
          case 'list':
            return ok(deps.workspace.listSites());
          case 'register':
            return ok(
              deps.workspace.saveSite({
                title: string(args['title']),
                path: string(args['path']),
              }),
            );
          case 'serve':
            return ok(await deps.workspace.serveSite(string(args['id'])));
          default:
            return fail('Unsupported sites action.');
        }
      },
    },
    {
      definition: {
        name: 'GanymedeImage',
        description:
          'Generate an image through an OpenAI-compatible image endpoint configured with GANYMEDE_IMAGE_API_URL and GANYMEDE_IMAGE_API_KEY.',
        parameters: {
          type: 'object',
          properties: {
            prompt: { type: 'string' },
            model: { type: 'string' },
            size: { type: 'string' },
          },
          required: ['prompt'],
        },
      },
      handler: async (raw) => {
        const endpoint = process.env['GANYMEDE_IMAGE_API_URL'];
        const key = process.env['GANYMEDE_IMAGE_API_KEY'];
        if (endpoint === undefined || key === undefined) {
          return fail(
            'Configure GANYMEDE_IMAGE_API_URL and GANYMEDE_IMAGE_API_KEY to generate images.',
          );
        }
        const args = record(raw);
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${key}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            prompt: string(args['prompt']),
            model: optionalString(args['model']),
            size: optionalString(args['size']) ?? '1024x1024',
            response_format: 'b64_json',
          }),
        });
        if (!response.ok) {
          return fail(`Image provider returned ${String(response.status)}.`);
        }
        const payload = (await response.json()) as {
          data?: Array<{ b64_json?: string; url?: string }>;
        };
        const image = payload.data?.[0];
        const url =
          image?.b64_json !== undefined
            ? `data:image/png;base64,${image.b64_json}`
            : image?.url;
        if (url === undefined) return fail('Image provider returned no image.');
        return { output: [{ type: 'image_url', imageUrl: { url } }] };
      },
    },
    {
      definition: {
        name: 'GanymedeWorktree',
        description:
          'Create, list, remove, or hand off Ganymede-managed Git worktrees for isolated parallel tasks.',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['list', 'create', 'remove', 'handoff'] },
            projectPath: { type: 'string' },
            branch: { type: 'string' },
            path: { type: 'string' },
            source: { type: 'string' },
            target: { type: 'string' },
            includeChanges: { type: 'boolean' },
          },
          required: ['action'],
        },
      },
      handler: async (raw) => {
        const args = record(raw);
        switch (string(args['action'])) {
          case 'list':
            return ok(await deps.workspace.worktrees(string(args['projectPath'])));
          case 'create':
            return ok(
              await deps.workspace.createWorktree(
                string(args['projectPath']),
                optionalString(args['branch']),
                args['includeChanges'] !== false,
              ),
            );
          case 'remove':
            await deps.workspace.removeWorktree(
              string(args['projectPath']),
              string(args['path']),
            );
            return ok(true);
          case 'handoff':
            await deps.workspace.handoffWorktree(
              string(args['source']),
              string(args['target']),
            );
            return ok(true);
          default:
            return fail('Unsupported worktree action.');
        }
      },
    },
    {
      definition: {
        name: 'GanymedePullRequests',
        description: 'List GitHub pull requests for a local repository using the authenticated gh CLI.',
        parameters: {
          type: 'object',
          properties: { projectPath: { type: 'string' } },
          required: ['projectPath'],
        },
      },
      handler: async (raw) =>
        ok(await deps.workspace.pullRequests(string(record(raw)['projectPath']))),
    },
    {
      definition: {
        name: 'GanymedeDebugProbe',
        description:
          'Register, list, or unregister temporary debug instrumentation probes while in 排障 (Debug) mode. Call register after adding a marker comment such as // ganymede-debug-probe:<id> in source.',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['register', 'list', 'unregister'] },
            id: { type: 'string' },
            file: { type: 'string' },
            line: { type: 'number' },
            label: { type: 'string' },
            marker: { type: 'string' },
          },
          required: ['action'],
        },
      },
      handler: (raw, context) => {
        const args = record(raw);
        switch (string(args['action'])) {
          case 'list':
            return ok({ probes: deps.debug.listProbes(context.sessionId) });
          case 'register': {
            const file = string(args['file']);
            const label = string(args['label']);
            const marker = string(args['marker']);
            const line = typeof args['line'] === 'number' ? args['line'] : undefined;
            const id = optionalString(args['id']);
            const probes = deps.debug.registerProbe(context.sessionId, {
              file,
              label,
              marker,
              line,
              id,
            });
            return ok({ probes });
          }
          case 'unregister': {
            const id = string(args['id']);
            return ok({ probes: deps.debug.unregisterProbe(context.sessionId, id) });
          }
          default:
            return fail('Unsupported debug probe action.');
        }
      },
    },
    {
      definition: {
        name: 'GanymedeRequestDebugVerification',
        description:
          'Ask the user to manually verify a fix in the Composer verification bar. Provide numbered steps (1–8). Blocks until the user chooses 问题已修复 or 问题未修复. Always call this after applying a fix in Debug mode.',
        parameters: {
          type: 'object',
          properties: {
            steps: {
              type: 'array',
              items: { type: 'string' },
              description: 'Numbered verification steps for the user (1–8 items).',
            },
            hypothesis: {
              type: 'string',
              description: 'Short summary of the root-cause hypothesis that was fixed.',
            },
          },
          required: ['steps'],
        },
      },
      handler: async (raw, context) => {
        const args = record(raw);
        const stepsRaw = args['steps'];
        if (!Array.isArray(stepsRaw)) {
          return fail('steps must be an array of strings.');
        }
        const steps = stepsRaw.filter((item): item is string => typeof item === 'string');
        const result = await deps.debug.requestVerification(context.sessionId, {
          steps,
          hypothesis: optionalString(args['hypothesis']),
        });
        return ok(result);
      },
    },
  ];
}

function ok(value: unknown): { output: string } {
  return { output: typeof value === 'string' ? value : JSON.stringify(value, null, 2) };
}

function fail(message: string): { output: string; isError: true } {
  return { output: message, isError: true };
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function string(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('A required string argument is missing.');
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('A required numeric argument is missing.');
  }
  return value;
}

function strings(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
