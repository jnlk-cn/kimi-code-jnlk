/* oxlint-disable typescript-eslint/no-unsafe-declaration-merging, eslint-plugin-import/namespace -- Event2 class+payload-interface declaration merging is the sanctioned event-declaration idiom. */
import { z } from 'zod';

import { AgentStatusUpdated } from '#/agent/usage/usageEvents';
import { AgentEvent2 } from '#/app/event/event2';
import { MAIN_AGENT_ID } from '#/session/agentLifecycle/agentLifecycle';
import { defineState } from '#/state/state';

export interface DebugModeState {
  readonly active: boolean;
}

const debugModeEnterSchema = z.object({ agentId: z.string() });

export class DebugModeEnter extends AgentEvent2<z.infer<typeof debugModeEnterSchema>> {
  static override readonly type = 'debug_mode.enter';
  static override readonly durable = true;
  static override readonly schema = debugModeEnterSchema;
}
export interface DebugModeEnter {
  readonly agentId: string;
}

const debugModeExitSchema = z.object({ agentId: z.string() });

export class DebugModeExit extends AgentEvent2<z.infer<typeof debugModeExitSchema>> {
  static override readonly type = 'debug_mode.exit';
  static override readonly durable = true;
  static override readonly schema = debugModeExitSchema;
}
export interface DebugModeExit {
  readonly agentId: string;
}

export const debugKey = defineState('debug', (): DebugModeState => ({ active: false }))
  .replayable({ schema: z.custom<DebugModeState>() })
  .undoable()
  .on(DebugModeEnter, (s, e, ctx) => {
    if (e.agentId !== MAIN_AGENT_ID) return;
    s.active = true;
    ctx.emit(new AgentStatusUpdated({ agentId: e.agentId, debugMode: true }));
  })
  .on(DebugModeExit, (s, e, ctx) => {
    if (s.active) s.active = false;
    ctx.emit(new AgentStatusUpdated({ agentId: e.agentId, debugMode: false }));
  });
